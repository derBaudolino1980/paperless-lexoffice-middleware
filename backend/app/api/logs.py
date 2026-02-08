from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, select

from app.database import SessionDep
from app.models.log import WorkflowLog
from app.schemas.common import PaginatedResponse
from app.schemas.workflow import WorkflowLogRead

router = APIRouter(prefix="/api/logs", tags=["logs"])


@router.get("", response_model=PaginatedResponse[WorkflowLogRead])
async def list_logs(
    session: SessionDep,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 25,
    workflow_id: uuid.UUID | None = None,
    status: str | None = None,
    since: datetime | None = None,
    until: datetime | None = None,
):
    """Query workflow execution logs with optional filters."""
    offset = (page - 1) * page_size

    base = select(WorkflowLog)
    count_base = select(func.count()).select_from(WorkflowLog)

    if workflow_id is not None:
        base = base.where(WorkflowLog.workflow_id == workflow_id)
        count_base = count_base.where(WorkflowLog.workflow_id == workflow_id)
    if status is not None:
        base = base.where(WorkflowLog.status == status)
        count_base = count_base.where(WorkflowLog.status == status)
    if since is not None:
        base = base.where(WorkflowLog.executed_at >= since)
        count_base = count_base.where(WorkflowLog.executed_at >= since)
    if until is not None:
        base = base.where(WorkflowLog.executed_at <= until)
        count_base = count_base.where(WorkflowLog.executed_at <= until)

    total = (await session.execute(count_base)).scalar_one()

    stmt = base.order_by(WorkflowLog.executed_at.desc()).offset(offset).limit(page_size)
    result = await session.execute(stmt)
    logs = result.scalars().all()

    return PaginatedResponse(
        items=[WorkflowLogRead.model_validate(lg) for lg in logs],
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size if total else 0,
    )


@router.get("/{log_id}", response_model=WorkflowLogRead)
async def get_log(session: SessionDep, log_id: uuid.UUID):
    log_entry = await session.get(WorkflowLog, log_id)
    if log_entry is None:
        raise HTTPException(status_code=404, detail="Log entry not found")
    return WorkflowLogRead.model_validate(log_entry)


@router.get("/workflow/{workflow_id}", response_model=PaginatedResponse[WorkflowLogRead])
async def get_logs_for_workflow(
    session: SessionDep,
    workflow_id: uuid.UUID,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 25,
):
    """Get all logs for a specific workflow."""
    offset = (page - 1) * page_size

    count_stmt = (
        select(func.count())
        .select_from(WorkflowLog)
        .where(WorkflowLog.workflow_id == workflow_id)
    )
    total = (await session.execute(count_stmt)).scalar_one()

    stmt = (
        select(WorkflowLog)
        .where(WorkflowLog.workflow_id == workflow_id)
        .order_by(WorkflowLog.executed_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    result = await session.execute(stmt)
    logs = result.scalars().all()

    return PaginatedResponse(
        items=[WorkflowLogRead.model_validate(lg) for lg in logs],
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size if total else 0,
    )


@router.delete("/{log_id}", status_code=204)
async def delete_log(session: SessionDep, log_id: uuid.UUID):
    log_entry = await session.get(WorkflowLog, log_id)
    if log_entry is None:
        raise HTTPException(status_code=404, detail="Log entry not found")
    await session.delete(log_entry)
