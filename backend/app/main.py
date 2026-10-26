from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers.health import router as health_router


def create_app() -> FastAPI:
    application = FastAPI(
        title="SolarPlan API",
        version="0.1.0",
        description="Technical and energy analysis for residential photovoltaic systems.",
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    application.include_router(health_router, prefix="/api/v1")

    return application


app = create_app()

