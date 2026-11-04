from fastapi import status

from app.core.exceptions import (
    OptimizationInputsIncompleteError,
    OptimizationNotFoundError,
    StaleOptimizationError,
)
from app.routers.configuration_optimizations import optimization_error
from app.services.configuration_optimization_service import (
    _closest_consumption_counts,
    _monthly_scaled,
    _monthly_sum,
)


def test_consumption_match_keeps_one_panel_on_every_surface() -> None:
    counts = _closest_consumption_counts(
        capacities=[4, 3],
        annual_per_panel=[500.0, 350.0],
        target=1_200.0,
    )

    assert counts == [1, 2]
    assert sum(counts) == 3


def test_consumption_match_is_deterministic_when_candidates_are_equally_close() -> None:
    first = _closest_consumption_counts([3], [400.0], 1_000.0)
    second = _closest_consumption_counts([3], [400.0], 1_000.0)

    assert first == second == [3]


def test_monthly_results_scale_and_aggregate_per_surface() -> None:
    first = _monthly_scaled([{"month": 1, "energy_kwh": 100.0}], 2.5)
    second = _monthly_scaled([{"month": 1, "energy_kwh": 50.0}], 1.0)

    result = _monthly_sum([first, second])

    assert result[0] == {"month": 1, "energy_kwh": 300.0}
    assert result[-1] == {"month": 12, "energy_kwh": 0.0}


def test_optimizer_errors_have_actionable_http_statuses() -> None:
    missing = optimization_error(OptimizationNotFoundError())
    incomplete = optimization_error(OptimizationInputsIncompleteError("Add a roof."))
    stale = optimization_error(StaleOptimizationError())

    assert missing.status_code == status.HTTP_404_NOT_FOUND
    assert incomplete.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert incomplete.detail["message"] == "Add a roof."
    assert stale.status_code == status.HTTP_409_CONFLICT
