"""JSON Schema validation for scraper drop files (spec §5.1).

Invalid files are quarantined by the pipeline; this module just decides
valid/invalid and returns a readable error.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

try:
    import jsonschema
except ImportError as e:  # pragma: no cover - surfaced at runtime with a hint
    raise ImportError(
        "ingest requires 'jsonschema'. Install it: pip install -r ingest/requirements.txt"
    ) from e

_SCHEMA_PATH = Path(__file__).resolve().parent.parent / "schemas" / "product_feed.schema.json"


def load_schema() -> dict:
    return json.loads(_SCHEMA_PATH.read_text())


class FeedValidationError(ValueError):
    """Raised when a drop file does not conform to the canonical schema."""


def validate_feed(feed: dict[str, Any], schema: dict | None = None) -> None:
    """Raise FeedValidationError with a concise message if `feed` is invalid."""
    schema = schema or load_schema()
    validator = jsonschema.Draft202012Validator(schema)
    errors = sorted(validator.iter_errors(feed), key=lambda e: list(e.path))
    if errors:
        first = errors[0]
        loc = "/".join(str(p) for p in first.path) or "<root>"
        raise FeedValidationError(
            f"{len(errors)} schema error(s); first at '{loc}': {first.message}"
        )


def load_and_validate(path: Path, schema: dict | None = None) -> dict:
    """Read a drop file, validate it, return the parsed feed."""
    try:
        feed = json.loads(Path(path).read_text())
    except json.JSONDecodeError as e:
        raise FeedValidationError(f"invalid JSON: {e}") from e
    validate_feed(feed, schema)
    return feed
