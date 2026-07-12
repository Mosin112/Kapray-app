# CLAUDE.md — Kapray working guide

Conventions and guardrails for working in this repo. The authoritative product
spec is [`docs/kapray-claude-code-spec.md`](docs/kapray-claude-code-spec.md);
read it before non-trivial work. This file is the short version + the rules that
are easy to get wrong.

## What Kapray is (one paragraph)

A mobile **aggregator** (not a retailer) of Pakistani women's fashion brands.
We sync brand catalogs, surface drops/sales in one feed, push-alert followers,
and hand checkout to the **brand's own site in a WebView** with UTM tracking.
Brands own inventory, payment, fulfillment, returns. Android-first.

## Architecture

```
scraper (Python, DONE) ──writes──▶ scraper/drops/{brand}/latest.json
                                          │
                                          ▼
ingest (Python) ──validate → upsert → diff → product_events → campaign detect──▶ Supabase (Postgres)
                                          │
                                          ▼
apps/mobile (Expo) ──TanStack Query / PostgREST──▶ reads catalog; WebView checkout; Expo push
```

## Hard rules (do not relitigate — see spec §11)

1. **No cart, no payments, no order tracking.** Checkout is a WebView of the brand site.
2. **Do not rewrite the scraper.** It is built and tested (`scraper/`). Small bug
   fixes only; coordinate feature changes with the owner. Build `ingest/` around
   its output contract, don't change the contract.
3. **Keep Postgres vanilla.** A Node + self-hosted Postgres migration is planned.
   Allowed Supabase features: Auth, PostgREST, Edge Functions, Storage, pg_cron.
   No exotic Supabase-only features; business logic lives in SQL migrations +
   Edge Functions that port cleanly.
4. **Khaadi prices are USD** (US storefront). Store `currency='USD'`, render
   "USD 35" honestly. **No fake FX conversion.**
5. **Notification discipline is a feature.** Hard per-user daily cap
   (`notif_prefs.max_per_day`, default 3) + per-brand mute from day one.
6. **Image CDN params:** append `?width=540` (feed) / `?width=1080` (PDP) to
   Shopify CDN image URLs — PK bandwidth matters.
7. **Legal posture:** we link out and attribute; never present as the seller.
   Every PDP CTA shows "Checkout, delivery & returns handled by {Brand}".
8. Blocked brands (Sapphire/Kayseria/Gul Ahmed) ship as
   `sync_status='blocked'|'onboarding'` → "Joining soon" UI. Adding one must be
   config + one adapter file, no core changes.

## Conventions

- **Currency formatting:** `Rs 8,000` (en-PK grouping) for PKR, `USD 35` for USD.
- **Time zone:** all user-facing times in `Asia/Karachi`.
- **Schema is source of truth in `supabase/migrations/`** (ordered SQL files).
  TypeScript types are generated from the DB, never hand-edited.
- **Analytics:** every impression + clickout logged to `events_analytics` with
  UTM/affiliate props. Fire via a batched `track(name, props)` helper.
- **Deep links:** `kapray://product/{id}`, `kapray://brand/{slug}`,
  `kapray://campaign/{id}`.
- **Env/secrets:** never commit keys. `.env.example` documents required vars;
  real values go in `.env` (gitignored). The Supabase **service-role** key is
  used only by `ingest/` and Edge Functions — never shipped in the app.

## Scraper output contract (what ingest can rely on)

- `scraper/drops/{brand_slug}/latest.json` is the stable pointer to the newest
  snapshot; timestamped files are never overwritten.
- If a brand's catalog is unchanged, **no new file is written** — a new
  timestamped file is itself a "something changed" signal.
- One canonical schema for all brands (Shopify + Khaadi SFCC). See
  `ingest/schemas/product_feed.schema.json`.

## Environment notes (this machine, as of setup)

- Node 22, npm/pnpm/yarn present. Supabase CLI v2.101.0 present.
- **Docker not installed** → using a **hosted** Supabase project (not local
  `supabase start`). Connection values come from `.env`.
- **Python is 3.9** system-wide, but the scraper needs **3.10+** to run.
  `ingest/` is written to run on 3.9 (stdlib + jsonschema). Install 3.10+ before
  running the scraper live.

## Phase order (spec §10)

0 Foundations · 1 Ingest · 2 App browse · 3 Identity/engagement ·
4 WebView + notifications · 5 Hardening/release. Each phase meets its acceptance
checks before the next.
