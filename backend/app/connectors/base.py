from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class BaseConnector(ABC):
    """Abstract base class for all external service connectors."""

    @abstractmethod
    async def test_connection(self) -> dict[str, Any]:
        """Test the connection to the external service.

        Returns a dict with at least:
            - success (bool)
            - message (str)
        """

    @abstractmethod
    def get_name(self) -> str:
        """Return a human-readable name for this connector."""

    async def close(self) -> None:
        """Clean up resources. Subclasses should override if they hold open connections."""
