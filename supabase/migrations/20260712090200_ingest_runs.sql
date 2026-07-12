-- ─────────────────────────────────────────────────────────────────────────────
-- Kapray schema · 03 · Ingest bookkeeping. Not in spec §4's DDL block, but
-- required by spec §5.1 ("process new timestamped files since last ingest,
-- tracked in an ingest_runs table") and §5.6 (idempotency). One row per
-- drop file processed; the (brand_slug, drop_file) unique key makes re-ingesting
-- the same file a no-op at the bookkeeping layer.
-- ─────────────────────────────────────────────────────────────────────────────

create table ingest_runs (
  id             bigint generated always as identity primary key,
  brand_slug     text not null,
  drop_file      text not null,        -- e.g. 'nishat/20260712-185003.json'
  scraped_at     timestamptz,          -- from the drop's header
  status         text not null,        -- 'ok' | 'failed' | 'skipped'
  products_seen  int default 0,
  events_written int default 0,
  error          text,
  started_at     timestamptz default now(),
  finished_at    timestamptz,
  unique (brand_slug, drop_file)
);
create index on ingest_runs (brand_slug, started_at desc);
