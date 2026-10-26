class EmailAlreadyRegisteredError(Exception):
    """Raised when registration uses an e-mail that already belongs to an account."""


class InvalidCredentialsError(Exception):
    """Raised when an e-mail/password combination is invalid."""


class InvalidAccessTokenError(Exception):
    """Raised when an access token is malformed, expired, or otherwise invalid."""

