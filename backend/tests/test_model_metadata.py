from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql

from app.db.base import Base
from app.models import Project, ProjectStatus, RoofConfiguration, User


def test_expected_tables_are_registered() -> None:
    assert {"users", "solar_projects", "roof_configurations"}.issubset(Base.metadata.tables)


def test_project_owner_foreign_key_cascades_on_delete() -> None:
    foreign_keys = inspect(Project).local_table.foreign_keys
    owner_key = next(key for key in foreign_keys if key.parent.name == "user_id")

    assert owner_key.target_fullname == "users.id"
    assert owner_key.ondelete == "CASCADE"


def test_project_status_values_match_the_api_contract() -> None:
    assert [status.value for status in ProjectStatus] == [
        "draft",
        "ready_for_analysis",
        "analyzed",
    ]


def test_roof_configuration_belongs_to_one_project_and_cascades_on_delete() -> None:
    project_id = RoofConfiguration.__table__.c.project_id
    foreign_key = next(iter(project_id.foreign_keys))

    assert project_id.unique is True
    assert foreign_key.target_fullname == "solar_projects.id"
    assert foreign_key.ondelete == "CASCADE"


def test_roof_configuration_has_database_safety_constraints() -> None:
    constraint_names = {
        constraint.name
        for constraint in RoofConfiguration.__table__.constraints
        if constraint.name is not None
    }

    assert {
        "ck_roof_configurations_width_positive",
        "ck_roof_configurations_length_positive",
        "ck_roof_configurations_tilt_range",
        "ck_roof_configurations_azimuth_range",
        "ck_roof_configurations_edge_margin_nonnegative",
        "ck_roof_configurations_panel_gap_nonnegative",
        "ck_roof_configurations_usable_area",
        "ck_roof_configurations_latitude_range",
        "ck_roof_configurations_longitude_range",
    }.issubset(constraint_names)


def test_user_email_has_case_insensitive_unique_index() -> None:
    index = next(item for item in User.__table__.indexes if item.name == "uq_users_email_lower")
    expression_sql = str(
        index.expressions[0].compile(
            dialect=postgresql.dialect(),
            compile_kwargs={"literal_binds": True},
        )
    )

    assert index.unique is True
    assert expression_sql == "lower(users.email)"
