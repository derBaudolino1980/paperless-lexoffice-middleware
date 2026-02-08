from __future__ import annotations

import asyncio
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.connectors.lexoffice import LexofficeConnector
from app.connectors.paperless import PaperlessConnector
from app.engine.triggers import TriggerHandler


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def paperless_connector():
    return PaperlessConnector(base_url="http://paperless.test", token="test-token")


@pytest.fixture
def lexoffice_connector():
    return LexofficeConnector(base_url="https://api.lexware.io", api_key="test-key")


@pytest.fixture
def trigger_handler():
    return TriggerHandler()


# ---------------------------------------------------------------------------
# PaperlessConnector
# ---------------------------------------------------------------------------


class TestPaperlessConnector:
    def test_get_name(self, paperless_connector: PaperlessConnector):
        assert paperless_connector.get_name() == "Paperless-ngx"

    @pytest.mark.asyncio
    async def test_test_connection_success(self, paperless_connector: PaperlessConnector):
        mock_response = httpx.Response(200, json={"documents": "/api/documents/"})
        with patch.object(paperless_connector._client, "get", new_callable=AsyncMock, return_value=mock_response):
            result = await paperless_connector.test_connection()
            assert result["success"] is True
            assert "Connected" in result["message"]

    @pytest.mark.asyncio
    async def test_test_connection_failure(self, paperless_connector: PaperlessConnector):
        with patch.object(
            paperless_connector._client,
            "get",
            new_callable=AsyncMock,
            side_effect=httpx.RequestError("Connection refused"),
        ):
            result = await paperless_connector.test_connection()
            assert result["success"] is False
            assert "Connection failed" in result["message"]

    @pytest.mark.asyncio
    async def test_get_documents(self, paperless_connector: PaperlessConnector):
        mock_data = {
            "count": 2,
            "next": None,
            "previous": None,
            "results": [
                {"id": 1, "title": "Invoice A"},
                {"id": 2, "title": "Invoice B"},
            ],
        }
        mock_response = httpx.Response(200, json=mock_data)
        with patch.object(paperless_connector._client, "get", new_callable=AsyncMock, return_value=mock_response):
            result = await paperless_connector.get_documents()
            assert result["count"] == 2
            assert len(result["results"]) == 2

    @pytest.mark.asyncio
    async def test_get_document(self, paperless_connector: PaperlessConnector):
        mock_response = httpx.Response(200, json={"id": 42, "title": "Test doc"})
        with patch.object(paperless_connector._client, "get", new_callable=AsyncMock, return_value=mock_response):
            result = await paperless_connector.get_document(42)
            assert result["id"] == 42

    @pytest.mark.asyncio
    async def test_get_correspondents(self, paperless_connector: PaperlessConnector):
        page1 = {"count": 2, "next": None, "results": [{"id": 1, "name": "Acme"}]}
        mock_response = httpx.Response(200, json=page1)
        with patch.object(paperless_connector._client, "get", new_callable=AsyncMock, return_value=mock_response):
            result = await paperless_connector.get_correspondents()
            assert len(result) == 1
            assert result[0]["name"] == "Acme"

    @pytest.mark.asyncio
    async def test_close(self, paperless_connector: PaperlessConnector):
        with patch.object(paperless_connector._client, "aclose", new_callable=AsyncMock) as mock_close:
            await paperless_connector.close()
            mock_close.assert_called_once()


# ---------------------------------------------------------------------------
# LexofficeConnector
# ---------------------------------------------------------------------------


class TestLexofficeConnector:
    def test_get_name(self, lexoffice_connector: LexofficeConnector):
        assert lexoffice_connector.get_name() == "Lexoffice"

    @pytest.mark.asyncio
    async def test_test_connection_success(self, lexoffice_connector: LexofficeConnector):
        mock_response = httpx.Response(200, json={"organizationId": "org-123"})
        with patch.object(lexoffice_connector._client, "request", new_callable=AsyncMock, return_value=mock_response):
            result = await lexoffice_connector.test_connection()
            assert result["success"] is True
            assert result["organization"] == "org-123"

    @pytest.mark.asyncio
    async def test_test_connection_http_error(self, lexoffice_connector: LexofficeConnector):
        mock_response = httpx.Response(401, text="Unauthorized", request=httpx.Request("GET", "https://api.lexware.io/v1/profile"))
        with patch.object(
            lexoffice_connector._client,
            "request",
            new_callable=AsyncMock,
            side_effect=httpx.HTTPStatusError("401", request=mock_response.request, response=mock_response),
        ):
            result = await lexoffice_connector.test_connection()
            assert result["success"] is False
            assert "401" in result["message"]

    @pytest.mark.asyncio
    async def test_get_contacts(self, lexoffice_connector: LexofficeConnector):
        mock_data = {"content": [{"id": "c1", "company": {"name": "Foo"}}], "totalElements": 1}
        mock_response = httpx.Response(200, json=mock_data)
        with patch.object(lexoffice_connector._client, "request", new_callable=AsyncMock, return_value=mock_response):
            result = await lexoffice_connector.get_contacts()
            assert result["totalElements"] == 1

    @pytest.mark.asyncio
    async def test_create_voucher(self, lexoffice_connector: LexofficeConnector):
        mock_response = httpx.Response(200, json={"id": "v-123", "status": "open"})
        with patch.object(lexoffice_connector._client, "request", new_callable=AsyncMock, return_value=mock_response):
            result = await lexoffice_connector.create_voucher({"type": "purchaseinvoice"})
            assert result["id"] == "v-123"

    @pytest.mark.asyncio
    async def test_close(self, lexoffice_connector: LexofficeConnector):
        with patch.object(lexoffice_connector._client, "aclose", new_callable=AsyncMock) as mock_close:
            await lexoffice_connector.close()
            mock_close.assert_called_once()


