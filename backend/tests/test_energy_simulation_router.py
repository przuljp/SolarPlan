from fastapi import status

from app.core.exceptions import (
    EnergySimulationNotFoundError,
    ProjectNotFoundError,
    PvgisUnavailableError,
    SimulationComparisonInvalidError,
    SimulationInputsIncompleteError,
)
from app.routers.energy_simulations import simulation_error


def test_simulation_error_hides_provider_details() -> None:
    error = simulation_error(PvgisUnavailableError())

    assert error.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
    assert error.detail["code"] == "pvgis_unavailable"


def test_simulation_error_explains_missing_project_inputs() -> None:
    error = simulation_error(
        SimulationInputsIncompleteError("Save a panel layout before analysis.")
    )

    assert error.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert error.detail == {
        "code": "simulation_inputs_incomplete",
        "message": "Save a panel layout before analysis.",
    }


def test_simulation_error_distinguishes_missing_resources() -> None:
    assert simulation_error(ProjectNotFoundError()).detail["code"] == "project_not_found"
    assert (
        simulation_error(EnergySimulationNotFoundError()).detail["code"] == "simulation_not_found"
    )


def test_simulation_error_explains_invalid_comparison() -> None:
    error = simulation_error(
        SimulationComparisonInvalidError("Choose two different saved simulations to compare.")
    )

    assert error.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert error.detail["code"] == "simulation_comparison_invalid"
