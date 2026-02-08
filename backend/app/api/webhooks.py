from __future__ import annotations

import hashlib
import hmac
import logging
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.database import SessionDep
from app.engine.executor import WorkflowExecutor
from app.models.workflow import Trigger, Workflow
from app.schemas.common import StatusResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])

SettingsDep = Annotated[Settings, Depends(get_settings)]


def _verify_signature(payload: bytes, secret: str, signature: str) -> bool:
    """Verify HMAC-SHA256 webhook signature."""
    if not secret:
        return True  # skip verification when no secret is configured
    expected = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


async def _dispatch_event(
    session: AsyncSession,
    settings: Settings,
    source: str,
    event_type: str,
    event_data: dict[str, Any],
) -> list[dict[str, Any]]:
    """Find matching workflows and execute them."""
    stmt = (
        select(Workflow)
        .join(Trigger)
        .where(
            Workflow.enabled.is_(True),
            Trigger.source == source,
            Trigger.event_type == event_type,
        )
    )
    result = await session.execute(stmt)
    workflows = result.scalars().unique().all()

    trigger_data = {
        "source": source,
        "event_type": event_type,
        **event_data,
    }

    results: list[dict[str, Any]] = []
    for workflow in workflows:
        executor = WorkflowExecutor(session, settings)
        log_entry = await executor.execute_workflow(workflow.id, trigger_data)
        results.append({
            "workflow_id": str(workflow.id),
            "workflow_name": workflow.name,
            "status": log_entry.status,
            "log_id": str(log_entry.id),
        })

    return results


@router.post("/paperless", response_model=StatusResponse)
async def paperless_webhook(
    request: Request,
    session: SessionDep,
    settings: SettingsDep,
    x_webhook_signature: Annotated[str | None, Header()] = None,
):
    """Receive webhook events from Paperless-ngx."""
    body = await request.body()

    if settings.WEBHOOK_SECRET and x_webhook_signature:
        if not _verify_signature(body, settings.WEBHOOK_SECRET, x_webhook_signature):
            raise HTTPException(status_code=403, detail="Invalid webhook signature")

    try:
        payload: dict[str, Any] = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    # Paperless webhooks typically include: document_id, event type
    event_type = payload.get("event", payload.get("event_type", "document_created"))
    document_id = payload.get("document_id") or payload.get("id")

    event_data: dict[str, Any] = {
        "document_id": document_id,
        "payload": payload,
    }

    results = await _dispatch_event(session, settings, "paperless", event_type, event_data)
    await session.flush()

    return StatusResponse(
        status="accepted",
        message=f"Dispatched to {len(results)} workflow(s)",
        details={"executions": results},
    )


@router.post("/lexoffice", response_model=StatusResponse)
async def lexoffice_webhook(
    request: Request,
    session: SessionDep,
    settings: SettingsDep,
):
    """Receive webhook events from Lexoffice.

    Lexoffice sends event subscriptions with fields:
        - eventType
        - resourceId
        - organizationId
    """
    try:
        payload: dict[str, Any] = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    event_type = payload.get("eventType", "unknown")
    resource_id = payload.get("resourceId")

    event_data: dict[str, Any] = {
        "resource_id": resource_id,
        "organization_id": payload.get("organizationId"),
        "payload": payload,
    }

    results = await _dispatch_event(session, settings, "lexoffice", event_type, event_data)
    await session.flush()

    return StatusResponse(
        status="accepted",
        message=f"Dispatched to {len(results)} workflow(s)",
        details={"executions": results},
    )
