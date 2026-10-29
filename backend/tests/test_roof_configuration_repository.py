from uuid import uuid4

from sqlalchemy.dialects import postgresql

from app.repositories import roof_configuration_repository


def test_roof_configuration_lookup_scopes_query_by_project() -> None:
    project_id = uuid4()
    statement = roof_configuration_repository.by_project_statement(project_id)
    sql = str(
        statement.compile(
            dialect=postgresql.dialect(),
            compile_kwargs={"literal_binds": True},
        )
    )

    assert f"roof_configurations.project_id = '{project_id}'" in sql
