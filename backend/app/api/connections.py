"""Dedicated connection management endpoints for the frontend.

These provide a simpler interface than the generic connector CRUD:
- Test a connection by type (paperless/lexoffice) with inline credentials
- Save a connection by type (creates or updates the connector)
"""
from __future__ import annotations

from typing import Annotated, Any

from cryptography.fernet import Fernet
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.config import Settings, get_settings
from app.connectors.lexoffice import LexofficeConnector
from app.connectors.paperless import PaperlessConnector
from app.database import SessionDep
from app.models.connector import ConnectorConfig

router = APIRouter(prefix="/api/connections", tags=["connections"])

SettingsDep = Annotated[Settings, Depends(get_settings)]


class PaperlessTestRequest(BaseModel):
    url: str = Field(..., min_length=1)
    token: str = Field(..., min_length=1)


class LexofficeTestRequest(BaseModel):
    api_key: str = Field(..., min_length=1)


class ConnectionTestResponse(BaseModel):
    success: bool
    message: str
    details: dict[str, Any] | None = None


class PaperlessSaveRequest(BaseModel):
    url: str = Field(..., min_length=1)
    token: str = Field(..., min_length=1)


class LexofficeSaveRequest(BaseModel):
    api_key: str = Field(..., min_length=1)


class ConnectionSaveResponse(BaseModel):
    success: bool
    message: str


def _encrypt(plain: str, key: str) -> str:
    if not key:
        return plain
    return Fernet(key.encode()).encrypt(plain.encode()).decode()


# ── Test endpoints ──────────────────────────────────────────────


@router.post("/paperless/test", response_model=ConnectionTestResponse)
async def test_paperless(payload: PaperlessTestRequest):
    connector = PaperlessConnector(base_url=payload.url, token=payload.token)
    try:
        result = await connector.test_connection()
        return ConnectionTestResponse(
            success=result.get("success", False),
            message=result.get("message", "Verbindungstest abgeschlossen"),
            details={k: v for k, v in result.items() if k not in ("success", "message")},
        )
    except Exception as exc:
        return ConnectionTestResponse(success=False, message=str(exc))
    finally:
        await connector.close()


@router.post("/lexoffice/test", response_model=ConnectionTestResponse)
async def test_lexoffice(payload: LexofficeTestRequest):
    connector = LexofficeConnector(api_key=payload.api_key)
    try:
        result = await connector.test_connection()
        return ConnectionTestResponse(
            success=result.get("success", False),
            message=result.get("message", "Verbindungstest abgeschlossen"),
            details={k: v for k, v in result.items() if k not in ("success", "message")},
        )
    except Exception as exc:
        return ConnectionTestResponse(success=False, message=str(exc))
    finally:
        await connector.close()


# ── Save endpoints ──────────────────────────────────────────────


@router.put("/paperless", response_model=ConnectionSaveResponse)
async def save_paperless(session: SessionDep, settings: SettingsDep, payload: PaperlessSaveRequest):
    stmt = select(ConnectorConfig).where(ConnectorConfig.connector_type == "paperless")
    existing = (await session.execute(stmt)).scalar_one_or_none()

    encrypted_key = _encrypt(payload.token, settings.ENCRYPTION_KEY)

    if existing:
        existing.base_url = payload.url
        existing.api_key_encrypted = encrypted_key
    else:
        config = ConnectorConfig(
            connector_type="paperless",
            base_url=payload.url,
            api_key_encrypted=encrypted_key,
            active=True,
        )
        session.add(config)

    await session.flush()
    return ConnectionSaveResponse(success=True, message="Paperless-Konfiguration gespeichert")


@router.put("/lexoffice", response_model=ConnectionSaveResponse)
async def save_lexoffice(session: SessionDep, settings: SettingsDep, payload: LexofficeSaveRequest):
    stmt = select(ConnectorConfig).where(ConnectorConfig.connector_type == "lexoffice")
    existing = (await session.execute(stmt)).scalar_one_or_none()

    encrypted_key = _encrypt(payload.api_key, settings.ENCRYPTION_KEY)

    if existing:
        existing.api_key_encrypted = encrypted_key
    else:
        config = ConnectorConfig(
            connector_type="lexoffice",
            base_url=settings.LEXOFFICE_URL,
            api_key_encrypted=encrypted_key,
            active=True,
        )
        session.add(config)

    await session.flush()
    return ConnectionSaveResponse(success=True, message="Lexoffice-Konfiguration gespeichert")
