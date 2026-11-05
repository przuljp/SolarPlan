import csv
from datetime import UTC, datetime
from io import BytesIO, StringIO
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import httpx
import pytest
from pypdf import PdfReader

from app.db.session import get_db_session
from app.dependencies.auth import get_current_user
from app.main import create_app
from app.repositories import energy_simulation_repository, project_repository
from app.schemas.energy_simulation import EnergySimulationRead
from app.services import report_service


@pytest.fixture
def simulation():
    surface_id = uuid4()
    monthly = [{"month": month, "energy_kwh": month * 10.25} for month in range(1, 13)]
    return EnergySimulationRead(
        id=uuid4(),
        project_id=uuid4(),
        provider_version="5.3",
        method_version="solarplan-pvgis-v1",
        system_loss_percent=9.5,
        installed_kwp=4.2,
        annual_kwh=799.5,
        specific_yield_kwh_per_kwp=190.36,
        created_at=datetime(2026, 11, 5, 10, tzinfo=UTC),
        input_snapshot={
            "location": {"lat": 43.8563, "lon": 18.4131, "location_label": "Ilidža, BiH"},
            "surfaces": [
                {
                    "roof_surface_id": str(surface_id),
                    "panel_count": 10,
                    "shape_type": "trapezoid",
                    "panel": {
                        "manufacturer": "LONGi",
                        "model_sku": "435M",
                        "power_wp": 435,
                    },
                }
            ],
        },
        monthly_results=monthly,
        surface_results=[
            {
                "roof_surface_id": surface_id,
                "name": "Južni <krov> & terasa",
                "installed_kwp": 4.2,
                "tilt_deg": 30,
                "azimuth_deg": 180,
                "pvgis_aspect": 0,
                "annual_kwh": 799.5,
                "specific_yield_kwh_per_kwp": 190.36,
                "monthly_results": monthly,
            }
        ],
    )


def csv_rows(simulation):
    data = report_service.build_csv(simulation)
    assert data.startswith(b"\xef\xbb\xbf")
    return list(csv.DictReader(StringIO(data.decode("utf-8-sig"))))


@pytest.mark.parametrize("loss", [0, 9.5, 14, 30])
def test_exports_preserve_losses_and_saved_production(simulation, loss):
    simulation.system_loss_percent = loss
    before = simulation.model_dump()
    rows = csv_rows(simulation)
    summary = {row["metric"]: row["value"] for row in rows if row["section"] == "summary"}
    assert float(summary["annual_production"]) == 799.5
    assert float(summary["system_losses"]) == loss
    months = [row for row in rows if row["section"] == "monthly"]
    assert len(months) == 12
    assert float(months[-1]["value"]) == 123
    assert all(set(row) == set(rows[0]) for row in rows)
    pdf = report_service.build_pdf(simulation)
    reader = PdfReader(BytesIO(pdf))
    text = "\n".join(page.extract_text() for page in reader.pages)
    assert len(reader.pages) == 2
    for value in (
        "799.50",
        f"{loss:g}%",
        "Ilidža",
        "Južni <krov> & terasa",
        "LONGi 435M",
        "December",
        "123.00",
        "already included",
        str(simulation.id),
    ):
        assert value in text
    assert simulation.model_dump() == before


def test_optimizer_uses_shared_panel_snapshot(simulation):
    saved = simulation.input_snapshot["surfaces"][0]
    simulation.input_snapshot["panel"] = saved.pop("panel")
    simulation.input_snapshot["source"] = "configuration_optimizer"
    rows = csv_rows(simulation)
    assert any(row["value"] == "Optimizer configuration" for row in rows)
    assert any(row["metric"] == "panel_model" and row["value"] == "435M" for row in rows)
    text = "\n".join(
        p.extract_text() for p in PdfReader(BytesIO(report_service.build_pdf(simulation))).pages
    )
    assert "Optimizer configuration" in text
    assert "LONGi 435M" in text


