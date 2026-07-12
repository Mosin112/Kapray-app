# Kapray Ingest

Consumes the scraper's canonical JSON drops and lands them in Supabase:
**validate → upsert → diff → `product_events` → campaign auto-detect**, idempotently.

```
drops/{brand}/latest.json ──▶ ingest.py ──▶ Supabase (brands, products, variants,
                                             product_images, product_events, campaigns)
```

## How it works

1. **Validate** each drop against [`schemas/product_feed.schema.json`](schemas/product_feed.schema.json) (matches the scraper output, spec §5). Invalid files are quarantined to `drops/_failed/` with an error log.
2. **Upsert** brand → products → images → variants (match on `brand_id + external_id`).
3. **Diff** incoming vs stored variant `price`/`available`:
   - price down → `price_drop`, up → `price_rise`
   - `false→true` → `restock`, `true→false` → `out_of_stock`
   - unseen product → `new_product`
   - absent from 3 consecutive feeds → `removed` + `is_active=false`
4. **Campaign auto-detect** (spec §5.5): ≥20 new products in a run → suggest a `drop`; ≥30% of variants gaining a `compare_at_price` → suggest a `sale`. Both created `status='scheduled', source='auto_detected'` for manual review.
5. **Idempotent**: the `ingest_runs` guard skips already-processed files, and an unchanged feed diffs to zero events.

## Design

The diff engine and heuristics ([`kapray_ingest/diff.py`](kapray_ingest/diff.py)) are **pure** — no DB, no network — so they're unit-tested directly. Persistence sits behind a `Store` seam ([`kapray_ingest/store.py`](kapray_ingest/store.py)) with two implementations:

- `InMemoryStore` — deterministic, used by the tests.
- `SupabaseRestStore` — talks to a hosted project via PostgREST + the service-role key.

This keeps the data layer portable for the planned Node + Postgres migration (spec §11.4).

## Run

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Configure Supabase (repo-root .env; see ../.env.example)
#   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

python3 ingest.py run                 # all brands' latest.json → Supabase
python3 ingest.py run --brand nishat  # one brand
python3 ingest.py run --all-files     # every timestamped drop, oldest→newest
python3 ingest.py run --dry-run       # in-memory; prints a summary, writes nothing
```

`--dry-run` needs no database or keys — good for eyeballing what a set of drops would produce.

## Test

```bash
pip install -r requirements-dev.txt
pytest            # from the ingest/ directory
```

Fixtures in `tests/fixtures/` are real scraper drops. Regenerate fresh ones with
`cd ../scraper && python3 scraper.py run --limit 20` (needs Python 3.10+).

## Requirements

- Python 3.9+ (`jsonschema`, `requests`). The **scraper** needs 3.10+, but ingest does not.
