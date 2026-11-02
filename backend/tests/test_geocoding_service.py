from unittest.mock import AsyncMock

import httpx
import pytest

from app.core.exceptions import GeocodingProviderError, GeocodingResultNotFoundError
from app.services.geocoding_service import GeocodingService


def make_service(**overrides: object) -> GeocodingService:
    options = {
        "base_url": "https://provider.test",
        "user_agent": "SolarPlan/test",
        "referer": "https://github.com/przuljp/SolarPlan",
        "timeout_seconds": 2.0,
        "min_interval_seconds": 0.0,
        "cache_ttl_seconds": 60,
    }
    options.update(overrides)
    return GeocodingService(**options)


@pytest.mark.asyncio
async def test_search_normalizes_query_and_maps_provider_response() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(
            200,
            json=[
                {
                    "display_name": "Sarajevo, Bosnia and Herzegovina",
                    "lat": "43.8519774",
                    "lon": "18.3866868",
                    "category": "place",
                    "type": "city",
                }
            ],
        )

    async with httpx.AsyncClient(
        transport=httpx.MockTransport(handler),
        base_url="https://provider.test",
    ) as client:
        results = await make_service().search("  Sarajevo   Bosnia  ", 3, client=client)

    assert len(results) == 1
    assert results[0].display_name == "Sarajevo, Bosnia and Herzegovina"
    assert results[0].latitude == pytest.approx(43.8519774)
    assert results[0].longitude == pytest.approx(18.3866868)
    assert requests[0].url.path == "/search"
    assert requests[0].url.params["q"] == "Sarajevo Bosnia"
    assert requests[0].url.params["limit"] == "3"
    assert requests[0].headers["user-agent"] == "SolarPlan/test"
    assert requests[0].headers["referer"] == "https://github.com/przuljp/SolarPlan"


@pytest.mark.asyncio
async def test_search_uses_cache_for_repeated_query() -> None:
    call_count = 0

    def handler(_: httpx.Request) -> httpx.Response:
        nonlocal call_count
        call_count += 1
        return httpx.Response(
            200,
            json=[{"display_name": "Mostar", "lat": "43.3438", "lon": "17.8078"}],
        )

    service = make_service()
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(handler),
        base_url="https://provider.test",
    ) as client:
        first = await service.search("Mostar", 5, client=client)
        second = await service.search("  MOSTAR  ", 5, client=client)

    assert first == second
    assert call_count == 1


@pytest.mark.asyncio
async def test_service_waits_between_different_provider_requests() -> None:
    sleeper = AsyncMock()
    service = make_service(
        min_interval_seconds=1.0,
        clock=lambda: 100.0,
        sleeper=sleeper,
    )

    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=[])

    async with httpx.AsyncClient(
        transport=httpx.MockTransport(handler),
        base_url="https://provider.test",
    ) as client:
        await service.search("Sarajevo", 5, client=client)
        await service.search("Tuzla", 5, client=client)

    sleeper.assert_awaited_once_with(1.0)


@pytest.mark.asyncio
async def test_reverse_maps_address_for_coordinates() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/reverse"
        assert request.url.params["lat"] == "43.8563"
        assert request.url.params["lon"] == "18.4131"
        return httpx.Response(
            200,
            json={
                "display_name": "Sarajevo, Bosnia and Herzegovina",
                "lat": "43.8563",
                "lon": "18.4131",
                "category": "place",
                "type": "city",
            },
        )

    async with httpx.AsyncClient(
        transport=httpx.MockTransport(handler),
        base_url="https://provider.test",
    ) as client:
        result = await make_service().reverse(43.8563, 18.4131, client=client)

    assert result.display_name == "Sarajevo, Bosnia and Herzegovina"


@pytest.mark.asyncio
async def test_reverse_reports_missing_provider_result() -> None:
    transport = httpx.MockTransport(
        lambda _: httpx.Response(200, json={"error": "Unable to geocode"})
    )

    async with httpx.AsyncClient(
        transport=transport,
        base_url="https://provider.test",
    ) as client:
        with pytest.raises(GeocodingResultNotFoundError):
            await make_service().reverse(0, 0, client=client)


@pytest.mark.asyncio
async def test_provider_http_error_is_hidden_behind_domain_exception() -> None:
    transport = httpx.MockTransport(lambda _: httpx.Response(429))

    async with httpx.AsyncClient(
        transport=transport,
        base_url="https://provider.test",
    ) as client:
        with pytest.raises(GeocodingProviderError):
            await make_service().search("Sarajevo", 5, client=client)
