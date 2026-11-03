from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from app.core.exceptions import (
    ConsumptionProfileNotFoundError,
    EnergySimulationNotFoundError,
    ProjectNotFoundError,
)
from app.dependencies.auth import CurrentUserDependency, SessionDependency
from app.schemas.energy_comparison import EnergyComparisonRead
from app.services import energy_comparison_service

router = APIRouter(
    prefix="/projects/{project_id}/energy-comparison",
    tags=["energy-comparison"],
)


@router.get("", response_model=EnergyComparisonRead)
async def read_energy_comparison(
    project_id: UUID,
    current_user: CurrentUserDependency,
    session: SessionDependency,
):
    try:
        return await energy_comparison_service.get_energy_comparison(
            session, project_id, current_user.id
        )
    except ProjectNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "project_not_found", "message": "Project not found."},
        ) from error
    except EnergySimulationNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "simulation_not_found",
                "message": "Run a production analysis before comparing energy.",
            },
        ) from error
    except ConsumptionProfileNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "consumption_profile_not_found",
                "message": "Add household consumption before comparing energy.",
            },
        ) from error
