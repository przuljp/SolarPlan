from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest

from app.core.exceptions import ProjectNotFoundError, RoofConfigurationNotFoundError
from app.models.roof_configuration import RoofConfiguration
from app.repositories import roof_configuration_repository
from app.schemas.roof_configuration import RoofConfigurationUpsert
from app.services import project_service, roof_configuration_service


def roof_data() -> RoofConfigurationUpsert:
    return RoofConfigurationUpsert(
        width_m=8.4,
        length_m=11.2,
        tilt_deg=32,
        azimuth_deg=180,
        edge_margin_m=0.3,
        panel_gap_m=0.02,
        lat=43.8563,
        lon=18.4131,
        location_label="Family house, Sarajevo",
    )


def session_mock() -> SimpleNamespace:
    return SimpleNamespace(
        add=Mock(),
        commit=AsyncMock(),
        refresh=AsyncMock(),
    )


@pytest.mark.asyncio
async def test_upsert_creates_roof_after_project_ownership_check(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    project_id = uuid4()
    owner_id = uuid4()
    session = session_mock()
    get_project = AsyncMock()
    get_roof = AsyncMock(return_value=None)
    add_roof = Mock()
    monkeypatch.setattr(project_service, "get_project", get_project)
    monkeypatch.setattr(roof_configuration_repository, "get_by_project_id", get_roof)
    monkeypatch.setattr(roof_configuration_repository, "add", add_roof)

    result = await roof_configuration_service.upsert_roof_configuration(
        session,
        project_id,
        owner_id,
        roof_data(),
    )

    assert isinstance(result, RoofConfiguration)
    assert result.project_id == project_id
    assert result.location_label == "Family house, Sarajevo"
    get_project.assert_awaited_once_with(session, project_id, owner_id)
    add_roof.assert_called_once_with(session, result)
    session.commit.assert_awaited_once()
    session.refresh.assert_awaited_once_with(result)


@pytest.mark.asyncio
async def test_upsert_updates_existing_roof_without_creating_duplicate(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    project_id = uuid4()
    owner_id = uuid4()
    session = session_mock()
    existing = RoofConfiguration(
        project_id=project_id,
        width_m=6,
        length_m=9,
        tilt_deg=20,
        azimuth_deg=90,
        edge_margin_m=0.2,
        panel_gap_m=0.02,
        lat=44,
        lon=18,
        location_label="Old label",
    )
    monkeypatch.setattr(project_service, "get_project", AsyncMock())
    monkeypatch.setattr(
        roof_configuration_repository,
        "get_by_project_id",
        AsyncMock(return_value=existing),
    )
    add_roof = Mock()
    monkeypatch.setattr(roof_configuration_repository, "add", add_roof)

    result = await roof_configuration_service.upsert_roof_configuration(
        session,
        project_id,
        owner_id,
        roof_data(),
    )

    assert result is existing
    assert result.width_m == 8.4
    assert result.azimuth_deg == 180
    assert result.location_label == "Family house, Sarajevo"
    add_roof.assert_not_called()
    session.commit.assert_awaited_once()
    session.refresh.assert_awaited_once_with(existing)


@pytest.mark.asyncio
async def test_get_reports_missing_roof_for_owned_project(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session = session_mock()
    monkeypatch.setattr(project_service, "get_project", AsyncMock())
    monkeypatch.setattr(
        roof_configuration_repository,
        "get_by_project_id",
        AsyncMock(return_value=None),
    )

    with pytest.raises(RoofConfigurationNotFoundError):
        await roof_configuration_service.get_roof_configuration(
            session,
            uuid4(),
            uuid4(),
        )


@pytest.mark.asyncio
async def test_upsert_never_queries_roof_when_project_is_not_owned(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session = session_mock()
    get_project = AsyncMock(side_effect=ProjectNotFoundError)
    get_roof = AsyncMock()
    monkeypatch.setattr(project_service, "get_project", get_project)
    monkeypatch.setattr(roof_configuration_repository, "get_by_project_id", get_roof)

    with pytest.raises(ProjectNotFoundError):
        await roof_configuration_service.upsert_roof_configuration(
            session,
            uuid4(),
            uuid4(),
            roof_data(),
        )

    get_roof.assert_not_awaited()
    session.commit.assert_not_awaited()