@pytest.mark.parametrize("name", ["=SUM(1,2)", " +cmd", "-formula", "@SUM(1)", "\t=1"])
def test_csv_neutralizes_spreadsheet_formulas(simulation, name):
    simulation.surface_results[0].name = name
    simulation.input_snapshot["location"]["location_label"] = name
    rows = csv_rows(simulation)
    assert all(row["name"] == "'" + name for row in rows if row["section"] == "surface")
    assert next(row["value"] for row in rows if row["metric"] == "location_label") == "'" + name


def test_csv_quotes_commas_quotes_and_newlines(simulation):
    name = 'Roof, "east"\nupper'
    simulation.surface_results[0].name = name
    assert next(row["name"] for row in csv_rows(simulation) if row["section"] == "surface") == name


def test_pdf_paginates_many_surfaces_and_long_labels(simulation):
    simulation.surface_results = [
        simulation.surface_results[0].model_copy(
            update={
                "roof_surface_id": uuid4(),
                "name": f"Surface {index} " + "long name " * 20,
            }
        )
        for index in range(25)
    ]
    simulation.input_snapshot["location"]["location_label"] = "Long location " * 40
    reader = PdfReader(BytesIO(report_service.build_pdf(simulation)))
    assert len(reader.pages) > 3
    text = "\n".join(page.extract_text() for page in reader.pages)
    assert "Surface 24" in text
    assert "Not recorded" in text
    assert all(
        f"Page {index}" in page.extract_text() for index, page in enumerate(reader.pages, start=1)
    )


@pytest.mark.asyncio
@pytest.mark.parametrize("format", ["pdf", "csv"])
async def test_report_route_uses_owner_scoped_snapshot(monkeypatch, simulation, format):
    owner_id = uuid4()
    session = AsyncMock()
    project_lookup = AsyncMock(return_value=SimpleNamespace(id=simulation.project_id))
    simulation_lookup = AsyncMock(return_value=simulation)
    monkeypatch.setattr(project_repository, "get_by_id_for_owner", project_lookup)
    monkeypatch.setattr(energy_simulation_repository, "get_by_id", simulation_lookup)
    app = create_app()
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=owner_id)
    app.dependency_overrides[get_db_session] = lambda: session
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as c:
        response = await c.get(
            f"/api/v1/projects/{simulation.project_id}/simulations/{simulation.id}/report",
            params={"format": format},
        )
    assert response.status_code == 200
    assert f"solarplan-{simulation.id}.{format}" in response.headers["content-disposition"]
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["content-type"].startswith(
        "application/pdf" if format == "pdf" else "text/csv"
    )
    assert response.content.startswith(b"%PDF" if format == "pdf" else b"\xef\xbb\xbf")
    project_lookup.assert_awaited_once_with(session, simulation.project_id, owner_id)
    simulation_lookup.assert_awaited_once_with(session, simulation.project_id, simulation.id)
    session.commit.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "scenario,status",
    [
        ("signed_out", 401),
        ("other_owner", 404),
        ("missing_simulation", 404),
        ("invalid_format", 422),
    ],
)
async def test_report_route_rejects_inaccessible_or_invalid_requests(
    monkeypatch,
    simulation,
    scenario,
    status,
):
    project_lookup = AsyncMock(return_value=None if scenario == "other_owner" else object())
    simulation_lookup = AsyncMock(return_value=None)
    monkeypatch.setattr(project_repository, "get_by_id_for_owner", project_lookup)
    monkeypatch.setattr(energy_simulation_repository, "get_by_id", simulation_lookup)
    app = create_app()
    app.dependency_overrides[get_db_session] = lambda: AsyncMock()
    if scenario != "signed_out":
        app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=uuid4())
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as c:
        response = await c.get(
            f"/api/v1/projects/{simulation.project_id}/simulations/{simulation.id}/report",
            params={"format": "xml" if scenario == "invalid_format" else "pdf"},
        )
    assert response.status_code == status
    if scenario in ("other_owner", "signed_out", "invalid_format"):
        simulation_lookup.assert_not_awaited()
