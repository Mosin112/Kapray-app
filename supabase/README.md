# Supabase

Schema, RLS, and seed for Kapray. **Migrations in `migrations/` are the source of
truth** for the database (spec §4, §11.4 — kept vanilla Postgres for a later
self-hosted Node + Postgres migration).

## Migrations

| File | Contents |
|---|---|
| `20260712090000_catalog.sql`     | brands, products, product_images, variants, product_events, campaigns |
| `20260712090100_engagement.sql`  | profiles, follows, wishlist_items, notifications, events_analytics + new-user trigger |
| `20260712090200_ingest_runs.sql` | ingest bookkeeping (idempotency) |
| `20260712090300_rls.sql`         | Row-Level Security policies + grants |

## Apply to a hosted project

Docker isn't installed on this machine, so we use a **hosted** Supabase project
rather than `supabase start`. From the repo root:

```bash
# One-time: link the CLI to your project (grab the ref from the dashboard URL).
supabase link --project-ref YOUR_PROJECT_REF

# Push all migrations, then load seed data (brands).
supabase db push
psql "$SUPABASE_DB_URL" -f supabase/seed.sql     # or run seed.sql in the SQL editor
```

To generate TypeScript types for the app once the schema is live:

```bash
supabase gen types typescript --linked > apps/mobile/src/types/database.ts
```

## RLS model (spec §4)

- **Catalog** (`brands`, `products`, `product_images`, `variants`, `campaigns`) — public read; writes only via the service-role key (ingest / Edge Functions).
- **User-owned** (`profiles`, `follows`, `wishlist_items`, `notifications`) — `user_id = auth.uid()`.
- **`events_analytics`** — insert-only for anon + authenticated; no client read.
- **`product_events`, `ingest_runs`** — service-role only.

## Edge Functions (Phase 4)

`functions/` will hold `fanout-notifications` and the campaign status
transitions (pg_cron). Not built yet.

## Status

Migrations + seed are **written but not yet applied** — pending the hosted
project URL/keys in `.env`. Once linked, `supabase db push` should run clean
(spec §10 Phase 0 acceptance).
