from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers.auth import router as auth_router
from app.routers.geocoding import router as geocoding_router
from app.routers.health import router as health_router
from app.routers.panel_layouts import router as panel_layouts_router
from app.routers.project_locations import router as project_locations_router
from app.routers.projects import router as projects_router
from app.routers.roof_surfaces import router as roof_surfaces_router
from app.routers.solar_panels import router as solar_panels_router
from app.routers.users import router as users_router


def create_app() -> FastAPI:
    application = FastAPI(
        title="SolarPlan API",
        version="0.2.0",
        description="Technical and energy analysis for residential photovoltaic systems.",
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    for router in (
        health_router,
        auth_router,
        geocoding_router,
        users_router,
        projects_router,
        project_locations_router,
        roof_surfaces_router,
        solar_panels_router,
        panel_layouts_router,
    ):
        application.include_router(router, prefix="/api/v1")
    return application


app = create_app()
