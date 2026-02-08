from __future__ import annotations

import uuid
from typing import Any

from pydantic import Field

from app.schemas.common import BaseSchema, TimestampMixin


class ConnectorBase(BaseSchema):
    connector_type: str = Field(..., pattern=r"^(paperless|lexoffice)$")
    base_url: str = Field(..., min_length=1, max_length=500)
    settings: dict[str, Any] | None = None
    active: bool = True


class ConnectorCreate(ConnectorBase):
    api_key: str = Field(..., min_length=1, description="Plain-text API key, will be encrypted at rest")


class ConnectorUpdate(BaseSchema):
    base_url: str | None = Field(None, min_length=1, max_length=500)
    api_key: str | None = Field(None, min_length=1, description="New API key (optional)")
    settings: dict[str, Any] | None = None
    active: bool | None = None


class ConnectorRead(ConnectorBase, TimestampMixin):
    id: uuid.UUID
    api_key_set: bool = Field(
        default=False,
        description="Indicates whether an API key has been stored (never exposes the actual key)",
    )


class ConnectorTestResult(BaseSchema):
    connector_type: str
    success: bool
    message: str
    details: dict[str, Any] | None = None


class ContactMappingBase(BaseSchema):
    paperless_correspondent_id: int
    lexoffice_contact_id: str


class ContactMappingCreate(ContactMappingBase):
    """Create a new contact mapping."""


class ContactMappingUpdate(BaseSchema):
    paperless_correspondent_id: int | None = None
    lexoffice_contact_id: str | None = None


class ContactMappingRead(ContactMappingBase, TimestampMixin):
    id: uuid.UUID
    last_synced: Any | None = None
