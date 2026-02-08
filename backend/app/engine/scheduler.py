from __future__ import annotations

import logging
import uuid
from typing import Any

from arq import cron
from arq.connections import RedisSettings

from app.config import get_settings
from app.database import get_session_factory
from app.engine.executor import WorkflowExecutor
from app.models.workflow import Workflow

from sqlalchemy import select

logger = logging.getLogger(__name__)


async def run_scheduled_workflows(ctx: dict[str, Any]) -> int:
    """ARQ task: find all enabled workflows with 'schedule' triggers and execute them."""
    settings = get_settings()
    session_factory = get_session_factory()
    executed = 0

    async with session_factory() as session:
        stmt = (
            select(Workflow)
            .where(Workflow.enabled.is_(True))
            .join(Workflow.triggers)
        )
        result = await session.execute(stmt)
        workflows = result.scalars().unique().all()

        for workflow in workflows:
            schedule_triggers = [t for t in workflow.triggers if t.source == "schedule"]
            if not schedule_triggers:
                continue

            logger.info("Executing scheduled workflow: %s (%s)", workflow.name, workflow.id)
            executor = WorkflowExecutor(session, settings)
            trigger_data = {
                "source": "schedule",
                "event_type": "scheduled_run",
            }
            await executor.execute_workflow(workflow.id, trigger_data)
            executed += 1

        await session.commit()

    logger.info("Scheduled run complete: %d workflows executed", executed)
    return executed


async def run_single_workflow(ctx: dict[str, Any], workflow_id: str, trigger_data: dict[str, Any]) -> str:
    """ARQ task: execute a single workflow by ID (used for async dispatch)."""
    settings = get_settings()
    session_factory = get_session_factory()

    async with session_factory() as session:
        executor = WorkflowExecutor(session, settings)
        log_entry = await executor.execute_workflow(uuid.UUID(workflow_id), trigger_data)
        await session.commit()

    return log_entry.status


class WorkerSettings:
    """ARQ worker configuration.

    Start the worker with:
        arq app.engine.scheduler.WorkerSettings
    """

    functions = [run_single_workflow]
    cron_jobs = [
        cron(run_scheduled_workflows, minute={0, 15, 30, 45}),  # every 15 minutes
    ]

    @staticmethod
    def redis_settings() -> RedisSettings:
        settings = get_settings()
        return RedisSettings.from_dsn(settings.REDIS_URL)
