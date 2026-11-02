import asyncio
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

import httpx
from pydantic import ValidationError

from app.core.config import settings
from app.core.exceptions import GeocodingProviderError, GeocodingResultNotFoundError
from app.schemas.geocoding import GeocodingResult

Clock = Callable[[], float]
Sleeper = Callable[[float], Awaitable[None]]


@dataclass(frozen=True)
class CacheEntry:
    expires_at: float
    value: tuple[GeocodingResult, ...]


class GeocodingService:
    """Searches locations while isolating provider details from the rest of the app."""

    def __init__(
        self,
        *,
        base_url: str,
        user_agent: str,
        referer: str,
        timeout_seconds: float,
        min_interval_seconds: float,
        cache_ttl_seconds: int,
        clock: Clock = time.monotonic,
        sleeper: Sleeper = asyncio.sleep,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.headers = {
            "User-Agent": user_agent,
            "Referer": referer,
            "Accept-Language": "en",
        }
        self.timeout_seconds = timeout_seconds
        self.min_interval_seconds = min_interval_seconds
        self.cache_ttl_seconds = cache_ttl_seconds
        self.clock = clock
        self.sleeper = sleeper
        self._request_lock = asyncio.Lock()
        self._last_request_at: float | None = None
        self._cache: dict[str, CacheEntry] = {}

    async def search(
        self,
        query: str,
        limit: int,
        *,
        client: httpx.AsyncClient | None = None,
    ) -> list[GeocodingResult]:
        normalized_query = " ".join(query.split())
        cache_key = f"search:{normalized_query.casefold()}:{limit}"
        cached = self._get_cached(cache_key)
        if cached is not None:
            return list(cached)

        payload = await self._request(
            "/search",
            {
                "q": normalized_query,
                "format": "jsonv2",
                "addressdetails": 1,
                "limit": limit,
            },
            client=client,
        )
        if not isinstance(payload, list):
            raise GeocodingProviderError

        results = tuple(self._parse_result(item) for item in payload)
        self._cache[cache_key] = CacheEntry(
            expires_at=self.clock() + self.cache_ttl_seconds,
            value=results,
        )
        return list(results)

    async def reverse(
        self,
        latitude: float,
        longitude: float,
        *,
        client: httpx.AsyncClient | None = None,
    ) -> GeocodingResult:
        cache_key = f"reverse:{latitude:.6f}:{longitude:.6f}"
        cached = self._get_cached(cache_key)
        if cached is not None:
            return cached[0]

        payload = await self._request(
            "/reverse",
            {
                "lat": latitude,
                "lon": longitude,
                "format": "jsonv2",
                "addressdetails": 1,
                "zoom": 18,
            },
            client=client,
        )
        if not isinstance(payload, dict) or "error" in payload:
            raise GeocodingResultNotFoundError

        result = self._parse_result(payload)
        self._cache[cache_key] = CacheEntry(
            expires_at=self.clock() + self.cache_ttl_seconds,
            value=(result,),
        )
        return result

    def _get_cached(self, cache_key: str) -> tuple[GeocodingResult, ...] | None:
        entry = self._cache.get(cache_key)
        if entry is None:
            return None
        if entry.expires_at <= self.clock():
            del self._cache[cache_key]
            return None
        return entry.value

    async def _request(
        self,
        path: str,
        params: dict[str, Any],
        *,
        client: httpx.AsyncClient | None,
    ) -> Any:
        async with self._request_lock:
            await self._respect_rate_limit()
            try:
                if client is not None:
                    response = await client.get(path, params=params, headers=self.headers)
                else:
                    async with httpx.AsyncClient(
                        base_url=self.base_url,
                        timeout=self.timeout_seconds,
                    ) as owned_client:
                        response = await owned_client.get(path, params=params, headers=self.headers)
                self._last_request_at = self.clock()
                response.raise_for_status()
                return response.json()
            except (httpx.HTTPError, ValueError) as error:
                raise GeocodingProviderError from error

    async def _respect_rate_limit(self) -> None:
        if self._last_request_at is None:
            return
        elapsed = self.clock() - self._last_request_at
        delay = self.min_interval_seconds - elapsed
        if delay > 0:
            await self.sleeper(delay)

    @staticmethod
    def _parse_result(payload: Any) -> GeocodingResult:
        if not isinstance(payload, dict):
            raise GeocodingProviderError
        try:
            return GeocodingResult(
                display_name=payload["display_name"],
                latitude=float(payload["lat"]),
                longitude=float(payload["lon"]),
                category=payload.get("category"),
                type=payload.get("type"),
            )
        except (KeyError, TypeError, ValueError, ValidationError) as error:
            raise GeocodingProviderError from error


geocoding_service = GeocodingService(
    base_url=settings.geocoding_base_url,
    user_agent=settings.geocoding_user_agent,
    referer=settings.geocoding_referer,
    timeout_seconds=settings.geocoding_timeout_seconds,
    min_interval_seconds=settings.geocoding_min_interval_seconds,
    cache_ttl_seconds=settings.geocoding_cache_ttl_seconds,
)
