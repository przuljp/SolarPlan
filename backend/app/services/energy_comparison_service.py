from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    ConsumptionProfileNotFoundError,
    EnergySimulationNotFoundError,
)
from app.repositories import consumption_repository, energy_simulation_repository
from app.schemas.energy_comparison import (
    EnergyComparisonRead,
    MonthlyEnergyComparison,
)
from app.services import consumption_service, project_service


def build_energy_comparison(
    simulation: Any,
    consumption_profile: Any,
) -> EnergyComparisonRead:
    profile = consumption_service.build_consumption_read(consumption_profile)
    consumption_by_month = {
        item.month: item.consumption_kwh for item in profile.monthly_values
    }
    production_by_month = {
        int(item["month"]): float(item["energy_kwh"])
        for item in simulation.monthly_results
    }

    monthly_comparison: list[MonthlyEnergyComparison] = []
    status_counts = {"surplus": 0, "deficit": 0, "balanced": 0}
    for month in range(1, 13):
        production = round(production_by_month.get(month, 0.0), 2)
        consumption = consumption_by_month.get(month)
        if consumption is None:
            monthly_comparison.append(
                MonthlyEnergyComparison(
                    month=month,
                    production_kwh=production,
                    status="unavailable",
                )
            )
            continue

        consumption = round(float(consumption), 2)
        balance = round(production - consumption, 2)
        if balance > 0:
            month_status = "surplus"
        elif balance < 0:
            month_status = "deficit"
        else:
            month_status = "balanced"
        status_counts[month_status] += 1
        monthly_comparison.append(
            MonthlyEnergyComparison(
                month=month,
                production_kwh=production,
                consumption_kwh=consumption,
                balance_kwh=balance,
                status=month_status,
            )
        )

    annual_production = round(float(simulation.annual_kwh), 2)
    annual_consumption = profile.annual_consumption_kwh
    annual_balance = None
    annual_coverage = None
    if annual_consumption is not None:
        annual_consumption = round(float(annual_consumption), 2)
        annual_balance = round(annual_production - annual_consumption, 2)
        if annual_consumption > 0:
            annual_coverage = round(annual_production / annual_consumption * 100, 1)

    return EnergyComparisonRead(
        project_id=simulation.project_id,
        simulation_id=simulation.id,
        consumption_profile_id=profile.id,
        annual_production_kwh=annual_production,
        annual_consumption_kwh=annual_consumption,
        annual_balance_kwh=annual_balance,
        annual_coverage_ratio_percent=annual_coverage,
        consumption_profile_kind=profile.profile_kind,
        known_months=profile.known_months,
        months_with_surplus=status_counts["surplus"],
        months_with_deficit=status_counts["deficit"],
        months_balanced=status_counts["balanced"],
        monthly_comparison=monthly_comparison,
    )


async def get_energy_comparison(
    session: AsyncSession,
    project_id: UUID,
    owner_id: UUID,
) -> EnergyComparisonRead:
    await project_service.get_project(session, project_id, owner_id)
    simulation = await energy_simulation_repository.get_latest(session, project_id)
    if simulation is None:
        raise EnergySimulationNotFoundError
    profile = await consumption_repository.get_by_project_id(session, project_id)
    if profile is None:
        raise ConsumptionProfileNotFoundError
    return build_energy_comparison(simulation, profile)
