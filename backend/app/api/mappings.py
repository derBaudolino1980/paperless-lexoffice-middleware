from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, select

from app.database import SessionDep
from app.models.mapping import ContactMapping
from app.schemas.common import PaginatedResponse
from app.schemas.connector import ContactMappingCreate, ContactMappingRead, ContactMappingUpdate

router = APIRouter(prefix="/api/mappings", tags=["mappings"])


@router.get("", response_model=PaginatedResponse[ContactMappingRead])
async def list_mappings(
    session: SessionDep,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 25,
):
    offset = (page - 1) * page_size

    count_stmt = select(func.count()).select_from(ContactMapping)
    total = (await session.execute(count_stmt)).scalar_one()

    stmt = (
        select(ContactMapping)
        .order_by(ContactMapping.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    result = await session.execute(stmt)
    mappings = result.scalars().all()

    return PaginatedResponse(
        items=[ContactMappingRead.model_validate(m) for m in mappings],
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size if total else 0,
    )


@router.post("", response_model=ContactMappingRead, status_code=201)
async def create_mapping(session: SessionDep, payload: ContactMappingCreate):
    # Check uniqueness on paperless_correspondent_id
    existing = await session.execute(
        select(ContactMapping).where(
            ContactMapping.paperless_correspondent_id == payload.paperless_correspondent_id
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail=f"Mapping for Paperless correspondent {payload.paperless_correspondent_id} already exists",
        )

    mapping = ContactMapping(
        paperless_correspondent_id=payload.paperless_correspondent_id,
        lexoffice_contact_id=payload.lexoffice_contact_id,
        last_synced=datetime.now(timezone.utc),
    )
    session.add(mapping)
    await session.flush()
    await session.refresh(mapping)
    return ContactMappingRead.model_validate(mapping)


@router.get("/{mapping_id}", response_model=ContactMappingRead)
async def get_mapping(session: SessionDep, mapping_id: uuid.UUID):
    mapping = await session.get(ContactMapping, mapping_id)
    if mapping is None:
        raise HTTPException(status_code=404, detail="Mapping not found")
    return ContactMappingRead.model_validate(mapping)


@router.put("/{mapping_id}", response_model=ContactMappingRead)
async def update_mapping(session: SessionDep, mapping_id: uuid.UUID, payload: ContactMappingUpdate):
    mapping = await session.get(ContactMapping, mapping_id)
    if mapping is None:
        raise HTTPException(status_code=404, detail="Mapping not found")

    if payload.paperless_correspondent_id is not None:
        mapping.paperless_correspondent_id = payload.paperless_correspondent_id
    if payload.lexoffice_contact_id is not None:
        mapping.lexoffice_contact_id = payload.lexoffice_contact_id

    mapping.last_synced = datetime.now(timezone.utc)
    await session.flush()
    await session.refresh(mapping)
    return ContactMappingRead.model_validate(mapping)


@router.delete("/{mapping_id}", status_code=204)
async def delete_mapping(session: SessionDep, mapping_id: uuid.UUID):
    mapping = await session.get(ContactMapping, mapping_id)
    if mapping is None:
        raise HTTPException(status_code=404, detail="Mapping not found")
    await session.delete(mapping)


@router.get("/by-correspondent/{correspondent_id}", response_model=ContactMappingRead)
async def get_mapping_by_correspondent(session: SessionDep, correspondent_id: int):
    stmt = select(ContactMapping).where(
        ContactMapping.paperless_correspondent_id == correspondent_id
    )
    result = await session.execute(stmt)
    mapping = result.scalar_one_or_none()
    if mapping is None:
        raise HTTPException(status_code=404, detail="No mapping for this correspondent")
    return ContactMappingRead.model_validate(mapping)


@router.get("/by-contact/{contact_id}", response_model=list[ContactMappingRead])
async def get_mappings_by_contact(session: SessionDep, contact_id: str):
    stmt = select(ContactMapping).where(ContactMapping.lexoffice_contact_id == contact_id)
    result = await session.execute(stmt)
    mappings = result.scalars().all()
    return [ContactMappingRead.model_validate(m) for m in mappings]
