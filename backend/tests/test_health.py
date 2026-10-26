from app.routers.health import health_check


def test_health_check() -> None:
    response = health_check()

    assert response.status == "ok"
    assert response.service == "solarplan-api"
