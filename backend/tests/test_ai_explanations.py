import asyncio
import json
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import httpx
import pytest
from pydantic import SecretStr, ValidationError
from test_reports import simulation as simulation

from app.core.config import Settings
from app.core.exceptions import (
    AiInvalidResponseError,
    AiNotConfiguredError,
    AiRateLimitError,
    AiRefusalError,
    AiUnavailableError,
    EnergySimulationNotFoundError,
    ProjectNotFoundError,
)
from app.db.session import get_db_session
from app.dependencies.auth import get_current_user
from app.integrations.openai_client import OpenAiClient
from app.main import create_app
from app.repositories import (
    consumption_repository,
    energy_simulation_repository,
    project_repository,
)
from app.routers import ai_explanations
from app.schemas.ai_explanation import ExplanationContent, ExplanationRequest
from app.services import energy_simulation_service
from app.services.ai_explanation_service import ExplanationService


def narrative(**changes):
    return ExplanationContent(
        **{
            "summary": (
                "This system has {{simulation.installed_kwp}} "
                "and produces {{simulation.annual_kwh}} annually."
            ),
            "production_insights": ["Losses of {{simulation.system_loss_percent}} are included."],
            "seasonal_insights": (
                "The first saved month produces {{simulation.monthly_results.0.energy_kwh}}."
            ),
            "consumption_insights": None,
            "comparison_insights": None,
            "limitations": ["Actual weather and nearby shading can affect production."],
            **changes,
        }
    )


def config(**changes):
    return Settings(_env_file=None, openai_api_key=SecretStr("test-placeholder"), **changes)


def provider_response(content=None, **changes):
    return {
        "status": "completed",
        "output": [
            {
                "type": "message",
                "content": [
                    {"type": "output_text", "text": (content or narrative()).model_dump_json()},
                ],
            }
        ],
        **changes,
    }


@pytest.mark.asyncio
async def test_responses_request_schema_storage_and_authorization():
    def handle(request):
        body = json.loads(request.content)
        assert request.url == "https://api.openai.com/v1/responses"
        assert request.headers["authorization"] == "Bearer test-placeholder"
        assert body["store"] is False
        assert body["model"] == "gpt-5-mini"
        assert body["max_output_tokens"] == 4000
        assert body["reasoning"] == {"effort": "low"}
        assert body["text"]["format"]["strict"] is True
        assert body["text"]["format"]["schema"]["additionalProperties"] is False
        assert "tools" not in body
        assert json.loads(body["input"]) == {"annual_kwh": 1234}
        return httpx.Response(200, json=provider_response())

    async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as http:
        result = await OpenAiClient(config()).explain({"annual_kwh": 1234}, client=http)
    assert result == narrative()


@pytest.mark.asyncio
@pytest.mark.parametrize("status", [400, 401, 429, 500])
async def test_provider_errors_hide_details_and_never_retry(status):
    calls = []

    def handle(request):
        calls.append(request)
        return httpx.Response(status, json={"error": "private provider details"})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as http:
        with pytest.raises(AiUnavailableError) as error:
            await OpenAiClient(config()).explain({}, client=http)
    assert len(calls) == 1
    assert "private" not in str(error.value)


@pytest.mark.asyncio
async def test_timeout_is_controlled():
    def handle(request):
        raise httpx.ReadTimeout("secret request context", request=request)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as http:
        with pytest.raises(AiUnavailableError):
            await OpenAiClient(config()).explain({}, client=http)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "payload",
    [
        {"status": "incomplete", "output": []},
        {"status": "completed", "output": []},
        {"status": "completed", "output": [None]},
        {
            "status": "completed",
            "output": [
                {
                    "type": "message",
                    "content": [
                        {"type": "output_text", "text": "not json"},
                    ],
                }
            ],
        },
    ],
)
async def test_invalid_and_incomplete_output_is_rejected(payload):
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda request: httpx.Response(200, json=payload))
    ) as http:
        with pytest.raises(AiInvalidResponseError):
            await OpenAiClient(config()).explain({}, client=http)


