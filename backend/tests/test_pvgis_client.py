from unittest.mock import AsyncMock

import httpx
import pytest

from app.core.exceptions import PvgisInvalidResponseError, PvgisUnavailableError
from app.integrations.pvgis_client import PvgisClient, PvgisParameters


def provider_payload(multiplier: float = 1.0) -> dict:
    monthly = [
        {"month": month, "E_m": round(month * 10.0 * multiplier, 2)} for month in range(1, 13)
    ]
    return {
        "outputs": {
            "monthly": {"fixed": monthly},
            "totals": {"fixed": {"E_y": round(sum(item["E_m"] for item in monthly), 2)}},
        }
    }


@pytest.mark.asyncio
async def test_client_sends_documented_parameters_and_normalizes_response() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, json=provider_payload())

    parameters = PvgisParameters(
        lat=43.8563,
        lon=18.4131,
        peakpower=6.525,
        angle=30,
        aspect=0,
        loss=14,
    )
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(handler),
        base_url="https://provider.test",
    ) as http_client:
        result = await PvgisClient(base_url="https://provider.test").calculate(
            parameters,
            client=http_client,
        )

    assert requests[0].url.path == "/PVcalc"
    assert requests[0].url.params["peakpower"] == "6.525"
    assert requests[0].url.params["pvtechchoice"] == "crystSi"
    assert requests[0].url.params["mountingplace"] == "free"
    assert requests[0].url.params["outputformat"] == "json"
    assert result.annual_kwh == pytest.approx(780)
    assert len(result.monthly_results) == 12
    assert result.monthly_results[0].energy_kwh == pytest.approx(10)


@pytest.mark.asyncio
async def test_client_retries_rate_limit_with_bounded_backoff() -> None:
    calls = 0
    sleeper = AsyncMock()

    def handler(_: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        if calls < 3:
            return httpx.Response(429, headers={"Retry-After": "0.1"})
        return httpx.Response(200, json=provider_payload())

    async with httpx.AsyncClient(
        transport=httpx.MockTransport(handler),
        base_url="https://provider.test",
    ) as http_client:
        result = await PvgisClient(
            base_url="https://provider.test",
            max_retries=2,
            sleeper=sleeper,
        ).calculate(
            PvgisParameters(43.8, 18.4, 1, 30, 0, 14),
            client=http_client,
        )

    assert result.annual_kwh == pytest.approx(780)
    assert calls == 3
    assert sleeper.await_count == 2
    sleeper.assert_any_await(0.1)


@pytest.mark.asyncio
async def test_client_stops_after_retry_limit() -> None:
    sleeper = AsyncMock()
    transport = httpx.MockTransport(lambda _: httpx.Response(529))

    async with httpx.AsyncClient(
        transport=transport,
        base_url="https://provider.test",
    ) as http_client:
        with pytest.raises(PvgisUnavailableError):
            await PvgisClient(
                base_url="https://provider.test",
                max_retries=1,
                sleeper=sleeper,
            ).calculate(
                PvgisParameters(43.8, 18.4, 1, 30, 0, 14),
                client=http_client,
            )

    assert sleeper.await_count == 1


@pytest.mark.asyncio
async def test_client_maps_other_request_errors_to_provider_unavailable() -> None:
    sleeper = AsyncMock()
    request = httpx.Request("GET", "https://provider.test/PVcalc")
    http_client = AsyncMock(spec=httpx.AsyncClient)
    http_client.get.side_effect = httpx.RemoteProtocolError(
        "Provider disconnected.",
        request=request,
    )

    with pytest.raises(PvgisUnavailableError):
        await PvgisClient(
            base_url="https://provider.test",
            max_retries=1,
            sleeper=sleeper,
        ).calculate(
            PvgisParameters(43.8, 18.4, 1, 30, 0, 14),
            client=http_client,
        )

    assert sleeper.await_count == 1
    assert http_client.get.await_count == 2


@pytest.mark.asyncio
async def test_client_rejects_incomplete_provider_schema() -> None:
    transport = httpx.MockTransport(
        lambda _: httpx.Response(200, json={"outputs": {"monthly": {"fixed": []}}})
    )
    async with httpx.AsyncClient(
        transport=transport,
        base_url="https://provider.test",
    ) as http_client:
        with pytest.raises(PvgisInvalidResponseError):
            await PvgisClient(base_url="https://provider.test").calculate(
                PvgisParameters(43.8, 18.4, 1, 30, 0, 14),
                client=http_client,
            )
