# backend/main.py
"""
ParkSmart AI — FastAPI Backend
Enterprise-grade smart parking SaaS API.

Startup:
  cd backend
  uvicorn main:app --reload --port 8000

Production:
  gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
"""

import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from core.config import settings
from core.middleware import LoggingMiddleware, global_exception_handler
from api.routes import auth, bookings, slots, penalties, analytics, ai_forecast, parking_areas


# ── Lifespan — startup / shutdown ─────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("=" * 50)
    print("  ParkSmart AI Backend  —  Starting up")
    print(f"  Environment : {settings.APP_ENV}")
    print("=" * 50)

    # Start overtime background scanner in development
    if not settings.is_production:
        from api.services.overtime_scheduler import run_overtime_scanner
        task = asyncio.create_task(run_overtime_scanner())
        print("[Startup] Overtime scanner background task started")
    else:
        task = None
        print("[Startup] Production mode — use Cloud Scheduler for overtime scanning")

    yield  # App is running

    # Shutdown
    if task:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
    print("[Shutdown] ParkSmart AI Backend stopped")


# ── App instance ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="ParkSmart AI API",
    description="""
## ParkSmart AI — Smart Parking SaaS Backend

### Features
- 🔐 Firebase Authentication + role-based access control
- 🅿 Dynamic parking layout management (floors, zones, slots)
- 📅 Atomic booking engine with double-booking prevention
- ⏱ 15-minute buffer between consecutive bookings
- ⚠ Overtime detection + automatic penalty calculation
- 🔄 Slot auto-reassignment on overstay conflicts
- 📷 QR code generation and atomic verification
- 🤖 AI occupancy forecast (LSTM placeholder, Phase 2)
- 📡 IoT webhook for ESP32 sensor integration (Phase 3)
""",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)


# ── CORS ───────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "https://parksmart-ai.vercel.app",
        settings.CORS_ORIGIN,
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Custom middleware ──────────────────────────────────────────────────────────
app.add_middleware(LoggingMiddleware)
app.add_exception_handler(Exception, global_exception_handler)


# ── Routers ────────────────────────────────────────────────────────────────────
app.include_router(auth.router,          prefix="/api/auth",          tags=["Authentication"])
app.include_router(parking_areas.router, prefix="/api/parking-areas", tags=["Parking Areas"])
app.include_router(bookings.router,      prefix="/api/bookings",      tags=["Bookings"])
app.include_router(slots.router,         prefix="/api/slots",         tags=["Slots"])
app.include_router(penalties.router,     prefix="/api/penalties",     tags=["Penalties"])
app.include_router(analytics.router,     prefix="/api/analytics",     tags=["Analytics"])
app.include_router(ai_forecast.router,   prefix="/api/ai",            tags=["AI Forecast"])


# ── Health check ───────────────────────────────────────────────────────────────
@app.get("/", tags=["Health"])
def root():
    return {
        "service":     "ParkSmart AI API",
        "version":     "1.0.0",
        "status":      "ok",
        "environment": settings.APP_ENV,
        "docs":        "/docs",
    }


@app.get("/health", tags=["Health"])
def health():
    return {"status": "healthy"}
