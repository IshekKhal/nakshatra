"""Main FastAPI gateway entrypoint for Project Scotopic API."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.config import get_settings
from backend.app.routes import microclimate, satellites

settings = get_settings()

app = FastAPI(
    title="Project Scotopic API",
    version="1.0.0",
    description="Microclimate seeing prediction engine, celestial ephemeris, and satellite telemetry.",
)

# CORS middleware for mobile PWA clients across local and production origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["system"])
async def health_check() -> dict:
    """Service health probe endpoint."""
    return {
        "status": "healthy",
        "service": "scotopic-backend",
        "version": "1.0.0",
    }


# Register domain routes under /api/v1 prefix
app.include_router(microclimate.router, prefix="/api/v1")
app.include_router(satellites.router, prefix="/api/v1")
