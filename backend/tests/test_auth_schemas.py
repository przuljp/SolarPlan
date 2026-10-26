import pytest
from pydantic import ValidationError

from app.schemas.auth import LoginRequest, RegisterRequest


def test_registration_normalizes_name_and_email() -> None:
    data = RegisterRequest(
        full_name="  Petar   Przulj  ",
        email="Petar@Example.COM",
        password="StrongPass1",
    )

    assert data.full_name == "Petar Przulj"
    assert data.email == "petar@example.com"


@pytest.mark.parametrize(
    "password",
    ["short1A", "alllowercase1", "ALLUPPERCASE1", "NoNumberHere"],
)
def test_registration_rejects_weak_passwords(password: str) -> None:
    with pytest.raises(ValidationError):
        RegisterRequest(
            full_name="Test User",
            email="test@example.com",
            password=password,
        )


def test_login_normalizes_email_without_applying_registration_strength_rules() -> None:
    data = LoginRequest(email="USER@Example.com", password="existing-password")

    assert data.email == "user@example.com"

