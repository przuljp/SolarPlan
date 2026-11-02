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


def test_location_and_multiple_surface_routes_are_exposed() -> None:
    paths = app.openapi()["paths"]
    assert {"get", "put"}.issubset(paths["/api/v1/projects/{project_id}/location"])
    assert {"get", "post"}.issubset(paths["/api/v1/projects/{project_id}/roof-surfaces"])
    assert {"get", "put", "delete"}.issubset(
        paths["/api/v1/projects/{project_id}/roof-surfaces/{surface_id}"]
    )


def test_geocoding_routes_are_exposed_and_protected() -> None:
    paths = app.openapi()["paths"]
    assert paths["/api/v1/geocoding/search"]["get"]["security"] == [{"HTTPBearer": []}]
    assert paths["/api/v1/geocoding/reverse"]["get"]["security"] == [{"HTTPBearer": []}]


def test_panel_catalog_and_surface_layout_routes_are_exposed() -> None:
    paths = app.openapi()["paths"]
    layout = "/api/v1/projects/{project_id}/roof-surfaces/{surface_id}/layout"
    assert "get" in paths["/api/v1/panels"]
    assert "get" in paths["/api/v1/panels/{panel_id}"]
    assert "post" in paths[f"{layout}/preview"]
    assert {"get", "put"}.issubset(paths[layout])
    protected = [
        paths["/api/v1/panels"]["get"],
        paths[f"{layout}/preview"]["post"],
        paths[layout]["get"],
        paths[layout]["put"],
    ]
    assert all(operation["security"] == [{"HTTPBearer": []}] for operation in protected)
