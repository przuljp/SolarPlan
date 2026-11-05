"""Resolve numerical references from trusted facts, never from model arithmetic."""

import calendar
import re
from typing import Any

from pydantic import ValidationError

from app.core.exceptions import AiInvalidResponseError
from app.schemas.ai_explanation import ExplanationContent

REFERENCE = re.compile(r"\{\{([a-z_]+(?:\.[a-z_0-9]+)*)\}\}")


def evidence_values(facts: dict[str, Any]) -> dict[str, str]:
    values: dict[str, str] = {}

    def visit(value, path):
        if isinstance(value, dict):
            for key, child in value.items():
                visit(child, f"{path}.{key}" if path else key)
        elif isinstance(value, list):
            for index, child in enumerate(value):
                visit(child, f"{path}.{index}")
        elif isinstance(value, (int, float)) and not isinstance(value, bool):
            field = path.rsplit(".", 1)[-1]
            if field == "month":
                values[path] = calendar.month_name[int(value)]
            elif "kwp" in field and "per_kwp" not in field:
                values[path] = f"{value:,.2f} kWp"
            elif "per_kwp" in field:
                values[path] = f"{value:,.2f} kWh/kWp"
            elif "kwh" in field:
                values[path] = f"{value:,.2f} kWh"
            elif "percent" in field:
                unit = "percentage points" if path.startswith("comparison.deltas.") else "%"
                values[path] = f"{value:g}{' ' if unit != '%' else ''}{unit}"
            elif field.endswith("_deg"):
                values[path] = f"{value:g} degrees"
            else:
                values[path] = f"{value:g}"

    visit(facts, "")
    return values


def resolve_evidence(content: ExplanationContent, values: dict[str, str]) -> ExplanationContent:
    data = content.model_dump()
    requirements = {
        "summary": {"simulation.annual_kwh", "simulation.installed_kwp"},
    }
    for field, value in data.items():
        texts = value if isinstance(value, list) else [value]
        refs = set()
        for text in texts:
            if text is None:
                continue
            refs.update(REFERENCE.findall(text))
            remainder = REFERENCE.sub("", text)
            if re.search(r"\d|[{}]", remainder):
                raise AiInvalidResponseError
        if not refs.issubset(values) or not requirements.get(field, set()).issubset(refs):
            raise AiInvalidResponseError
        prefix = {
            "production_insights": "simulation.",
            "seasonal_insights": "simulation.monthly_results.",
            "consumption_insights": "consumption.",
            "comparison_insights": "comparison.deltas.",
        }.get(field)
        if value is not None and prefix and not any(ref.startswith(prefix) for ref in refs):
            raise AiInvalidResponseError

        def resolve(text):
            return None if text is None else REFERENCE.sub(lambda match: values[match[1]], text)

        data[field] = (
            [resolve(text) for text in value] if isinstance(value, list) else resolve(value)
        )
    try:
        return ExplanationContent.model_validate(data)
    except ValidationError:
        raise AiInvalidResponseError from None
