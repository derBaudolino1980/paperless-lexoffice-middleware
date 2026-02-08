from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import Field

from app.schemas.common import BaseSchema, TimestampMixin


# ---- Trigger schemas ----

class TriggerBase(BaseSchema):
    source: str = Field(..., pattern=r"^(paperless|lexoffice|schedule)$")
    event_type: str
    conditions: dict[str, Any] | None = None
    sort_order: int = 0


class TriggerCreate(TriggerBase):
    """Schema for creating a trigger within a workflow."""


class TriggerUpdate(BaseSchema):
    source: str | None = Field(None, pattern=r"^(paperless|lexoffice|schedule)$")
    event_type: str | None = None
    conditions: dict[str, Any] | None = None
    sort_order: int | None = None


class TriggerRead(TriggerBase):
    id: uuid.UUID
    workflow_id: uuid.UUID


# ---- Action schemas ----

class ActionBase(BaseSchema):
    target: str = Field(..., pattern=r"^(paperless|lexoffice)$")
    action_type: str
    parameters: dict[str, Any] | None = None
    sort_order: int = 0


class ActionCreate(ActionBase):
    """Schema for creating an action within a workflow."""


class ActionUpdate(BaseSchema):
    target: str | None = Field(None, pattern=r"^(paperless|lexoffice)$")
    action_type: str | None = None
    parameters: dict[str, Any] | None = None
    sort_order: int | None = None


class ActionRead(ActionBase):
    id: uuid.UUID
    workflow_id: uuid.UUID


# ---- Workflow schemas ----

class WorkflowBase(BaseSchema):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    mermaid_definition: str | None = None
    enabled: bool = True


class WorkflowCreate(WorkflowBase):
    triggers: list[TriggerCreate] = Field(default_factory=list)
    actions: list[ActionCreate] = Field(default_factory=list)


class WorkflowUpdate(BaseSchema):
    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    mermaid_definition: str | None = None
    enabled: bool | None = None
    triggers: list[TriggerCreate] | None = None
    actions: list[ActionCreate] | None = None


class WorkflowRead(WorkflowBase, TimestampMixin):
    id: uuid.UUID
    triggers: list[TriggerRead] = Field(default_factory=list)
    actions: list[ActionRead] = Field(default_factory=list)


class WorkflowListItem(WorkflowBase, TimestampMixin):
    id: uuid.UUID
    trigger_count: int = 0
    action_count: int = 0


class WorkflowExecuteRequest(BaseSchema):
    trigger_data: dict[str, Any] = Field(default_factory=dict)


class WorkflowExecuteResponse(BaseSchema):
    workflow_id: uuid.UUID
    log_id: uuid.UUID
    status: str
    output_data: dict[str, Any] | None = None
    error_message: str | None = None


class MermaidResponse(BaseSchema):
    workflow_id: uuid.UUID
    mermaid: str


# ---- WorkflowLog schemas ----

class WorkflowLogRead(BaseSchema):
    id: uuid.UUID
    workflow_id: uuid.UUID
    status: str
    input_data: dict[str, Any] | None = None
    output_data: dict[str, Any] | None = None
    error_message: str | None = None
    executed_at: datetime
