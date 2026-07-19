import logging
import threading
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from database.connection import engine, Base
from api.routes import auth, circulars, obligations, mappings, findings, evidence, readiness, replay, advisor, action_plan, reports, dashboard, departments, users, policies, metrics
from services.seed import seed_demo_data
from utils.rate_limit import limiter
from database.config import settings

logger = logging.getLogger("uvicorn.error")

def _seed_in_background():
    try:
        seed_demo_data()
    except Exception:
        # Seeding is best-effort demo/dev data; a slow or unreachable embeddings
        # API must never take the whole server down or block it from booting.
        logger.exception("Demo data seeding failed; continuing without it.")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: table creation is fast/local, keep it synchronous.
    Base.metadata.create_all(bind=engine)
    # Run seeding off the event loop so the app starts accepting requests
    # (including /health) immediately, regardless of external API latency.
    # DEMO_SEED_DATA gates this: it creates known demo credentials
    # (admin@argus.demo / admin123) and must never run against production.
    if settings.DEMO_SEED_DATA:
        threading.Thread(target=_seed_in_background, daemon=True).start()
    yield
    # Shutdown
    pass

app = FastAPI(
    title="ARGUS - Agentic Regulatory Governance & Unified Simulation",
    description="Multi-agent regulatory compliance platform for SEBI circular analysis",
    version="0.1.0",
    lifespan=lifespan
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://frontend:5173",
        "http://localhost:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/api/v1/users", tags=["Users"])
app.include_router(departments.router, prefix="/api/v1/departments", tags=["Departments"])
app.include_router(circulars.router, prefix="/api/v1/circulars", tags=["Circulars"])
app.include_router(obligations.router, prefix="/api/v1/obligations", tags=["Obligations"])
app.include_router(policies.router, prefix="/api/v1/policies", tags=["Policies"])
app.include_router(mappings.router, prefix="/api/v1/mappings", tags=["Mappings"])
app.include_router(findings.router, prefix="/api/v1/findings", tags=["Findings"])
app.include_router(evidence.router, prefix="/api/v1/evidence", tags=["Evidence"])
app.include_router(readiness.router, prefix="/api/v1/readiness", tags=["Readiness"])
app.include_router(replay.router, prefix="/api/v1/replay", tags=["Regulatory Replay"])
app.include_router(advisor.router, prefix="/api/v1/advisor", tags=["ARGUS Advisor"])
app.include_router(action_plan.router, prefix="/api/v1/action-plan", tags=["Action Plan"])
app.include_router(reports.router, prefix="/api/v1/reports", tags=["Reports"])
app.include_router(dashboard.router, prefix="/api/v1/dashboard", tags=["Dashboard"])
app.include_router(metrics.router, prefix="/api/v1/metrics", tags=["Metrics"])

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "argus-backend"}

@app.get("/")
async def root():
    return {
        "name": "ARGUS",
        "version": "0.1.0",
        "description": "Agentic Regulatory Governance & Unified Simulation"
    }
