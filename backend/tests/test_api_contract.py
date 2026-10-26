from app.main import app


def test_authentication_routes_are_exposed_by_openapi() -> None:
    paths = app.openapi()["paths"]

    assert "post" in paths["/api/v1/auth/register"]
    assert "post" in paths["/api/v1/auth/login"]
    assert "post" in paths["/api/v1/auth/logout"]
    assert "get" in paths["/api/v1/users/me"]


def test_logout_requires_bearer_authentication() -> None:
    logout_operation = app.openapi()["paths"]["/api/v1/auth/logout"]["post"]

    assert logout_operation["security"] == [{"HTTPBearer": []}]
