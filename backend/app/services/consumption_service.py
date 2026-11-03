from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConsumptionProfileNotFoundError
from app.models.consumption_profile import ElectricityConsumptionProfile
from app.repositories import consumption_repository
from app.schemas.consumption import ConsumptionProfileRead, ConsumptionProfileUpsert
from app.services import project_service


def build_consumption_read(
    profile: ElectricityConsumptionProfile,
) -> ConsumptionProfileRead:
    monthly_values = sorted(profile.monthly_values, key=lambda item: int(item["month"]))
    known_months = len(monthly_values)
    if known_months:
        total_known = round(
            sum(float(item["consumption_kwh"]) for item in monthly_values), 2
        )
        annual_consumption = total_known if known_months == 12 else None
        average = round(total_known / known_months, 2)
        profile_kind = "complete_monthly" if known_months == 12 else "partial_monthly"
    else:
        total_known = round(float(profile.annual_consumption_kwh or 0), 2)
        annual_consumption = total_known
        average = None
        profile_kind = "annual_only"

    return ConsumptionProfileRead(
        id=profile.id,
        project_id=profile.project_id,
        source=profile.source,
        annual_consumption_kwh=annual_consumption,
        monthly_values=monthly_values,
        known_months=known_months,
        total_known_consumption_kwh=total_known,
        average_known_monthly_kwh=average,
        coverage_percent=round(known_months / 12 * 100, 1),
        profile_kind=profile_kind,
        created_at=profile.created_at,
        updated_at=profile.updated_at,
    )


async def get_consumption_profile(
    session: AsyncSession, project_id: UUID, owner_id: UUID
) -> ConsumptionProfileRead:
    await project_service.get_project(session, project_id, owner_id)
    profile = await consumption_repository.get_by_project_id(session, project_id)
    if profile is None:
        raise ConsumptionProfileNotFoundError
    return build_consumption_read(profile)


async def upsert_consumption_profile(
    session: AsyncSession,
    project_id: UUID,
    owner_id: UUID,
    data: ConsumptionProfileUpsert,
) -> ConsumptionProfileRead:
    await project_service.get_project(session, project_id, owner_id)
    profile = await consumption_repository.get_by_project_id(session, project_id)
    values = [item.model_dump() for item in data.monthly_values]
    if profile is None:
        profile = ElectricityConsumptionProfile(
            project_id=project_id,
            source="manual",
            annual_consumption_kwh=data.annual_consumption_kwh,
            monthly_values=values,
        )
        consumption_repository.add(session, profile)
    else:
        profile.source = "manual"
        profile.annual_consumption_kwh = data.annual_consumption_kwh
        profile.monthly_values = values
    await session.commit()
    await session.refresh(profile)
    return build_consumption_read(profile)
