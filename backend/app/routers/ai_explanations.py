from uuid import UUID

from fastapi import APIRouter, HTTPException, Response

from app.core.exceptions import (
    AiInvalidResponseError,
    AiNotConfiguredError,
    AiRateLimitError,
    AiRefusalError,
    AiUnavailableError,
    EnergySimulationNotFoundError,
    ProjectNotFoundError,
    SimulationComparisonInvalidError,
)
from app.dependencies.auth import CurrentUserDependency, SessionDependency
from app.integrations.openai_client import openai_client
from app.routers.energy_simulations import simulation_error
from app.schemas.ai_explanation import AiStatusRead, ExplanationRead, ExplanationRequest
from app.services.ai_explanation_service import explanation_service

router = APIRouter(tags=["AI explanations"])


@router.get("/ai/status", response_model=AiStatusRead)
async def read_ai_status(current_user: CurrentUserDependency):
    return AiStatusRead(available=openai_client.available)


@router.post(
    "/projects/{project_id}/simulations/{simulation_id}/explanation",
    response_model=ExplanationRead,
)
async def explain_simulation(
    project_id: UUID,
    simulation_id: UUID,
    data: ExplanationRequest,
    current_user: CurrentUserDependency,
    session: SessionDependency,
    response: Response,
):
    response.headers["Cache-Control"] = "no-store"
    try:
        return await explanation_service.explain(
            session, project_id, simulation_id, current_user.id, data
        )
    except (
        ProjectNotFoundError,
        EnergySimulationNotFoundError,
        SimulationComparisonInvalidError,
    ) as error:
        raise simulation_error(error) from error
    except AiNotConfiguredError:
        raise HTTPException(
            503,
            detail={
                "code": "ai_not_configured",
                "message": "AI explanations are not available yet.",
            },
        ) from None
    except AiRateLimitError:
        raise HTTPException(
            429,
            headers={"Retry-After": "10"},
            detail={
                "code": "ai_rate_limited",
                "message": "Please wait a moment before requesting another explanation.",
            },
        ) from None
    except AiRefusalError:
        raise HTTPException(
            502,
            detail={
                "code": "ai_refused",
                "message": "The AI could not explain these results. Please try again.",
            },
        ) from None
    except (AiUnavailableError, AiInvalidResponseError):
        raise HTTPException(
            503,
            detail={
                "code": "ai_unavailable",
                "message": (
                    "AI explanations are temporarily unavailable. Your saved results are still "
                    "available. Please try again shortly."
                ),
            },
        ) from None
