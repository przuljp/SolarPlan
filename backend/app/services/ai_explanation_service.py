import hashlib
import json
import time
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AiInvalidResponseError, AiNotConfiguredError, AiRateLimitError
from app.integrations.openai_client import OpenAiClient, openai_client
from app.repositories import consumption_repository
from app.schemas.ai_explanation import ExplanationRead, ExplanationRequest
from app.schemas.energy_simulation import EnergySimulationRead
from app.services import energy_comparison_service, energy_simulation_service
from app.services.explanation_evidence import evidence_values, resolve_evidence

PROMPT_VERSION = "solarplan-explanation-v2-evidence"
CACHE_TTL_SECONDS = 3600
REQUEST_INTERVAL_SECONDS = 10
MAX_CACHE_ENTRIES = 128


def simulation_facts(simulation: EnergySimulationRead) -> dict[str, Any]:
    """Allowlist energy data; never send names, addresses, coordinates or user IDs."""
    return {
        "source": (
            "configuration_optimizer"
            if simulation.input_snapshot.get("source") == "configuration_optimizer"
            else "manual_analysis"
        ),
        "provider": "PVGIS",
        "system_loss_percent": simulation.system_loss_percent,
        "installed_kwp": simulation.installed_kwp,
        "annual_kwh": simulation.annual_kwh,
        "specific_yield_kwh_per_kwp": simulation.specific_yield_kwh_per_kwp,
        "monthly_results": [item.model_dump() for item in simulation.monthly_results],
        "surfaces": [
            surface.model_dump(exclude={"name", "roof_surface_id", "pvgis_aspect"})
            for surface in simulation.surface_results
        ],
    }


class ExplanationService:
    """Owner-scoped, bounded process-local cache and request throttling."""

    def __init__(self, client: OpenAiClient = openai_client, *, clock=time.monotonic):
        self.client = client
        self.clock = clock
        self.cache: dict[str, tuple[float, ExplanationRead]] = {}
        self.last_request: dict[UUID, float] = {}
        self.in_flight: set[UUID] = set()

    async def explain(
        self,
        session: AsyncSession,
        project_id: UUID,
        simulation_id: UUID,
        owner_id: UUID,
        request: ExplanationRequest,
    ) -> ExplanationRead:
        # Check ownership and simulation membership even on a cache hit or without a key.
        saved = await energy_simulation_service.get_simulation(
            session, project_id, simulation_id, owner_id
        )
        simulation = EnergySimulationRead.model_validate(saved)
        facts: dict[str, Any] = {
            "simulation": simulation_facts(simulation),
            "comparison": None,
            "consumption": None,
        }
        if request.comparison_simulation_id is not None:
            comparison = await energy_simulation_service.compare_simulations(
                session, project_id, simulation_id, request.comparison_simulation_id, owner_id
            )
            facts["comparison"] = comparison.model_dump(
                mode="json",
                exclude={
                    "baseline": {"id", "project_id", "created_at"},
                    "comparison": {"id", "project_id", "created_at"},
                },
            )
            # Preserve the agreed system-level comparison without per-roof differences.
            facts["simulation"].pop("surfaces")

        consumption_updated_at = None
        if request.include_current_consumption:
            profile = await consumption_repository.get_by_project_id(session, project_id)
            if profile is not None:
                energy = energy_comparison_service.build_energy_comparison(saved, profile)
                facts["consumption"] = energy.model_dump(
                    exclude={
                        "project_id",
                        "simulation_id",
                        "consumption_profile_id",
                        "annual_production_kwh",
                    }
                )
                consumption_updated_at = profile.updated_at
        if not self.client.available:
            raise AiNotConfiguredError

        values = evidence_values(facts)
        facts["display_values"] = values

        canonical = json.dumps(
            {
                "owner_id": str(owner_id),
                "project_id": str(project_id),
                "simulation_id": str(simulation_id),
                "request": request.model_dump(mode="json"),
                "consumption_updated_at": (
                    consumption_updated_at.isoformat() if consumption_updated_at else None
                ),
                "model": self.client.config.openai_model,
                "prompt_version": PROMPT_VERSION,
                "facts": facts,
            },
            sort_keys=True,
            allow_nan=False,
        )
        key = hashlib.sha256(canonical.encode()).hexdigest()
        now = self.clock()
        self.cache = {k: v for k, v in self.cache.items() if now - v[0] < CACHE_TTL_SECONDS}
        self.last_request = {
            user: timestamp
            for user, timestamp in self.last_request.items()
            if now - timestamp < REQUEST_INTERVAL_SECONDS
        }
        if key in self.cache:
            return self.cache[key][1].model_copy(update={"cached": True}, deep=True)
        if owner_id in self.in_flight or owner_id in self.last_request:
            raise AiRateLimitError
        # Bound state under many concurrent users as well as the result cache.
        if len(self.in_flight) >= MAX_CACHE_ENTRIES or len(self.last_request) >= MAX_CACHE_ENTRIES:
            raise AiRateLimitError
        self.last_request[owner_id] = now
        self.in_flight.add(owner_id)
        try:
            content = await self.client.explain(facts)
            if (content.consumption_insights is not None) != (facts["consumption"] is not None) or (
                content.comparison_insights is not None
            ) != (facts["comparison"] is not None):
                raise AiInvalidResponseError
            content = resolve_evidence(content, values)
            result = ExplanationRead(
                simulation_id=simulation_id,
                comparison_simulation_id=request.comparison_simulation_id,
                consumption_included=facts["consumption"] is not None,
                consumption_updated_at=consumption_updated_at,
                content=content,
                model=self.client.config.openai_model,
                generated_at=datetime.now(UTC),
            )
            if len(self.cache) >= MAX_CACHE_ENTRIES:
                self.cache.pop(next(iter(self.cache)))
            self.cache[key] = (self.clock(), result.model_copy(deep=True))
            return result
        finally:
            self.in_flight.discard(owner_id)


explanation_service = ExplanationService()
