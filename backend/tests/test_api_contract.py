from app.main import app


def test_authentication_routes_are_exposed_by_openapi() -> None:
    paths = app.openapi()["paths"]

    assert "post" in paths["/api/v1/auth/register"]
    assert "post" in paths["/api/v1/auth/login"]
    assert "post" in paths["/api/v1/auth/logout"]
    assert "get" in paths["/api/v1/users/me"]


def test_project_crud_routes_are_exposed_and_protected() -> None:
    paths = app.openapi()["paths"]

    assert {"get", "post"}.issubset(paths["/api/v1/projects"])
    assert {"get", "patch", "delete"}.issubset(paths["/api/v1/projects/{project_id}"])

    for operation in paths["/api/v1/projects"].values():
        assert operation["security"] == [{"HTTPBearer": []}]
    for operation in paths["/api/v1/projects/{project_id}"].values():
        assert operation["security"] == [{"HTTPBearer": []}]


def test_logout_requires_bearer_authentication() -> None:
    logout_operation = app.openapi()["paths"]["/api/v1/auth/logout"]["post"]

    assert logout_operation["security"] == [{"HTTPBearer": []}]


def test_custom_authentication_errors_are_documented() -> None:
    paths = app.openapi()["paths"]

    assert "409" in paths["/api/v1/auth/register"]["post"]["responses"]
    assert "401" in paths["/api/v1/auth/login"]["post"]["responses"]
    assert "401" in paths["/api/v1/users/me"]["get"]["responses"]