# ---------------------------------------------------------------------------
# TriggerHandler
# ---------------------------------------------------------------------------


class TestTriggerHandler:
    def _make_trigger(
        self,
        source: str = "paperless",
        event_type: str = "document_created",
        conditions: dict[str, Any] | None = None,
    ):
        trigger = MagicMock()
        trigger.source = source
        trigger.event_type = event_type
        trigger.conditions = conditions
        return trigger

    @pytest.mark.asyncio
    async def test_basic_match(self, trigger_handler: TriggerHandler):
        trigger = self._make_trigger()
        event = {"source": "paperless", "event_type": "document_created"}
        assert await trigger_handler.evaluate_trigger(trigger, event) is True

    @pytest.mark.asyncio
    async def test_source_mismatch(self, trigger_handler: TriggerHandler):
        trigger = self._make_trigger(source="paperless")
        event = {"source": "lexoffice", "event_type": "document_created"}
        assert await trigger_handler.evaluate_trigger(trigger, event) is False

    @pytest.mark.asyncio
    async def test_event_type_mismatch(self, trigger_handler: TriggerHandler):
        trigger = self._make_trigger(event_type="document_created")
        event = {"source": "paperless", "event_type": "document_deleted"}
        assert await trigger_handler.evaluate_trigger(trigger, event) is False

    @pytest.mark.asyncio
    async def test_condition_eq(self, trigger_handler: TriggerHandler):
        trigger = self._make_trigger(conditions={"field": "document_id", "operator": "eq", "value": 42})
        event = {"source": "paperless", "event_type": "document_created", "document_id": 42}
        assert await trigger_handler.evaluate_trigger(trigger, event) is True

    @pytest.mark.asyncio
    async def test_condition_contains(self, trigger_handler: TriggerHandler):
        trigger = self._make_trigger(
            conditions={"field": "payload.tags", "operator": "contains", "value": "invoice"}
        )
        event = {
            "source": "paperless",
            "event_type": "document_created",
            "payload": {"tags": ["invoice", "receipt"]},
        }
        assert await trigger_handler.evaluate_trigger(trigger, event) is True

    @pytest.mark.asyncio
    async def test_condition_all(self, trigger_handler: TriggerHandler):
        trigger = self._make_trigger(
            conditions={
                "all": [
                    {"field": "document_id", "operator": "gt", "value": 10},
                    {"field": "document_id", "operator": "lt", "value": 100},
                ]
            }
        )
        event = {"source": "paperless", "event_type": "document_created", "document_id": 50}
        assert await trigger_handler.evaluate_trigger(trigger, event) is True

    @pytest.mark.asyncio
    async def test_condition_any(self, trigger_handler: TriggerHandler):
        trigger = self._make_trigger(
            conditions={
                "any": [
                    {"field": "document_id", "operator": "eq", "value": 1},
                    {"field": "document_id", "operator": "eq", "value": 2},
                ]
            }
        )
        event = {"source": "paperless", "event_type": "document_created", "document_id": 2}
        assert await trigger_handler.evaluate_trigger(trigger, event) is True

    @pytest.mark.asyncio
    async def test_condition_exists(self, trigger_handler: TriggerHandler):
        trigger = self._make_trigger(
            conditions={"field": "payload.custom_field", "operator": "exists", "value": True}
        )
        event = {
            "source": "paperless",
            "event_type": "document_created",
            "payload": {"custom_field": "some_value"},
        }
        assert await trigger_handler.evaluate_trigger(trigger, event) is True

    @pytest.mark.asyncio
    async def test_condition_matches_regex(self, trigger_handler: TriggerHandler):
        trigger = self._make_trigger(
            conditions={"field": "payload.title", "operator": "matches", "value": r"^INV-\d+"}
        )
        event = {
            "source": "paperless",
            "event_type": "document_created",
            "payload": {"title": "INV-20240101-001"},
        }
        assert await trigger_handler.evaluate_trigger(trigger, event) is True

    @pytest.mark.asyncio
    async def test_no_conditions_passes(self, trigger_handler: TriggerHandler):
        trigger = self._make_trigger(conditions=None)
        event = {"source": "paperless", "event_type": "document_created"}
        assert await trigger_handler.evaluate_trigger(trigger, event) is True
