from __future__ import annotations

import logging
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.engine.actions import ActionRunner
from app.engine.triggers import TriggerHandler
from app.models.log import WorkflowLog
from app.models.workflow import Workflow

logger = logging.getLogger(__name__)


class WorkflowExecutor:
    """Loads a workflow, evaluates triggers, runs actions, and logs results."""

    def __init__(self, session: AsyncSession, settings: Settings | None = None) -> None:
        self._session = session
        self._settings = settings or get_settings()
        self._trigger_handler = TriggerHandler()
        self._action_runner = ActionRunner(self._settings)

    async def execute_workflow(
        self,
        workflow_id: uuid.UUID,
        trigger_data: dict[str, Any],
    ) -> WorkflowLog:
        """Execute a workflow end-to-end and return the log entry."""
        # Create log entry
        log_entry = WorkflowLog(
            workflow_id=workflow_id,
            status="running",
            input_data=trigger_data,
        )
        self._session.add(log_entry)
        await self._session.flush()

        try:
            # Load workflow eagerly with triggers and actions
            stmt = select(Workflow).where(Workflow.id == workflow_id)
            result = await self._session.execute(stmt)
            workflow = result.scalar_one_or_none()

            if workflow is None:
                raise ValueError(f"Workflow {workflow_id} not found")

            if not workflow.enabled:
                log_entry.status = "skipped"
                log_entry.output_data = {"reason": "Workflow is disabled"}
                return log_entry

            # Evaluate triggers
            trigger_matched = False
            for trigger in workflow.triggers:
                if await self._trigger_handler.evaluate_trigger(trigger, trigger_data):
                    trigger_matched = True
                    logger.info(
                        "Trigger matched: workflow=%s trigger=%s",
                        workflow.name,
                        trigger.event_type,
                    )
                    break

            if not trigger_matched and workflow.triggers:
                log_entry.status = "skipped"
                log_entry.output_data = {"reason": "No trigger matched"}
                return log_entry

            # Run actions sequentially
            context: dict[str, Any] = dict(trigger_data)
            action_results: list[dict[str, Any]] = []

            for action in sorted(workflow.actions, key=lambda a: a.sort_order):
                logger.info(
                    "Running action: workflow=%s action=%s",
                    workflow.name,
                    action.action_type,
                )
                action_result = await self._action_runner.run_action(action, context)
                action_results.append({
                    "action_type": action.action_type,
                    "result": action_result,
                })
                # Merge result into context so later actions can use it
                context.update(action_result)

            log_entry.status = "success"
            log_entry.output_data = {"actions": action_results}
            logger.info("Workflow %s executed successfully", workflow.name)

        except Exception as exc:
            logger.exception("Workflow execution failed: %s", exc)
            log_entry.status = "error"
            log_entry.error_message = str(exc)

        finally:
            await self._action_runner.close()

        return log_entry
