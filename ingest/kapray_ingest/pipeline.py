"""Ingest orchestration: one drop file → validated, upserted, diffed, evented.

Order matters: we snapshot stored state and diff BEFORE writing upserts, so
price/stock comparisons see the previous values. Idempotency comes from two
layers — the ingest_runs file guard (skip already-processed files) and the diff
itself (unchanged data compares equal → zero events).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from . import diff as diffmod
from .store import Store
from .validate import FeedValidationError, load_and_validate, load_schema


@dataclass
class IngestResult:
    brand_slug: str
    drop_file: str
    status: str                       # 'ok' | 'skipped' | 'failed'
    products_seen: int = 0
    events_written: int = 0
    campaigns_suggested: int = 0
    error: Optional[str] = None
    event_types: dict = field(default_factory=dict)  # {type: count} — handy for tests/logs


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def ingest_feed(store: Store, feed: dict, drop_file: str) -> IngestResult:
    """Apply a single already-parsed feed through the store. Pure of I/O except
    via the Store seam, so tests drive it directly with an InMemoryStore."""
    slug = feed["brand_slug"]

    if store.was_file_ingested(slug, drop_file):
        return IngestResult(slug, drop_file, "skipped")

    brand_id = store.upsert_brand(slug, feed.get("currency", "PKR"))
    incoming = feed.get("products", [])

    # 1. Snapshot + diff BEFORE writes.
    stored = store.get_products(brand_id)
    run = diffmod.diff_feed(stored, incoming)

    # 2. Upsert products/images/variants; build ext→id maps for event resolution.
    #    Batched by the store (one bulk request per table for the whole feed).
    pid_by_ext, vid_by = store.upsert_catalog(brand_id, incoming)

    # 3. Missing / removed handling (spec §5.3): bump absent products; deactivate
    #    + emit `removed` once they've missed MISSING_THRESHOLD consecutive feeds.
    removed_events: list[diffmod.Event] = []
    for ext in run.removed_product_ids:
        sp = stored[ext]
        new_missing = sp.get("missing_count", 0) + 1
        deactivate = new_missing >= diffmod.MISSING_THRESHOLD
        store.set_missing(sp["id"], new_missing, is_active=not deactivate)
        if deactivate:
            removed_events.append(diffmod.Event(
                ext, diffmod.REMOVED, old_value={"is_active": True},
                new_value={"is_active": False},
            ))
            pid_by_ext[ext] = sp["id"]  # resolve against stored id

    # 4. Resolve every event's external ids → uuids, then persist.
    resolved: list[dict] = []
    for ev in list(run.events) + removed_events:
        pid = pid_by_ext.get(ev.product_external_id)
        if pid is None:
            continue
        vid = None
        if ev.variant_external_id is not None:
            vid = vid_by.get((pid, ev.variant_external_id))
        resolved.append({
            "product_id": pid, "variant_id": vid, "type": ev.type,
            "old_value": ev.old_value, "new_value": ev.new_value,
        })
    events_written = store.insert_events(resolved)

    # 5. Campaign auto-detection (spec §5.5).
    suggestions = diffmod.detect_campaigns(run)
    starts_at = feed.get("scraped_at") or _iso_now()
    for s in suggestions:
        store.insert_campaign(
            brand_id, kind=s.kind,
            title=f"[auto] Possible {s.kind} — {slug}",
            subtitle=s.reason, starts_at=starts_at,
        )

    # 6. Bookkeeping.
    event_types: dict = {}
    for r in resolved:
        event_types[r["type"]] = event_types.get(r["type"], 0) + 1
    store.record_ingest_run(
        brand_slug=slug, drop_file=drop_file, scraped_at=feed.get("scraped_at"),
        status="ok", products_seen=len(incoming), events_written=events_written,
        error=None, started_at=_iso_now(), finished_at=_iso_now(),
    )
    return IngestResult(
        slug, drop_file, "ok", products_seen=len(incoming),
        events_written=events_written, campaigns_suggested=len(suggestions),
        event_types=event_types,
    )


def ingest_path(store: Store, path: Path, drop_file: Optional[str] = None,
                schema: Optional[dict] = None,
                failed_dir: Optional[Path] = None) -> IngestResult:
    """Read + validate a drop file on disk, then ingest it. Quarantines invalid
    files to `failed_dir` (spec §5.1) and records a failed run."""
    path = Path(path)
    drop_file = drop_file or f"{path.parent.name}/{path.name}"
    schema = schema or load_schema()
    try:
        feed = load_and_validate(path, schema)
    except FeedValidationError as e:
        if failed_dir:
            failed_dir.mkdir(parents=True, exist_ok=True)
            (failed_dir / path.name).write_text(path.read_text())
            (failed_dir / f"{path.name}.error.txt").write_text(str(e))
        return IngestResult("?", drop_file, "failed", error=str(e))
    return ingest_feed(store, feed, drop_file)
