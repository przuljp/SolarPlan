from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql

from app.db.base import Base
from app.models import (
    PanelLayout,
    Project,
    ProjectLocation,
    ProjectStatus,
    RoofSurface,
    SolarPanel,
    User,
)


def test_expected_tables_are_registered() -> None:
    assert {
        "users",
        "solar_projects",
        "project_locations",
        "roof_surfaces",
        "solar_panels",
        "panel_layouts",
    }.issubset(Base.metadata.tables)


def test_project_owner_foreign_key_cascades_on_delete() -> None:
    owner_key = next(
        key for key in inspect(Project).local_table.foreign_keys if key.parent.name == "user_id"
    )
    assert owner_key.target_fullname == "users.id"
    assert owner_key.ondelete == "CASCADE"


def test_project_status_values_match_the_api_contract() -> None:
    assert [status.value for status in ProjectStatus] == ["draft", "ready_for_analysis", "analyzed"]


def test_location_is_unique_per_project() -> None:
    project_id = ProjectLocation.__table__.c.project_id
    key = next(iter(project_id.foreign_keys))
    assert project_id.unique is True
    assert key.ondelete == "CASCADE"


def test_roof_surface_belongs_to_project() -> None:
    project_id = RoofSurface.__table__.c.project_id
    key = next(iter(project_id.foreign_keys))
    assert project_id.unique is not True
    assert key.ondelete == "CASCADE"


def test_panel_layout_is_unique_per_surface_and_restricts_panel_deletion() -> None:
    surface_id = PanelLayout.__table__.c.roof_surface_id
    surface_key = next(iter(surface_id.foreign_keys))
    panel_key = next(iter(PanelLayout.__table__.c.solar_panel_id.foreign_keys))
    assert surface_id.unique is True
    assert surface_key.ondelete == "CASCADE"
    assert panel_key.ondelete == "RESTRICT"


def test_user_email_has_case_insensitive_unique_index() -> None:
    index = next(item for item in User.__table__.indexes if item.name == "uq_users_email_lower")
    expression_sql = str(
        index.expressions[0].compile(
            dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}
        )
    )
    assert index.unique is True
    assert expression_sql == "lower(users.email)"


def test_solar_panel_sku_is_unique() -> None:
    assert SolarPanel.__table__.c.model_sku.unique is True
