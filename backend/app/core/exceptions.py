class EmailAlreadyRegisteredError(Exception):
    """Raised when registration uses an e-mail that already belongs to an account."""


class InvalidCredentialsError(Exception):
    """Raised when an e-mail/password combination is invalid."""


class InvalidAccessTokenError(Exception):
    """Raised when an access token is malformed, expired, or otherwise invalid."""


class ProjectNotFoundError(Exception):
    """Raised when an owned project cannot be found."""


class RoofConfigurationNotFoundError(Exception):
    """Raised when an owned project has no roof configuration."""
