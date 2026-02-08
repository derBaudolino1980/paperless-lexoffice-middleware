from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from app.connectors.lexoffice import LexofficeConnector
from app.connectors.paperless import PaperlessConnector
from app.config import Settings
from app.models.workflow import Action

logger = logging.getLogger(__name__)


class ActionRunner:
    """Runs individual workflow actions using the appropriate connector."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._paperless: PaperlessConnector | None = None
        self._lexoffice: LexofficeConnector | None = None

    # ------------------------------------------------------------------
    # Lazy connector access
    # ------------------------------------------------------------------

    def _get_paperless(self) -> PaperlessConnector:
        if self._paperless is None:
            self._paperless = PaperlessConnector(
                base_url=self._settings.PAPERLESS_URL,
                token=self._settings.PAPERLESS_TOKEN,
            )
        return self._paperless

    def _get_lexoffice(self) -> LexofficeConnector:
        if self._lexoffice is None:
            self._lexoffice = LexofficeConnector(
                base_url=self._settings.LEXOFFICE_URL,
                api_key=self._settings.LEXOFFICE_API_KEY,
            )
        return self._lexoffice

    async def close(self) -> None:
        if self._paperless:
            await self._paperless.close()
        if self._lexoffice:
            await self._lexoffice.close()

    # ------------------------------------------------------------------
    # Dispatcher
    # ------------------------------------------------------------------

    async def run_action(self, action: Action, context: dict[str, Any]) -> dict[str, Any]:
        """Execute a single action and return its result dict."""
        handler = self._action_map.get(action.action_type)
        if handler is None:
            raise ValueError(f"Unknown action type: {action.action_type}")
        return await handler(self, action, context)

    # ------------------------------------------------------------------
    # Action implementations
    # ------------------------------------------------------------------

    async def _create_lexoffice_voucher(self, action: Action, context: dict[str, Any]) -> dict[str, Any]:
        lex = self._get_lexoffice()
        params = action.parameters or {}

        voucher_data: dict[str, Any] = {
            "type": params.get("voucher_type", "purchaseinvoice"),
            "voucherNumber": params.get("voucher_number", ""),
            "voucherDate": params.get("voucher_date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
            "totalGrossAmount": params.get("total_gross_amount", context.get("total_gross_amount", 0)),
            "taxType": params.get("tax_type", "gross"),
            "voucherItems": params.get("voucher_items", []),
        }

        if contact_id := (params.get("contact_id") or context.get("lexoffice_contact_id")):
            voucher_data["contactId"] = contact_id

        result = await lex.create_voucher(voucher_data)
        logger.info("Created Lexoffice voucher: %s", result.get("id"))
        return {"voucher": result}

    async def _upload_to_paperless(self, action: Action, context: dict[str, Any]) -> dict[str, Any]:
        pl = self._get_paperless()
        params = action.parameters or {}

        file_content: bytes = context.get("file_content", b"")
        filename: str = params.get("filename", context.get("filename", "document.pdf"))
        title: str | None = params.get("title") or context.get("title")
        correspondent: int | None = params.get("correspondent_id") or context.get("correspondent_id")
        document_type: int | None = params.get("document_type_id") or context.get("document_type_id")
        tags: list[int] | None = params.get("tag_ids") or context.get("tag_ids")

        result = await pl.upload_document(
            file_content=file_content,
            filename=filename,
            title=title,
            correspondent=correspondent,
            document_type=document_type,
            tags=tags,
        )
        logger.info("Uploaded document to Paperless: %s", result)
        return {"upload": result}

    async def _sync_contact(self, action: Action, context: dict[str, Any]) -> dict[str, Any]:
        pl = self._get_paperless()
        lex = self._get_lexoffice()
        params = action.parameters or {}

        correspondent_name: str = params.get("correspondent_name", context.get("correspondent_name", ""))
        if not correspondent_name:
            return {"synced": False, "reason": "No correspondent name provided"}

        # Search Lexoffice for matching contact
        search_result = await lex.search_contacts(name=correspondent_name)
        contacts = search_result.get("content", [])

        if contacts:
            contact = contacts[0]
            contact_id = contact.get("id", "")
            logger.info("Found existing Lexoffice contact: %s", contact_id)
            return {"synced": True, "lexoffice_contact_id": contact_id, "created": False}

        # Create new contact in Lexoffice
        new_contact = await lex.create_contact({
            "version": 0,
            "roles": {"customer": {}},
            "company": {"name": correspondent_name},
        })
        contact_id = new_contact.get("id", "")
        logger.info("Created new Lexoffice contact: %s", contact_id)
        return {"synced": True, "lexoffice_contact_id": contact_id, "created": True}

    async def _set_tag(self, action: Action, context: dict[str, Any]) -> dict[str, Any]:
        pl = self._get_paperless()
        params = action.parameters or {}

        document_id: int = params.get("document_id") or context.get("document_id", 0)
        tag_id: int = params.get("tag_id", 0)

        if not document_id or not tag_id:
            return {"tagged": False, "reason": "Missing document_id or tag_id"}

        result = await pl.add_tag_to_document(document_id, tag_id)
        logger.info("Added tag %d to document %d", tag_id, document_id)
        return {"tagged": True, "document": result}

    async def _download_document(self, action: Action, context: dict[str, Any]) -> dict[str, Any]:
        pl = self._get_paperless()
        params = action.parameters or {}

        document_id: int = params.get("document_id") or context.get("document_id", 0)
        if not document_id:
            return {"downloaded": False, "reason": "Missing document_id"}

        content = await pl.download_document(document_id)
        doc_meta = await pl.get_document(document_id)
        filename = doc_meta.get("original_file_name", f"document_{document_id}.pdf")

        # Store in context for downstream actions
        context["file_content"] = content
        context["filename"] = filename
        logger.info("Downloaded document %d (%d bytes)", document_id, len(content))
        return {"downloaded": True, "filename": filename, "size": len(content)}

    # ------------------------------------------------------------------
    # Action type registry
    # ------------------------------------------------------------------

    _action_map: dict[str, Any] = {
        "create_lexoffice_voucher": _create_lexoffice_voucher,
        "upload_to_paperless": _upload_to_paperless,
        "sync_contact": _sync_contact,
        "set_tag": _set_tag,
        "download_document": _download_document,
    }
