from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql

from app.db.base import Base
from app.models import Project, ProjectStatus, User


def test_expected_tables_are_registered() -> None:
    assert {"users", "solar_projects"}.issubset(Base.metadata.tables)


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
