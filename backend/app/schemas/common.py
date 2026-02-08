from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


class BaseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class TimestampMixin(BaseSchema):
    created_at: datetime
    updated_at: datetime


class PaginatedResponse(BaseSchema, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
    pages: int


class StatusResponse(BaseSchema):
    status: str
    message: str
    details: dict[str, Any] | None = None


class HealthResponse(BaseSchema):
    status: str
    version: str
    database: str
    redis: str


class DashboardStats(BaseSchema):
    total_workflows: int
    active_workflows: int
    total_executions: int
    successful_executions: int
    failed_executions: int
    total_mappings: int
    recent_logs: list[dict[str, Any]]
