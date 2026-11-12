from copy import deepcopy
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace as Obj
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from sqlalchemy.dialects import postgresql

from app.repositories.workspace_repository import load_workspace, workspace_statement
from app.services.project_freshness import GEOMETRY, analysis_status, configuration_fingerprint
from app.services.workspace_service import workspace


def inputs():
    now = datetime.now(UTC)
    layout = Obj(
        solar_panel_id=uuid4(),
        panel_snapshot={"power_wp": 435, "width_mm": 1100, "length_mm": 1700},
        orientation="portrait",
        panel_count=10,
        installed_kwp=4.35,
        updated_at=now,
    )
    surface = Obj(id=uuid4(), panel_layout=layout, updated_at=now, **dict.fromkeys(GEOMETRY, 1.0))
    location = Obj(lat=43.8, lon=18.4, updated_at=now)
    project = Obj(
        id=uuid4(),
        name="House",
        description=None,
        status="analyzed",
        created_at=now,
        updated_at=now,
        location=location,
        roof_surfaces=[surface],
    )
    simulation = Obj(
        id=uuid4(),
        project_id=project.id,
        created_at=now + timedelta(seconds=1),
        input_snapshot={
            "configuration_fingerprint": configuration_fingerprint(location, [surface])
        },
    )
    return project, simulation


def test_status_metadata_changes_do_not_stale_simulation():
    project, simulation = inputs()
    assert analysis_status(project, simulation) == "analyzed"
    project.name = "Renamed"
    project.description = "New description"
    project.updated_at += timedelta(days=1)
    assert analysis_status(project, simulation) == "analyzed"


@pytest.mark.parametrize("field", GEOMETRY)
def test_geometry_changes_stale_simulation(field):
    project, simulation = inputs()
    setattr(project.roof_surfaces[0], field, 2.0)
    assert analysis_status(project, simulation) == "needs_recalculation"


@pytest.mark.parametrize(
    "field,value",
    [
        ("panel_count", 9),
        ("orientation", "landscape"),
        ("solar_panel_id", uuid4()),
        ("installed_kwp", 3.9),
    ],
)
def test_layout_changes_stale_simulation(field, value):
    project, simulation = inputs()
    setattr(project.roof_surfaces[0].panel_layout, field, value)
    assert analysis_status(project, simulation) == "needs_recalculation"


def test_location_panel_model_and_surface_removal():
    project, simulation = inputs()
    project.location.lon += 0.001
    assert analysis_status(project, simulation) == "needs_recalculation"
    project, simulation = inputs()
    project.roof_surfaces[0].panel_layout.panel_snapshot["power_wp"] = 500
    assert analysis_status(project, simulation) == "needs_recalculation"
    project.roof_surfaces = []
    assert analysis_status(project, simulation) == "needs_recalculation"


def test_not_started_and_in_progress():
    project, _ = inputs()
    assert analysis_status(project, None) == "in_progress"
    project.location = None
    project.roof_surfaces = []
    assert analysis_status(project, None) == "not_started"


def test_optimizer_overrides_produce_same_fingerprint_as_saved_layouts():
    project, _ = inputs()
    surface = project.roof_surfaces[0]
    values = deepcopy(vars(surface.panel_layout))
    assert configuration_fingerprint(
        project.location, [surface], {str(surface.id): values}
    ) == configuration_fingerprint(project.location, [surface])


def test_legacy_changes_are_conservatively_detected_without_project_timestamp():
    project, simulation = inputs()
    s = project.roof_surfaces[0]
    simulation.input_snapshot = {
        "location": {"lat": project.location.lat, "lon": project.location.lon},
        "surfaces": [
            {
                "roof_surface_id": str(s.id),
                "tilt_deg": s.tilt_deg,
                "azimuth_deg": s.azimuth_deg,
                "panel_count": 10,
                "installed_kwp": 4.35,
                "panel": {"id": str(s.panel_layout.solar_panel_id)},
            }
        ],
    }
    project.updated_at += timedelta(days=1)
    assert analysis_status(project, simulation) == "analyzed"
    s.updated_at += timedelta(days=1)
    assert analysis_status(project, simulation) == "needs_recalculation"


def test_workspace_query_is_owner_scoped_even_for_foreign_project():
    owner, foreign_project = uuid4(), uuid4()
    compiled = workspace_statement(owner, foreign_project).compile(dialect=postgresql.dialect())
    assert owner in compiled.params.values() and foreign_project in compiled.params.values()
    assert "solar_projects.user_id =" in str(compiled)


@pytest.mark.asyncio
async def test_empty_owned_result_never_queries_foreign_simulations():
    session = Obj(execute=AsyncMock(return_value=Obj(scalars=lambda: Obj(all=lambda: []))))
    projects, simulations = await load_workspace(session, uuid4(), uuid4())
    assert projects == [] and simulations == {}
    assert session.execute.await_count == 1


@pytest.mark.asyncio
async def test_workspace_counts_latest_and_no_simulations(monkeypatch):
    project, _ = inputs()
    project.status = "draft"
    monkeypatch.setattr(
        "app.repositories.workspace_repository.load_workspace",
        AsyncMock(return_value=([project], {})),
    )
    result = await workspace(None, uuid4())
    assert result["total_projects"] == 1 and result["in_progress"] == 1
    assert result["latest_analysis"] is None


@pytest.mark.asyncio
async def test_workspace_uses_latest_saved_simulation_across_projects(monkeypatch):
    first, old = inputs()
    second, latest = inputs()
    first.roof_surfaces[0].length_m = 5
    second.name = "Latest house"
    monkeypatch.setattr(
        "app.repositories.workspace_repository.load_workspace",
        AsyncMock(return_value=([first, second], {first.id: old, second.id: latest})),
    )
    monkeypatch.setattr(
        "app.services.workspace_service.simulation_summary",
        lambda simulation: Obj(
            model_dump=lambda **kwargs: {
                "id": str(simulation.id),
                "project_id": str(simulation.project_id),
            }
        ),
    )
    result = await workspace(None, uuid4())
    assert result["total_projects"] == 2
    assert result["analyzed_projects"] == 1
    assert result["in_progress"] == 1
    assert result["latest_analysis"]["project_name"] == "Latest house"
    assert result["latest_analysis"]["id"] == str(latest.id)
