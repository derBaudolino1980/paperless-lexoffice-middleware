from __future__ import annotations

import uuid
from typing import Annotated

from cryptography.fernet import Fernet
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.connectors.lexoffice import LexofficeConnector
from app.connectors.paperless import PaperlessConnector
from app.database import SessionDep
from app.models.connector import ConnectorConfig
from app.schemas.common import PaginatedResponse
from app.schemas.connector import (
    ConnectorCreate,
    ConnectorRead,
    ConnectorTestResult,
    ConnectorUpdate,
)

router = APIRouter(prefix="/api/connectors", tags=["connectors"])

SettingsDep = Annotated[Settings, Depends(get_settings)]


def _encrypt_key(plain: str, encryption_key: str) -> str:
    if not encryption_key:
        return plain
    f = Fernet(encryption_key.encode())
    return f.encrypt(plain.encode()).decode()


def _decrypt_key(cipher: str, encryption_key: str) -> str:
    if not encryption_key:
        return cipher
    f = Fernet(encryption_key.encode())
    return f.decrypt(cipher.encode()).decode()


def _to_read(config: ConnectorConfig) -> ConnectorRead:
    return ConnectorRead(
        id=config.id,
        connector_type=config.connector_type,
        base_url=config.base_url,
        settings=config.settings,
        active=config.active,
        api_key_set=config.api_key_encrypted is not None and len(config.api_key_encrypted) > 0,
        created_at=config.created_at,
        updated_at=config.updated_at,
    )


@router.get("", response_model=PaginatedResponse[ConnectorRead])
async def list_connectors(
    session: SessionDep,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 25,
):
    offset = (page - 1) * page_size

    count_stmt = select(func.count()).select_from(ConnectorConfig)
    total = (await session.execute(count_stmt)).scalar_one()

    stmt = (
        select(ConnectorConfig)
        .order_by(ConnectorConfig.connector_type)
        .offset(offset)
        .limit(page_size)
    )
    result = await session.execute(stmt)
    configs = result.scalars().all()

    return PaginatedResponse(
        items=[_to_read(c) for c in configs],
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size if total else 0,
    )


@router.post("", response_model=ConnectorRead, status_code=201)
async def create_connector(session: SessionDep, settings: SettingsDep, payload: ConnectorCreate):
    # Check for duplicate connector type
    existing = await session.execute(
        select(ConnectorConfig).where(ConnectorConfig.connector_type == payload.connector_type)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Connector '{payload.connector_type}' already exists")

    config = ConnectorConfig(
        connector_type=payload.connector_type,
        base_url=payload.base_url,
        api_key_encrypted=_encrypt_key(payload.api_key, settings.ENCRYPTION_KEY),
        settings=payload.settings,
        active=payload.active,
    )
    session.add(config)
    await session.flush()
    await session.refresh(config)
    return _to_read(config)


@router.get("/{connector_id}", response_model=ConnectorRead)
async def get_connector(session: SessionDep, connector_id: uuid.UUID):
    config = await session.get(ConnectorConfig, connector_id)
    if config is None:
        raise HTTPException(status_code=404, detail="Connector not found")
    return _to_read(config)


@router.put("/{connector_id}", response_model=ConnectorRead)
async def update_connector(
    session: SessionDep,
    settings: SettingsDep,
    connector_id: uuid.UUID,
    payload: ConnectorUpdate,
):
    config = await session.get(ConnectorConfig, connector_id)
    if config is None:
        raise HTTPException(status_code=404, detail="Connector not found")

    if payload.base_url is not None:
        config.base_url = payload.base_url
    if payload.api_key is not None:
        config.api_key_encrypted = _encrypt_key(payload.api_key, settings.ENCRYPTION_KEY)
    if payload.settings is not None:
        config.settings = payload.settings
    if payload.active is not None:
        config.active = payload.active

    await session.flush()
    await session.refresh(config)
    return _to_read(config)


@router.delete("/{connector_id}", status_code=204)
async def delete_connector(session: SessionDep, connector_id: uuid.UUID):
    config = await session.get(ConnectorConfig, connector_id)
    if config is None:
        raise HTTPException(status_code=404, detail="Connector not found")
    await session.delete(config)


@router.post("/{connector_id}/test", response_model=ConnectorTestResult)
async def test_connector(session: SessionDep, settings: SettingsDep, connector_id: uuid.UUID):
    config = await session.get(ConnectorConfig, connector_id)
    if config is None:
        raise HTTPException(status_code=404, detail="Connector not found")

    api_key = _decrypt_key(config.api_key_encrypted or "", settings.ENCRYPTION_KEY)

    connector = None
    try:
        if config.connector_type == "paperless":
            connector = PaperlessConnector(base_url=config.base_url, token=api_key)
        elif config.connector_type == "lexoffice":
            connector = LexofficeConnector(base_url=config.base_url, api_key=api_key)
        else:
            return ConnectorTestResult(
                connector_type=config.connector_type,
                success=False,
                message=f"Unknown connector type: {config.connector_type}",
            )

        result = await connector.test_connection()
        return ConnectorTestResult(
            connector_type=config.connector_type,
            success=result.get("success", False),
            message=result.get("message", ""),
            details={k: v for k, v in result.items() if k not in ("success", "message")},
        )
    finally:
        if connector:
            await connector.close()
