from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.core.exceptions import GeocodingProviderError, GeocodingResultNotFoundError
from app.routers.geocoding import reverse_location, search_locations
from app.services.geocoding_service import geocoding_service


@pytest.mark.asyncio
async def test_search_maps_provider_failure_to_recoverable_http_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    search = AsyncMock(side_effect=GeocodingProviderError)
    monkeypatch.setattr(geocoding_service, "search", search)

    with pytest.raises(HTTPException) as caught:
        await search_locations(object(), "Sarajevo", 5)

    assert caught.value.status_code == 503
    assert caught.value.detail["code"] == "geocoding_unavailable"


@pytest.mark.asyncio
async def test_reverse_maps_missing_address_to_not_found(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    reverse = AsyncMock(side_effect=GeocodingResultNotFoundError)
    monkeypatch.setattr(geocoding_service, "reverse", reverse)

    with pytest.raises(HTTPException) as caught:
        await reverse_location(object(), 43.8563, 18.4131)

    assert caught.value.status_code == 404
    assert caught.value.detail["code"] == "location_not_found"


@pytest.mark.asyncio
async def test_reverse_maps_provider_failure_to_recoverable_http_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    reverse = AsyncMock(side_effect=GeocodingProviderError)
    monkeypatch.setattr(geocoding_service, "reverse", reverse)

    with pytest.raises(HTTPException) as caught:
        await reverse_location(object(), 43.8563, 18.4131)

    assert caught.value.status_code == 503
    assert caught.value.detail["code"] == "geocoding_unavailable"
