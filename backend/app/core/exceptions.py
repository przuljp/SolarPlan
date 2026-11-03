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


class GeocodingProviderError(Exception):
    """Raised when the configured geocoding provider cannot return a valid response."""


class GeocodingResultNotFoundError(Exception):
    """Raised when reverse geocoding cannot describe the requested coordinates."""


class SolarPanelNotFoundError(Exception):
    """Raised when a catalog panel cannot be found."""


class PanelLayoutNotFoundError(Exception):
    """Raised when a project has no saved panel layout."""


class InvalidPanelCountError(Exception):
    """Raised when a requested count exceeds the calculated capacity."""


class ProjectLocationNotFoundError(Exception):
    """Raised when an owned project has no saved geographic location."""


class RoofSurfaceNotFoundError(Exception):
    """Raised when a roof surface does not belong to the owned project."""


class ProjectPanelMismatchError(Exception):
    """Raised when a roof surface attempts to use a different project panel model."""


class PvgisUnavailableError(Exception):
    """Raised when PVGIS cannot complete a request after limited retries."""


class PvgisInvalidResponseError(Exception):
    """Raised when PVGIS returns data that cannot be normalized safely."""


class SimulationInputsIncompleteError(Exception):
    """Raised when a project lacks inputs required for an energy simulation."""


class EnergySimulationNotFoundError(Exception):
    """Raised when a project has no saved energy simulation."""


class ConsumptionProfileNotFoundError(Exception):
    """Raised when a project has no saved household-consumption profile."""
