from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.database import SessionDep
from app.engine.executor import WorkflowExecutor
from app.models.workflow import Action, Trigger, Workflow
from app.schemas.common import PaginatedResponse
from app.schemas.workflow import (
    MermaidResponse,
    WorkflowCreate,
    WorkflowExecuteRequest,
    WorkflowExecuteResponse,
    WorkflowListItem,
    WorkflowRead,
    WorkflowUpdate,
)

router = APIRouter(prefix="/api/workflows", tags=["workflows"])

SettingsDep = Annotated[Settings, Depends(get_settings)]


def _generate_mermaid(workflow: Workflow) -> str:
    """Build a Mermaid flowchart string from a workflow's triggers and actions."""
    lines = ["graph TD"]
    lines.append("    start([Start])")

    for i, trigger in enumerate(workflow.triggers):
        node_id = f"T{i}"
        label = f"{trigger.source}: {trigger.event_type}"
        lines.append(f"    {node_id}{{{{{label}}}}}")
        lines.append(f"    start --> {node_id}")

    prev_nodes = [f"T{i}" for i in range(len(workflow.triggers))] or ["start"]

    for j, action in enumerate(workflow.actions):
        node_id = f"A{j}"
        label = f"{action.target}: {action.action_type}"
        lines.append(f"    {node_id}[{label}]")
        for prev in prev_nodes:
            lines.append(f"    {prev} --> {node_id}")
        prev_nodes = [node_id]

    lines.append("    finish([End])")
    for prev in prev_nodes:
        lines.append(f"    {prev} --> finish")

    return "\n".join(lines)


@router.get("", response_model=PaginatedResponse[WorkflowListItem])
async def list_workflows(
    session: SessionDep,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 25,
):
    offset = (page - 1) * page_size

    count_stmt = select(func.count()).select_from(Workflow)
    total = (await session.execute(count_stmt)).scalar_one()

    stmt = (
        select(Workflow)
        .order_by(Workflow.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    result = await session.execute(stmt)
    workflows = result.scalars().all()

    items = [
        WorkflowListItem(
            id=w.id,
            name=w.name,
            description=w.description,
            mermaid_definition=w.mermaid_definition,
            enabled=w.enabled,
            created_at=w.created_at,
            updated_at=w.updated_at,
            trigger_count=len(w.triggers),
            action_count=len(w.actions),
        )
        for w in workflows
    ]

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size if total else 0,
    )


@router.post("", response_model=WorkflowRead, status_code=201)
async def create_workflow(session: SessionDep, payload: WorkflowCreate):
    workflow = Workflow(
        name=payload.name,
        description=payload.description,
        mermaid_definition=payload.mermaid_definition,
        enabled=payload.enabled,
    )

    for t in payload.triggers:
        workflow.triggers.append(
            Trigger(
                source=t.source,
                event_type=t.event_type,
                conditions=t.conditions,
                sort_order=t.sort_order,
            )
        )

    for a in payload.actions:
        workflow.actions.append(
            Action(
                target=a.target,
                action_type=a.action_type,
                parameters=a.parameters,
                sort_order=a.sort_order,
            )
        )

    if not workflow.mermaid_definition:
        workflow.mermaid_definition = _generate_mermaid(workflow)

    session.add(workflow)
    await session.flush()
    await session.refresh(workflow)
    return workflow


@router.get("/{workflow_id}", response_model=WorkflowRead)
async def get_workflow(session: SessionDep, workflow_id: uuid.UUID):
    stmt = select(Workflow).where(Workflow.id == workflow_id)
    result = await session.execute(stmt)
    workflow = result.scalar_one_or_none()
    if workflow is None:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return workflow


@router.put("/{workflow_id}", response_model=WorkflowRead)
async def update_workflow(session: SessionDep, workflow_id: uuid.UUID, payload: WorkflowUpdate):
    stmt = select(Workflow).where(Workflow.id == workflow_id)
    result = await session.execute(stmt)
    workflow = result.scalar_one_or_none()
    if workflow is None:
        raise HTTPException(status_code=404, detail="Workflow not found")

    if payload.name is not None:
        workflow.name = payload.name
    if payload.description is not None:
        workflow.description = payload.description
    if payload.mermaid_definition is not None:
        workflow.mermaid_definition = payload.mermaid_definition
    if payload.enabled is not None:
        workflow.enabled = payload.enabled

    if payload.triggers is not None:
        # Replace all triggers
        workflow.triggers.clear()
        for t in payload.triggers:
            workflow.triggers.append(
                Trigger(
                    source=t.source,
                    event_type=t.event_type,
                    conditions=t.conditions,
                    sort_order=t.sort_order,
                )
            )

    if payload.actions is not None:
        workflow.actions.clear()
        for a in payload.actions:
            workflow.actions.append(
                Action(
                    target=a.target,
                    action_type=a.action_type,
                    parameters=a.parameters,
                    sort_order=a.sort_order,
                )
            )

    if not workflow.mermaid_definition:
        workflow.mermaid_definition = _generate_mermaid(workflow)

    await session.flush()
    await session.refresh(workflow)
    return workflow


@router.delete("/{workflow_id}", status_code=204)
async def delete_workflow(session: SessionDep, workflow_id: uuid.UUID):
    stmt = select(Workflow).where(Workflow.id == workflow_id)
    result = await session.execute(stmt)
    workflow = result.scalar_one_or_none()
    if workflow is None:
        raise HTTPException(status_code=404, detail="Workflow not found")
    await session.delete(workflow)


@router.post("/{workflow_id}/execute", response_model=WorkflowExecuteResponse)
async def execute_workflow(
    session: SessionDep,
    settings: SettingsDep,
    workflow_id: uuid.UUID,
    payload: WorkflowExecuteRequest,
):
    # Verify existence
    stmt = select(Workflow).where(Workflow.id == workflow_id)
    result = await session.execute(stmt)
    workflow = result.scalar_one_or_none()
    if workflow is None:
        raise HTTPException(status_code=404, detail="Workflow not found")

    executor = WorkflowExecutor(session, settings)
    log_entry = await executor.execute_workflow(workflow_id, payload.trigger_data)
    await session.flush()

    return WorkflowExecuteResponse(
        workflow_id=workflow_id,
        log_id=log_entry.id,
        status=log_entry.status,
        output_data=log_entry.output_data,
        error_message=log_entry.error_message,
    )


@router.get("/{workflow_id}/mermaid", response_model=MermaidResponse)
async def get_workflow_mermaid(session: SessionDep, workflow_id: uuid.UUID):
    stmt = select(Workflow).where(Workflow.id == workflow_id)
    result = await session.execute(stmt)
    workflow = result.scalar_one_or_none()
    if workflow is None:
        raise HTTPException(status_code=404, detail="Workflow not found")

    mermaid = workflow.mermaid_definition or _generate_mermaid(workflow)
    return MermaidResponse(workflow_id=workflow.id, mermaid=mermaid)
