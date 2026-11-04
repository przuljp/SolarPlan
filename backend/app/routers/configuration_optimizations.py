from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from app.core.exceptions import (
    OptimizationCandidateNotFoundError,
    OptimizationInputsIncompleteError,
    OptimizationNotFoundError,
    ProjectNotFoundError,
    PvgisInvalidResponseError,
    PvgisUnavailableError,
    StaleOptimizationError,
)
from app.dependencies.auth import CurrentUserDependency, SessionDependency
from app.schemas.optimization import (
    OptimizationRead,
    OptimizationRequest,
    OptimizationSelectionRead,
    OptimizationSelectionRequest,
)
from app.services import configuration_optimization_service

router = APIRouter(prefix="/projects/{project_id}", tags=["configuration optimization"])


def optimization_error(error: Exception) -> HTTPException:
    if isinstance(error, ProjectNotFoundError):
        return HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "project_not_found", "message": "Project not found."},
        )
    if isinstance(error, OptimizationNotFoundError):
        return HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "optimization_not_found", "message": "No saved optimization exists."},
        )
    if isinstance(error, OptimizationCandidateNotFoundError):
        return HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "candidate_not_found",
                "message": "The selected candidate was not found.",
            },
        )
    if isinstance(error, OptimizationInputsIncompleteError):
        return HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={"code": "optimization_inputs_incomplete", "message": str(error)},
        )
    if isinstance(error, StaleOptimizationError):
        return HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "optimization_stale",
                "message": "Project inputs changed after this comparison. Run the optimizer again.",
            },
        )
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail={
            "code": "pvgis_unavailable",
            "message": "PVGIS is temporarily unavailable. Please try again shortly.",
        },
    )


@router.post("/optimize", response_model=OptimizationRead, status_code=status.HTTP_201_CREATED)
async def create_optimization(
    project_id: UUID,
    data: OptimizationRequest,
    current_user: CurrentUserDependency,
    session: SessionDependency,
):
    try:
        return await configuration_optimization_service.run_optimization(
            session, project_id, current_user.id, data
        )
    except (
        ProjectNotFoundError,
        OptimizationInputsIncompleteError,
        PvgisUnavailableError,
        PvgisInvalidResponseError,
    ) as error:
        raise optimization_error(error) from error


@router.get("/optimizations/latest", response_model=OptimizationRead)
async def read_latest_optimization(
    project_id: UUID,
    current_user: CurrentUserDependency,
    session: SessionDependency,
):
    try:
        return await configuration_optimization_service.get_latest_optimization(
            session, project_id, current_user.id
        )
    except (ProjectNotFoundError, OptimizationNotFoundError) as error:
        raise optimization_error(error) from error


@router.post(
    "/optimizations/{optimization_id}/select",
    response_model=OptimizationSelectionRead,
)
async def select_optimization_candidate(
    project_id: UUID,
    optimization_id: UUID,
    data: OptimizationSelectionRequest,
    current_user: CurrentUserDependency,
    session: SessionDependency,
):
    try:
        optimization, simulation = await configuration_optimization_service.select_candidate(
            session,
            project_id,
            optimization_id,
            current_user.id,
            data.candidate_id,
        )
        return {
            "optimization": optimization,
            "simulation_id": simulation.id,
            "applied_candidate_id": data.candidate_id,
        }
    except (
        ProjectNotFoundError,
        OptimizationNotFoundError,
        OptimizationCandidateNotFoundError,
        OptimizationInputsIncompleteError,
        StaleOptimizationError,
    ) as error:
        raise optimization_error(error) from error
