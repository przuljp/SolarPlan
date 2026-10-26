from uuid import uuid4

from sqlalchemy.dialects import postgresql

from app.repositories import project_repository


def test_project_lookup_scopes_query_by_project_and_owner() -> None:
    project_id = uuid4()
    owner_id = uuid4()
    statement = project_repository.owned_project_statement(project_id, owner_id)

    sql = str(
        statement.compile(
            dialect=postgresql.dialect(),
            compile_kwargs={"literal_binds": True},
        )
    )
    assert f"solar_projects.id = '{project_id}'" in sql
    assert f"solar_projects.user_id = '{owner_id}'" in sql