@pytest.mark.asyncio
async def test_refusal_is_not_presented_as_an_explanation():
    payload = {
        "status": "completed",
        "output": [
            {
                "type": "message",
                "content": [
                    {"type": "refusal", "refusal": "provider refusal text"},
                ],
            }
        ],
    }
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda request: httpx.Response(200, json=payload))
    ) as http:
        with pytest.raises(AiRefusalError):
            await OpenAiClient(config()).explain({}, client=http)


def test_resolved_numbers_are_allowed_but_unexpected_fields_are_rejected():
    assert narrative(summary="Saved production is 9000 kWh.").summary
    with pytest.raises(ValidationError):
        ExplanationContent.model_validate({**narrative().model_dump(), "annual_kwh": 9000})


@pytest.mark.asyncio
async def test_missing_key_does_not_call_provider():
    client = OpenAiClient(Settings(_env_file=None, openai_api_key=SecretStr("")))
    assert client.available is False
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda request: pytest.fail("Provider must not be called"))
    ) as http:
        with pytest.raises(AiNotConfiguredError):
            await client.explain({}, client=http)


def stub_reads(monkeypatch, simulation):
    project = AsyncMock(return_value=SimpleNamespace(id=simulation.project_id))
    lookup = AsyncMock(return_value=simulation)
    monkeypatch.setattr(project_repository, "get_by_id_for_owner", project)
    monkeypatch.setattr(energy_simulation_repository, "get_by_id", lookup)
    return project, lookup


def fake_client(content=None):
    return SimpleNamespace(
        available=True,
        config=config(),
        explain=AsyncMock(return_value=content or narrative()),
    )


@pytest.mark.asyncio
async def test_cache_checks_ownership_and_preserves_snapshot(monkeypatch, simulation):
    project, lookup = stub_reads(monkeypatch, simulation)
    session, owner = AsyncMock(), uuid4()
    before = simulation.model_dump()
    client = fake_client()
    service = ExplanationService(client)
    request = ExplanationRequest()
    first = await service.explain(session, simulation.project_id, simulation.id, owner, request)
    second = await service.explain(session, simulation.project_id, simulation.id, owner, request)
    assert first.cached is False and second.cached is True
    assert first.generated_at == second.generated_at
    assert project.await_count == 2 and lookup.await_count == 2
    assert client.explain.await_count == 1
    session.commit.assert_not_awaited()
    assert simulation.model_dump() == before
    serialized = json.dumps(client.explain.call_args.args[0])
    for private in ("Ilidža", "Južni", str(simulation.id), str(simulation.project_id), "location"):
        assert private not in serialized
    assert client.explain.call_args.args[0]["simulation"]["annual_kwh"] == 799.5
    assert client.explain.call_args.args[0]["simulation"]["system_loss_percent"] == 9.5
    project.return_value = None
    with pytest.raises(ProjectNotFoundError):
        await service.explain(session, simulation.project_id, simulation.id, owner, request)


@pytest.mark.asyncio
async def test_cache_is_owner_scoped_and_invalidated_by_changed_data(monkeypatch, simulation):
    stub_reads(monkeypatch, simulation)
    client, clock = fake_client(), [100.0]
    service = ExplanationService(client, clock=lambda: clock[0])
    session, owner = AsyncMock(), uuid4()
    await service.explain(
        session, simulation.project_id, simulation.id, owner, ExplanationRequest()
    )
    await service.explain(
        session, simulation.project_id, simulation.id, uuid4(), ExplanationRequest()
    )
    assert client.explain.await_count == 2
    clock[0] += 11
    simulation.system_loss_percent = 14
    await service.explain(
        session, simulation.project_id, simulation.id, owner, ExplanationRequest()
    )
    assert client.explain.await_count == 3
    clock[0] += 3601
    await service.explain(
        session, simulation.project_id, simulation.id, owner, ExplanationRequest()
    )
    assert client.explain.await_count == 4


