from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

import httpx

from app.core.config import settings
from app.core.exceptions import PvgisInvalidResponseError, PvgisUnavailableError


@dataclass(frozen=True, slots=True)
class PvgisParameters:
    lat: float
    lon: float
    peakpower: float
    angle: float
    aspect: float
    loss: float
    pvtechchoice: str = "crystSi"
    mountingplace: str = "free"

    def query_params(self) -> dict[str, str | float]:
        return {
            "lat": self.lat,
            "lon": self.lon,
            "peakpower": self.peakpower,
            "angle": self.angle,
            "aspect": self.aspect,
            "loss": self.loss,
            "pvtechchoice": self.pvtechchoice,
            "mountingplace": self.mountingplace,
            "outputformat": "json",
        }


@dataclass(frozen=True, slots=True)
class PvgisMonthlyEstimate:
    month: int
    energy_kwh: float


@dataclass(frozen=True, slots=True)
class PvgisEstimate:
    annual_kwh: float
    monthly_results: tuple[PvgisMonthlyEstimate, ...]

    def as_dict(self) -> dict[str, Any]:
        return {
            "annual_kwh": self.annual_kwh,
            "monthly_results": [
                {"month": item.month, "energy_kwh": item.energy_kwh}
                for item in self.monthly_results
            ],
        }


class PvgisClient:
    """Versioned PVGIS adapter that hides provider response details from the app."""

    def __init__(
        self,
        *,
        base_url: str = settings.pvgis_base_url,
        timeout_seconds: float = settings.pvgis_timeout_seconds,
        max_retries: int = settings.pvgis_max_retries,
        retry_backoff_seconds: float = settings.pvgis_retry_backoff_seconds,
        sleeper: Callable[[float], Awaitable[None]] = asyncio.sleep,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds
        self.max_retries = max_retries
        self.retry_backoff_seconds = retry_backoff_seconds
        self.sleeper = sleeper

    async def calculate(
        self,
        parameters: PvgisParameters,
        *,
        client: httpx.AsyncClient | None = None,
    ) -> PvgisEstimate:
        owns_client = client is None
        active_client = client or httpx.AsyncClient(
            base_url=self.base_url,
            timeout=self.timeout_seconds,
            headers={"User-Agent": "SolarPlan/0.1"},
        )
        try:
            response = await self._request_with_retry(active_client, parameters)
            try:
                payload = response.json()
            except ValueError as error:
                raise PvgisInvalidResponseError from error
            return self._normalize(payload)
        finally:
            if owns_client:
                await active_client.aclose()

    async def _request_with_retry(
        self,
        client: httpx.AsyncClient,
        parameters: PvgisParameters,
    ) -> httpx.Response:
        for attempt in range(self.max_retries + 1):
            try:
                response = await client.get("/PVcalc", params=parameters.query_params())
            except httpx.RequestError as error:
                if attempt == self.max_retries:
                    raise PvgisUnavailableError from error
                await self._backoff(attempt)
                continue

            if response.status_code in {429, 529} or response.status_code >= 500:
                if attempt == self.max_retries:
                    raise PvgisUnavailableError
                await self._backoff(attempt, response)
                continue
            if response.is_error:
                raise PvgisUnavailableError
            return response
        raise PvgisUnavailableError

    async def _backoff(self, attempt: int, response: httpx.Response | None = None) -> None:
        retry_after = response.headers.get("Retry-After") if response is not None else None
        try:
            delay = float(retry_after) if retry_after is not None else None
        except ValueError:
            delay = None
        await self.sleeper(delay or self.retry_backoff_seconds * (2**attempt))

    @staticmethod
    def _normalize(payload: Any) -> PvgisEstimate:
        try:
            monthly_raw = payload["outputs"]["monthly"]["fixed"]
            annual_kwh = float(payload["outputs"]["totals"]["fixed"]["E_y"])
            monthly = tuple(
                PvgisMonthlyEstimate(
                    month=int(item["month"]),
                    energy_kwh=float(item["E_m"]),
                )
                for item in monthly_raw
            )
        except (KeyError, TypeError, ValueError) as error:
            raise PvgisInvalidResponseError from error

        if len(monthly) != 12 or {item.month for item in monthly} != set(range(1, 13)):
            raise PvgisInvalidResponseError
        if annual_kwh < 0 or any(item.energy_kwh < 0 for item in monthly):
            raise PvgisInvalidResponseError
        return PvgisEstimate(annual_kwh=annual_kwh, monthly_results=monthly)


pvgis_client = PvgisClient()
