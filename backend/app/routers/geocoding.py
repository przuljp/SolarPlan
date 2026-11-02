from fastapi import APIRouter, HTTPException, Query, status

from app.core.exceptions import GeocodingProviderError, GeocodingResultNotFoundError
from app.dependencies.auth import CurrentUserDependency
from app.schemas.error import ErrorResponse
from app.schemas.geocoding import GeocodingResult
from app.services.geocoding_service import geocoding_service

router = APIRouter(
    prefix="/geocoding",
    tags=["geocoding"],
    responses={
        status.HTTP_401_UNAUTHORIZED: {
            "model": ErrorResponse,
            "description": "A valid Bearer token is required.",
        },
        status.HTTP_503_SERVICE_UNAVAILABLE: {
            "model": ErrorResponse,
            "description": "The configured geocoding provider is unavailable.",
        },
    },
)


def provider_unavailable() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail={
            "code": "geocoding_unavailable",
            "message": "Location search is temporarily unavailable. Please try again.",
        },
    )


@router.get("/search", response_model=list[GeocodingResult])
async def search_locations(
    _: CurrentUserDependency,
    query: str = Query(alias="q", min_length=2, max_length=200),
    limit: int = Query(default=5, ge=1, le=5),
) -> list[GeocodingResult]:
    try:
        return await geocoding_service.search(query, limit)
    except GeocodingProviderError as error:
        raise provider_unavailable() from error


@router.get(
    "/reverse",
    response_model=GeocodingResult,
    responses={
        status.HTTP_404_NOT_FOUND: {
            "model": ErrorResponse,
            "description": "No descriptive address was found for the coordinates.",
        }
    },
)
async def reverse_location(
    _: CurrentUserDependency,
    latitude: float = Query(alias="lat", ge=-90, le=90),
    longitude: float = Query(alias="lon", ge=-180, le=180),
) -> GeocodingResult:
    try:
        return await geocoding_service.reverse(latitude, longitude)
    except GeocodingResultNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "location_not_found",
                "message": "No address was found for these coordinates.",
            },
        ) from error
    except GeocodingProviderError as error:
        raise provider_unavailable() from error
