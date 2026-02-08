from __future__ import annotations

import logging
import re
from typing import Any

from app.models.workflow import Trigger

logger = logging.getLogger(__name__)


class TriggerHandler:
    """Evaluates whether an incoming event matches a trigger's conditions."""

    async def evaluate_trigger(self, trigger: Trigger, event_data: dict[str, Any]) -> bool:
        """Return True when *event_data* satisfies all conditions on *trigger*."""
        # 1. Source must match
        event_source = event_data.get("source", "")
        if event_source and event_source != trigger.source:
            logger.debug("Source mismatch: event=%s trigger=%s", event_source, trigger.source)
            return False

        # 2. Event type must match
        event_type = event_data.get("event_type", "")
        if event_type and event_type != trigger.event_type:
            logger.debug("Event type mismatch: event=%s trigger=%s", event_type, trigger.event_type)
            return False

        # 3. Evaluate condition rules (if any)
        conditions: dict[str, Any] = trigger.conditions or {}
        if not conditions:
            return True

        return self._evaluate_conditions(conditions, event_data)

    # ------------------------------------------------------------------
    # Condition evaluation
    # ------------------------------------------------------------------

    def _evaluate_conditions(self, conditions: dict[str, Any], event_data: dict[str, Any]) -> bool:
        """
        Supported condition shapes:

        {
            "all": [ ...list of conditions... ],   # AND
            "any": [ ...list of conditions... ],   # OR
            "field": "some.nested.field",
            "operator": "eq | ne | contains | in | matches | gt | lt | exists",
            "value": <expected>
        }
        """
        # Composite: ALL (AND)
        if "all" in conditions:
            return all(self._evaluate_conditions(c, event_data) for c in conditions["all"])

        # Composite: ANY (OR)
        if "any" in conditions:
            return any(self._evaluate_conditions(c, event_data) for c in conditions["any"])

        # Leaf condition
        field = conditions.get("field")
        operator = conditions.get("operator", "eq")
        expected = conditions.get("value")

        if field is None:
            logger.warning("Condition missing 'field': %s", conditions)
            return True  # no constraint -> pass

        actual = self._resolve_field(field, event_data)
        return self._compare(operator, actual, expected)

    @staticmethod
    def _resolve_field(field_path: str, data: dict[str, Any]) -> Any:
        """Resolve a dot-separated field path in nested dicts/lists."""
        parts = field_path.split(".")
        current: Any = data
        for part in parts:
            if isinstance(current, dict):
                current = current.get(part)
            elif isinstance(current, (list, tuple)) and part.isdigit():
                idx = int(part)
                current = current[idx] if idx < len(current) else None
            else:
                return None
        return current

    @staticmethod
    def _compare(operator: str, actual: Any, expected: Any) -> bool:
        if operator == "eq":
            return actual == expected
        if operator == "ne":
            return actual != expected
        if operator == "contains":
            if isinstance(actual, str):
                return str(expected) in actual
            if isinstance(actual, (list, tuple)):
                return expected in actual
            return False
        if operator == "in":
            # expected is a list; check if actual is in it
            if isinstance(expected, (list, tuple)):
                return actual in expected
            return False
        if operator == "matches":
            if isinstance(actual, str) and isinstance(expected, str):
                return bool(re.search(expected, actual))
            return False
        if operator == "gt":
            try:
                return float(actual) > float(expected)
            except (TypeError, ValueError):
                return False
        if operator == "lt":
            try:
                return float(actual) < float(expected)
            except (TypeError, ValueError):
                return False
        if operator == "exists":
            return (actual is not None) == bool(expected)

        logger.warning("Unknown operator: %s", operator)
        return False
