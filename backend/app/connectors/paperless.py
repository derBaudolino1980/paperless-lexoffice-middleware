from __future__ import annotations

import logging
from typing import Any

import httpx

from app.connectors.base import BaseConnector

logger = logging.getLogger(__name__)


class PaperlessConnector(BaseConnector):
    """Connector for the Paperless-ngx REST API."""

    def __init__(self, base_url: str, token: str, timeout: float = 30.0) -> None:
        self._base_url = base_url.rstrip("/")
        self._token = token
        self._client = httpx.AsyncClient(
            base_url=self._base_url,
            headers={
                "Authorization": f"Token {self._token}",
                "Accept": "application/json",
            },
            timeout=timeout,
        )

    def get_name(self) -> str:
        return "Paperless-ngx"

    async def close(self) -> None:
        await self._client.aclose()

    # ------------------------------------------------------------------
    # Connection test
    # ------------------------------------------------------------------

    async def test_connection(self) -> dict[str, Any]:
        try:
            resp = await self._client.get("/api/")
            resp.raise_for_status()
            return {"success": True, "message": "Connected to Paperless-ngx", "version": resp.json()}
        except httpx.HTTPStatusError as exc:
            return {"success": False, "message": f"HTTP {exc.response.status_code}: {exc.response.text}"}
        except httpx.RequestError as exc:
            return {"success": False, "message": f"Connection failed: {exc}"}

    # ------------------------------------------------------------------
    # Pagination helper
    # ------------------------------------------------------------------

    async def _paginate(self, url: str, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        """Follow Paperless pagination and collect all results."""
        results: list[dict[str, Any]] = []
        params = dict(params or {})
        while url:
            resp = await self._client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
            results.extend(data.get("results", []))
            next_url = data.get("next")
            if next_url:
                # next_url is absolute; switch to it directly
                url = next_url
                params = {}  # params are already embedded in next_url
            else:
                break
        return results

    # ------------------------------------------------------------------
    # Documents
    # ------------------------------------------------------------------

    async def get_documents(
        self,
        page: int = 1,
        page_size: int = 25,
        ordering: str = "-created",
        extra_params: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        params: dict[str, Any] = {"page": page, "page_size": page_size, "ordering": ordering}
        if extra_params:
            params.update(extra_params)
        resp = await self._client.get("/api/documents/", params=params)
        resp.raise_for_status()
        return resp.json()

    async def get_document(self, document_id: int) -> dict[str, Any]:
        resp = await self._client.get(f"/api/documents/{document_id}/")
        resp.raise_for_status()
        return resp.json()

    async def upload_document(
        self,
        file_content: bytes,
        filename: str,
        title: str | None = None,
        correspondent: int | None = None,
        document_type: int | None = None,
        tags: list[int] | None = None,
    ) -> dict[str, Any]:
        data: dict[str, Any] = {}
        if title:
            data["title"] = title
        if correspondent is not None:
            data["correspondent"] = str(correspondent)
        if document_type is not None:
            data["document_type"] = str(document_type)
        if tags:
            for tag_id in tags:
                data.setdefault("tags", [])
                data["tags"].append(str(tag_id))

        files = {"document": (filename, file_content, "application/octet-stream")}
        resp = await self._client.post("/api/documents/post_document/", data=data, files=files)
        resp.raise_for_status()
        return resp.json() if resp.content else {"status": "accepted", "task_id": resp.headers.get("Location", "")}

    async def update_document(self, document_id: int, data: dict[str, Any]) -> dict[str, Any]:
        resp = await self._client.patch(f"/api/documents/{document_id}/", json=data)
        resp.raise_for_status()
        return resp.json()

    async def search_documents(self, query: str, page: int = 1, page_size: int = 25) -> dict[str, Any]:
        params = {"query": query, "page": page, "page_size": page_size}
        resp = await self._client.get("/api/documents/", params=params)
        resp.raise_for_status()
        return resp.json()

    async def download_document(self, document_id: int) -> bytes:
        resp = await self._client.get(f"/api/documents/{document_id}/download/")
        resp.raise_for_status()
        return resp.content

    # ------------------------------------------------------------------
    # Correspondents
    # ------------------------------------------------------------------

    async def get_correspondents(self) -> list[dict[str, Any]]:
        return await self._paginate("/api/correspondents/")

    async def create_correspondent(self, name: str, match: str = "", matching_algorithm: int = 0) -> dict[str, Any]:
        payload = {"name": name, "match": match, "matching_algorithm": matching_algorithm}
        resp = await self._client.post("/api/correspondents/", json=payload)
        resp.raise_for_status()
        return resp.json()

    # ------------------------------------------------------------------
    # Tags
    # ------------------------------------------------------------------

    async def get_tags(self) -> list[dict[str, Any]]:
        return await self._paginate("/api/tags/")

    async def add_tag_to_document(self, document_id: int, tag_id: int) -> dict[str, Any]:
        doc = await self.get_document(document_id)
        current_tags: list[int] = doc.get("tags", [])
        if tag_id not in current_tags:
            current_tags.append(tag_id)
        return await self.update_document(document_id, {"tags": current_tags})