@pytest.mark.asyncio
async def test_rate_limit_and_in_flight_requests(monkeypatch, simulation):
    stub_reads(monkeypatch, simulation)
    client = fake_client()
    started, finish = asyncio.Event(), asyncio.Event()

    async def explain(facts):
        started.set()
        await finish.wait()
        return narrative()

    client.explain.side_effect = explain
    service, session, owner = ExplanationService(client), AsyncMock(), uuid4()
    first = asyncio.create_task(
        service.explain(session, simulation.project_id, simulation.id, owner, ExplanationRequest())
    )
    await started.wait()
    try:
        with pytest.raises(AiRateLimitError):
            await service.explain(
                session,
                simulation.project_id,
                simulation.id,
                owner,
                ExplanationRequest(include_current_consumption=False),
            )
    finally:
        finish.set()
        await first


@pytest.mark.asyncio
async def test_partial_consumption_is_optional_and_uses_selected_simulation(
    monkeypatch, simulation
):
    stub_reads(monkeypatch, simulation)
    profile = SimpleNamespace(
        id=uuid4(),
        project_id=simulation.project_id,
        source="manual",
        annual_consumption_kwh=None,
        monthly_values=[{"month": 1, "consumption_kwh": 100}],
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    read = AsyncMock(return_value=profile)
    monkeypatch.setattr(consumption_repository, "get_by_project_id", read)
    client = fake_client(
        narrative(
            consumption_insights="Known consumption months: {{consumption.known_months}}."
        )
    )
    # Real service normally receives an ORM object with JSON dictionaries.
    saved = SimpleNamespace(**simulation.model_dump(mode="json"))
    saved.created_at = simulation.created_at
    monkeypatch.setattr(energy_simulation_service, "get_simulation", AsyncMock(return_value=saved))
    service = ExplanationService(client)
    result = await service.explain(
        AsyncMock(),
        simulation.project_id,
        simulation.id,
        uuid4(),
        ExplanationRequest(include_current_consumption=True),
    )
    assert result.consumption_included
    facts = client.explain.call_args.args[0]["consumption"]
    assert facts["annual_consumption_kwh"] is None
    assert facts["known_months"] == 1
    assert facts["monthly_comparison"][1]["consumption_kwh"] is None
    assert "annual_production_kwh" not in facts  # Not a subtotal for the known months.
    assert "consumption_profile_id" not in facts


@pytest.mark.asyncio
async def test_consumption_is_not_read_without_opt_in(monkeypatch, simulation):
    stub_reads(monkeypatch, simulation)
    read = AsyncMock()
    monkeypatch.setattr(consumption_repository, "get_by_project_id", read)
    await ExplanationService(fake_client()).explain(
        AsyncMock(), simulation.project_id, simulation.id, uuid4(), ExplanationRequest()
    )
    read.assert_not_awaited()


@pytest.mark.asyncio
async def test_comparison_excludes_roof_differences(monkeypatch, simulation):
    stub_reads(monkeypatch, simulation)
    baseline = SimpleNamespace(**simulation.model_dump(mode="json"))
    baseline.id, baseline.project_id = simulation.id, simulation.project_id
    other = SimpleNamespace(**{**baseline.__dict__, "id": uuid4()})
    monkeypatch.setattr(
        energy_simulation_repository, "get_by_ids", AsyncMock(return_value=[baseline, other])
    )
    client = fake_client(
        narrative(comparison_insights="The annual difference is {{comparison.deltas.annual_kwh}}.")
    )
    result = await ExplanationService(client).explain(
        AsyncMock(),
        simulation.project_id,
        simulation.id,
        uuid4(),
        ExplanationRequest(comparison_simulation_id=other.id),
    )
    assert result.comparison_simulation_id == other.id
    facts = client.explain.call_args.args[0]
    assert "surfaces" not in facts["simulation"]
    assert facts["comparison"]["deltas"]["annual_kwh"] == 0
    assert "id" not in facts["comparison"]["baseline"]


@pytest.mark.asyncio
async def test_unprovided_context_cannot_be_invented(monkeypatch, simulation):
    stub_reads(monkeypatch, simulation)
    client = fake_client(narrative(consumption_insights="Your household is fully supplied."))
    with pytest.raises(AiInvalidResponseError):
        await ExplanationService(client).explain(
            AsyncMock(), simulation.project_id, simulation.id, uuid4(), ExplanationRequest()
        )


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "exception,status",
    [
        (AiNotConfiguredError, 503),
        (AiUnavailableError, 503),
        (AiInvalidResponseError, 503),
        (AiRefusalError, 502),
        (AiRateLimitError, 429),
        (ProjectNotFoundError, 404),
        (EnergySimulationNotFoundError, 404),
    ],
)
async def test_route_maps_failures_without_provider_details(monkeypatch, exception, status):
    app = create_app()
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=uuid4())
    app.dependency_overrides[get_db_session] = lambda: AsyncMock()
    monkeypatch.setattr(
        ai_explanations.explanation_service,
        "explain",
        AsyncMock(side_effect=exception("private details")),
    )
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as c:
        response = await c.post(
            f"/api/v1/projects/{uuid4()}/simulations/{uuid4()}/explanation", json={}
        )
    assert response.status_code == status
    assert "private details" not in response.text
    if status == 429:
        assert response.headers["retry-after"] == "10"


