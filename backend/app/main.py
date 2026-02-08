from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select, text

from app.api import connectors, logs, mappings, webhooks, workflows
from app.config import get_settings
from app.database import Base, SessionDep, get_session_factory, reset_session_factory
from app.models.log import WorkflowLog
from app.models.mapping import ContactMapping
from app.models.workflow import Workflow
from app.schemas.common import DashboardStats, HealthResponse

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    settings = get_settings()
    logging.basicConfig(level=settings.LOG_LEVEL)
    logger.info("Starting %s v%s", settings.APP_TITLE, settings.APP_VERSION)

    # Ensure session factory is initialized
    get_session_factory()

    yield

    # Shutdown
    logger.info("Shutting down %s", settings.APP_TITLE)
    reset_session_factory()


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title=settings.APP_TITLE,
        version=settings.APP_VERSION,
        description="REST API middleware connecting Paperless-ngx with Lexoffice/Lexware Office",
        lifespan=lifespan,
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Include routers
    app.include_router(workflows.router)
    app.include_router(connectors.router)
    app.include_router(webhooks.router)
    app.include_router(mappings.router)
    app.include_router(logs.router)

    # ------------------------------------------------------------------
    # Health
    # ------------------------------------------------------------------

    @app.get("/api/health", response_model=HealthResponse, tags=["system"])
    async def health(session: SessionDep):
        db_status = "error"
        redis_status = "not_checked"

        # Database check
        try:
            await session.execute(text("SELECT 1"))
            db_status = "ok"
        except Exception as exc:
            db_status = f"error: {exc}"

        # Redis check
        try:
            import redis.asyncio as aioredis

            r = aioredis.from_url(settings.REDIS_URL)
            await r.ping()
            redis_status = "ok"
            await r.aclose()
        except Exception as exc:
            redis_status = f"error: {exc}"

        overall = "ok" if db_status == "ok" else "degraded"
        return HealthResponse(
            status=overall,
            version=settings.APP_VERSION,
            database=db_status,
            redis=redis_status,
        )

    # ------------------------------------------------------------------
    # Dashboard statistics
    # ------------------------------------------------------------------

    @app.get("/api/dashboard/stats", response_model=DashboardStats, tags=["system"])
    async def dashboard_stats(session: SessionDep):
        # Workflow counts
        total_wf = (
            await session.execute(select(func.count()).select_from(Workflow))
        ).scalar_one()
        active_wf = (
            await session.execute(
                select(func.count()).select_from(Workflow).where(Workflow.enabled.is_(True))
            )
        ).scalar_one()

        # Execution counts
        total_exec = (
            await session.execute(select(func.count()).select_from(WorkflowLog))
        ).scalar_one()
        success_exec = (
            await session.execute(
                select(func.count())
                .select_from(WorkflowLog)
                .where(WorkflowLog.status == "success")
            )
        ).scalar_one()
        failed_exec = (
            await session.execute(
                select(func.count())
                .select_from(WorkflowLog)
                .where(WorkflowLog.status == "error")
            )
        ).scalar_one()

        # Mapping count
        total_map = (
            await session.execute(select(func.count()).select_from(ContactMapping))
        ).scalar_one()

        # Recent logs
        recent_stmt = (
            select(WorkflowLog)
            .order_by(WorkflowLog.executed_at.desc())
            .limit(10)
        )
        recent_result = await session.execute(recent_stmt)
        recent_logs_raw = recent_result.scalars().all()

        recent_logs: list[dict[str, Any]] = [
            {
                "id": str(lg.id),
                "workflow_id": str(lg.workflow_id),
                "status": lg.status,
                "error_message": lg.error_message,
                "executed_at": lg.executed_at.isoformat() if lg.executed_at else None,
            }
            for lg in recent_logs_raw
        ]

        return DashboardStats(
            total_workflows=total_wf,
            active_workflows=active_wf,
            total_executions=total_exec,
            successful_executions=success_exec,
            failed_executions=failed_exec,
            total_mappings=total_map,
            recent_logs=recent_logs,
        )

    return app


app = create_app()
