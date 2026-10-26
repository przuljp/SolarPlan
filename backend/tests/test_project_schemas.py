import pytest
from pydantic import ValidationError

from app.schemas.project import ProjectCreate, ProjectUpdate


def test_project_create_normalizes_text() -> None:
    data = ProjectCreate(
        name="  Family   House Sarajevo  ",
        description="  South-facing residential roof.  ",
    )

    assert data.name == "Family House Sarajevo"
    assert data.description == "South-facing residential roof."


def test_blank_description_is_stored_as_none() -> None:
    data = ProjectCreate(name="Family House", description="   ")

    assert data.description is None


@pytest.mark.parametrize("payload", [{}, {"name": None}, {"name": " "}])
def test_project_update_rejects_missing_or_invalid_name(payload: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        ProjectUpdate.model_validate(payload)


def test_project_update_can_clear_description() -> None:
    data = ProjectUpdate(description=None)

    assert data.model_dump(exclude_unset=True) == {"description": None}