@pytest.mark.asyncio
async def test_routes_require_authentication():
    app = create_app()
    app.dependency_overrides[get_db_session] = lambda: AsyncMock()
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as c:
        assert (await c.get("/api/v1/ai/status")).status_code == 401
        assert (
            await c.post(f"/api/v1/projects/{uuid4()}/simulations/{uuid4()}/explanation", json={})
        ).status_code == 401


@pytest.mark.asyncio
async def test_successful_route_and_status_expose_no_credentials(monkeypatch, simulation):
    stub_reads(monkeypatch, simulation)
    client = fake_client()
    monkeypatch.setattr(ai_explanations, "explanation_service", ExplanationService(client))
    monkeypatch.setattr(ai_explanations, "openai_client", client)
    app = create_app()
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=uuid4())
    app.dependency_overrides[get_db_session] = lambda: AsyncMock()
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as c:
        status = await c.get("/api/v1/ai/status")
        assert status.json() == {"available": True}
        response = await c.post(
            f"/api/v1/projects/{simulation.project_id}/simulations/{simulation.id}/explanation",
            json={},
        )
        assert response.status_code == 200
        assert response.headers["cache-control"] == "no-store"
        assert (
            response.json()["content"]["summary"]
            == "This system has 4.20 kWp and produces 799.50 kWh annually."
        )
        invalid = await c.post(
            f"/api/v1/projects/{simulation.project_id}/simulations/{simulation.id}/explanation",
            json={"annual_kwh": 9999},
        )
        assert invalid.status_code == 422
    assert "test-placeholder" not in response.text + status.text


@pytest.mark.asyncio
@pytest.mark.parametrize("other_project", [False, True])
async def test_missing_or_foreign_comparison_never_calls_openai(
    monkeypatch, simulation, other_project
):
    stub_reads(monkeypatch, simulation)
    foreign = simulation.model_copy(update={"id": uuid4(), "project_id": uuid4()})
    # The repository scopes the lookup to this project, excluding foreign/missing IDs.
    monkeypatch.setattr(
        energy_simulation_repository, "get_by_ids", AsyncMock(return_value=[simulation])
    )
    client = fake_client()
    with pytest.raises(EnergySimulationNotFoundError):
        await ExplanationService(client).explain(
            AsyncMock(),
            simulation.project_id,
            simulation.id,
            uuid4(),
            ExplanationRequest(comparison_simulation_id=foreign.id if other_project else uuid4()),
        )
    client.explain.assert_not_awaited()
