from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from app.core.exceptions import (
    EnergySimulationNotFoundError,
    ProjectNotFoundError,
    PvgisInvalidResponseError,
    PvgisUnavailableError,
    SimulationComparisonInvalidError,
    SimulationInputsIncompleteError,
)
from app.dependencies.auth import CurrentUserDependency, SessionDependency
from app.schemas.energy_simulation import (
    EnergySimulationComparisonRead,
    EnergySimulationRead,
    EnergySimulationRequest,
    EnergySimulationSummaryRead,
)
from app.services import energy_simulation_service

router = APIRouter(prefix="/projects/{project_id}/simulations", tags=["energy simulations"])


def simulation_error(error: Exception) -> HTTPException:
    if isinstance(error, ProjectNotFoundError):
        return HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "project_not_found", "message": "Project not found."},
        )
    if isinstance(error, EnergySimulationNotFoundError):
        return HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "simulation_not_found", "message": "No energy simulation exists yet."},
        )
    if isinstance(error, SimulationInputsIncompleteError):
        return HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={"code": "simulation_inputs_incomplete", "message": str(error)},
        )
    if isinstance(error, SimulationComparisonInvalidError):
        return HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={"code": "simulation_comparison_invalid", "message": str(error)},
        )
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail={
            "code": "pvgis_unavailable",
            "message": "PVGIS is temporarily unavailable. Please try again shortly.",
        },
    )


@router.post("", response_model=EnergySimulationRead, status_code=status.HTTP_201_CREATED)
async def create_energy_simulation(
    project_id: UUID,
    data: EnergySimulationRequest,
    current_user: CurrentUserDependency,
    session: SessionDependency,
):
    try:
        return await energy_simulation_service.run_simulation(
            session, project_id, current_user.id, data
        )
    except (
        ProjectNotFoundError,
        SimulationInputsIncompleteError,
        PvgisUnavailableError,
        PvgisInvalidResponseError,
    ) as error:
        raise simulation_error(error) from error


@router.get("/latest", response_model=EnergySimulationRead)
async def read_latest_energy_simulation(
    project_id: UUID,
    current_user: CurrentUserDependency,
    session: SessionDependency,
):
    try:
        return await energy_simulation_service.get_latest_simulation(
            session, project_id, current_user.id
        )
    except (ProjectNotFoundError, EnergySimulationNotFoundError) as error:
        raise simulation_error(error) from error


@router.get("", response_model=list[EnergySimulationSummaryRead])
async def read_energy_simulation_history(
    project_id: UUID,
    current_user: CurrentUserDependency,
    session: SessionDependency,
):
    try:
        return await energy_simulation_service.list_simulations(
            session, project_id, current_user.id
        )
    except ProjectNotFoundError as error:
        raise simulation_error(error) from error


@router.get("/compare", response_model=EnergySimulationComparisonRead)
async def read_energy_simulation_comparison(
    project_id: UUID,
    baseline_id: UUID,
    comparison_id: UUID,
    current_user: CurrentUserDependency,
    session: SessionDependency,
):
    try:
        return await energy_simulation_service.compare_simulations(
            session,
            project_id,
            baseline_id,
            comparison_id,
            current_user.id,
        )
    except (
        ProjectNotFoundError,
        EnergySimulationNotFoundError,
        SimulationComparisonInvalidError,
    ) as error:
        raise simulation_error(error) from error


@router.get("/{simulation_id}", response_model=EnergySimulationRead)
async def read_energy_simulation(
    project_id: UUID,
    simulation_id: UUID,
    current_user: CurrentUserDependency,
    session: SessionDependency,
):
    try:
        return await energy_simulation_service.get_simulation(
            session, project_id, simulation_id, current_user.id
        )
    except (ProjectNotFoundError, EnergySimulationNotFoundError) as error:
        raise simulation_error(error) from error
