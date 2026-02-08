from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

import httpx

from app.connectors.base import BaseConnector

logger = logging.getLogger(__name__)

# Lexoffice enforces a rate limit of 2 requests per second.
_RATE_LIMIT_INTERVAL: float = 0.5  # seconds between requests


class LexofficeConnector(BaseConnector):
    """Connector for the Lexoffice / Lexware Office REST API."""

    def __init__(self, base_url: str = "https://api.lexware.io", api_key: str = "", timeout: float = 30.0) -> None:
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key
        self._client = httpx.AsyncClient(
            base_url=self._base_url,
            headers={
                "Authorization": f"Bearer {self._api_key}",
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
            timeout=timeout,
        )
        self._last_request_time: float = 0.0

    def get_name(self) -> str:
        return "Lexoffice"

    async def close(self) -> None:
        await self._client.aclose()

    # ------------------------------------------------------------------
    # Rate-limit helper
    # ------------------------------------------------------------------

    async def _throttle(self) -> None:
        """Enforce the 2 req/s rate limit by sleeping if necessary."""
        now = time.monotonic()
        elapsed = now - self._last_request_time
        if elapsed < _RATE_LIMIT_INTERVAL:
            await asyncio.sleep(_RATE_LIMIT_INTERVAL - elapsed)
        self._last_request_time = time.monotonic()

    async def _request(
        self,
        method: str,
        url: str,
        *,
        json: Any | None = None,
        params: dict[str, Any] | None = None,
        content: bytes | None = None,
        headers: dict[str, str] | None = None,
    ) -> httpx.Response:
        await self._throttle()
        resp = await self._client.request(method, url, json=json, params=params, content=content, headers=headers)
        resp.raise_for_status()
        return resp

    # ------------------------------------------------------------------
    # Connection test
    # ------------------------------------------------------------------

    async def test_connection(self) -> dict[str, Any]:
        try:
            resp = await self._request("GET", "/v1/profile")
            profile = resp.json()
            return {
                "success": True,
                "message": "Connected to Lexoffice",
                "organization": profile.get("organizationId", ""),
            }
        except httpx.HTTPStatusError as exc:
            return {"success": False, "message": f"HTTP {exc.response.status_code}: {exc.response.text}"}
        except httpx.RequestError as exc:
            return {"success": False, "message": f"Connection failed: {exc}"}

    # ------------------------------------------------------------------
    # Contacts
    # ------------------------------------------------------------------

    async def get_contacts(self, page: int = 0, size: int = 25) -> dict[str, Any]:
        resp = await self._request("GET", "/v1/contacts", params={"page": page, "size": size})
        return resp.json()

    async def get_contact(self, contact_id: str) -> dict[str, Any]:
        resp = await self._request("GET", f"/v1/contacts/{contact_id}")
        return resp.json()

    async def create_contact(self, contact_data: dict[str, Any]) -> dict[str, Any]:
        resp = await self._request("POST", "/v1/contacts", json=contact_data)
        return resp.json()

    async def search_contacts(
        self,
        name: str | None = None,
        email: str | None = None,
        customer: bool | None = None,
        vendor: bool | None = None,
        page: int = 0,
        size: int = 25,
    ) -> dict[str, Any]:
        params: dict[str, Any] = {"page": page, "size": size}
        if name is not None:
            params["name"] = name
        if email is not None:
            params["email"] = email
        if customer is not None:
            params["customer"] = str(customer).lower()
        if vendor is not None:
            params["vendor"] = str(vendor).lower()
        resp = await self._request("GET", "/v1/contacts", params=params)
        return resp.json()

    # ------------------------------------------------------------------
    # Invoices
    # ------------------------------------------------------------------

    async def get_invoices(self, page: int = 0, size: int = 25, **filters: Any) -> dict[str, Any]:
        params: dict[str, Any] = {"page": page, "size": size, **filters}
        resp = await self._request("GET", "/v1/voucherlist", params=params)
        return resp.json()

    async def get_invoice(self, invoice_id: str) -> dict[str, Any]:
        resp = await self._request("GET", f"/v1/invoices/{invoice_id}")
        return resp.json()

    # ------------------------------------------------------------------
    # Vouchers
    # ------------------------------------------------------------------

    async def create_voucher(self, voucher_data: dict[str, Any]) -> dict[str, Any]:
        resp = await self._request("POST", "/v1/vouchers", json=voucher_data)
        return resp.json()

    async def get_voucher(self, voucher_id: str) -> dict[str, Any]:
        resp = await self._request("GET", f"/v1/vouchers/{voucher_id}")
        return resp.json()

    async def upload_file_to_voucher(self, voucher_id: str, file_content: bytes, filename: str) -> dict[str, Any]:
        """Upload a file attachment to an existing voucher."""
        await self._throttle()
        # File uploads require multipart/form-data, so we bypass the default JSON content-type
        resp = await self._client.post(
            f"/v1/vouchers/{voucher_id}/files",
            files={"file": (filename, file_content, "application/octet-stream")},
            headers={
                "Authorization": f"Bearer {self._api_key}",
                "Accept": "application/json",
            },
        )
        self._last_request_time = time.monotonic()
        resp.raise_for_status()
        return resp.json() if resp.content else {"status": "uploaded"}

    # ------------------------------------------------------------------
    # Event subscriptions (webhooks)
    # ------------------------------------------------------------------

    async def create_event_subscription(self, event_type: str, callback_url: str) -> dict[str, Any]:
        payload = {"eventType": event_type, "callbackUrl": callback_url}
        resp = await self._request("POST", "/v1/event-subscriptions", json=payload)
        return resp.json()

    async def delete_event_subscription(self, subscription_id: str) -> None:
        await self._request("DELETE", f"/v1/event-subscriptions/{subscription_id}")
