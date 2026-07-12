#!/usr/bin/env python3
"""Kapray ingest CLI — drops/ → Supabase.

Runs after the scraper. Reads each brand's `latest.json` (or every new
timestamped drop with --all-files), validates, upserts, diffs, and emits
product_events + campaign suggestions.

Usage:
  python3 ingest.py run                         # all brands' latest.json → Supabase
  python3 ingest.py run --brand nishat,limelight
  python3 ingest.py run --all-files             # every timestamped drop, oldest→newest
  python3 ingest.py run --dry-run               # in-memory, prints a summary, writes nothing
  python3 ingest.py run --drops-dir path/to/drops

Env (see .env.example): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, KAPRAY_DROPS_DIR.
Requires Python 3.9+ and `pip install -r requirements.txt`.
"""
from __future__ import annotations

import argparse
import logging
import os
import sys
from pathlib import Path

from kapray_ingest.pipeline import ingest_path
from kapray_ingest.store import InMemoryStore, Store, SupabaseRestStore
from kapray_ingest.validate import load_schema

log = logging.getLogger("kapray.ingest")
REPO_ROOT = Path(__file__).resolve().parent.parent


def load_dotenv(path: Path) -> None:
    """Tiny .env loader (no dependency). Does not overwrite existing env vars."""
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        os.environ.setdefault(k.strip(), v.strip())


def discover_files(drops_dir: Path, brands: list | None, all_files: bool) -> list:
    """Return [(path, drop_file_key)] to ingest, oldest first."""
    jobs = []
    for brand_dir in sorted(p for p in drops_dir.iterdir() if p.is_dir()):
        if brand_dir.name.startswith("_"):
            continue  # skip _failed/
        if brands and brand_dir.name not in brands:
            continue
        if all_files:
            files = sorted(f for f in brand_dir.glob("*.json") if f.name != "latest.json")
        else:
            latest = brand_dir / "latest.json"
            files = [latest] if latest.exists() else []
        for f in files:
            jobs.append((f, f"{brand_dir.name}/{f.name}"))
    return jobs


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("run", help="ingest drop files")
    p.add_argument("--brand", help="comma-separated slugs (default: all)")
    p.add_argument("--drops-dir", help="override drops directory")
    p.add_argument("--all-files", action="store_true",
                   help="ingest every timestamped drop, not just latest.json")
    p.add_argument("--dry-run", action="store_true",
                   help="use an in-memory store; write nothing to Supabase")
    args = ap.parse_args()

    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s %(levelname)s %(message)s", datefmt="%H:%M:%S")
    load_dotenv(REPO_ROOT / ".env")

    drops_dir = Path(args.drops_dir or os.environ.get("KAPRAY_DROPS_DIR", "scraper/drops"))
    if not drops_dir.is_absolute():
        drops_dir = REPO_ROOT / drops_dir
    if not drops_dir.is_dir():
        log.error("drops dir not found: %s", drops_dir)
        return 2

    brands = args.brand.split(",") if args.brand else None
    failed_dir = drops_dir / "_failed"
    schema = load_schema()

    store: Store
    if args.dry_run:
        log.info("DRY RUN — in-memory store, nothing persisted.")
        store = InMemoryStore()
    else:
        try:
            store = SupabaseRestStore()
        except KeyError as e:
            log.error("missing env var %s — copy .env.example to .env and fill it in.", e)
            return 2

    jobs = discover_files(drops_dir, brands, args.all_files)
    if not jobs:
        log.warning("no drop files found under %s", drops_dir)
        return 0

    failures = 0
    for path, key in jobs:
        res = ingest_path(store, path, drop_file=key, schema=schema, failed_dir=failed_dir)
        if res.status == "ok":
            summary = ", ".join(f"{k}:{v}" for k, v in sorted(res.event_types.items())) or "no changes"
            log.info("✓ %s — %d products, %d events (%s)%s", key, res.products_seen,
                     res.events_written, summary,
                     f", {res.campaigns_suggested} campaign(s) suggested" if res.campaigns_suggested else "")
        elif res.status == "skipped":
            log.info("= %s — already ingested, skipped", key)
        else:
            failures += 1
            log.error("✗ %s — %s", key, res.error)

    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
