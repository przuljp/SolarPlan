from datetime import UTC, datetime, timedelta
from uuid import uuid4

import jwt
import pytest

from app.core.config import settings
from app.core.exceptions import InvalidAccessTokenError
from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


def test_password_is_hashed_and_can_be_verified() -> None:
    plain_password = "StrongPass1"
    encoded_hash = hash_password(plain_password)

    assert encoded_hash != plain_password
    assert verify_password(plain_password, encoded_hash) is True
    assert verify_password("WrongPass1", encoded_hash) is False


def test_access_token_round_trip_returns_user_id() -> None:
    user_id = uuid4()
    token = create_access_token(user_id)

    assert decode_access_token(token) == user_id


def test_expired_access_token_is_rejected() -> None:
    user_id = uuid4()
    expired_time = datetime.now(UTC) - timedelta(days=1)
    token = create_access_token(user_id, now=expired_time)

    with pytest.raises(InvalidAccessTokenError):
        decode_access_token(token)


def test_token_with_wrong_type_is_rejected() -> None:
    now = datetime.now(UTC)
    token = jwt.encode(
        {
            "sub": str(uuid4()),
            "type": "refresh",
            "iat": now,
            "exp": now + timedelta(minutes=5),
            "iss": settings.jwt_issuer,
            "aud": settings.jwt_audience,
        },
        settings.jwt_secret.get_secret_value(),
        algorithm="HS256",
    )

    with pytest.raises(InvalidAccessTokenError):
        decode_access_token(token)

