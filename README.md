# Kapray

A mobile **aggregator** of Pakistani women's fashion brands (Nishat Linen, Limelight, Khaadi at launch). Kapray syncs brand catalogs, surfaces campaigns/sales/drops in one feed, and sends push alerts. Checkout happens on the **brand's own site inside an in-app WebView** — Kapray is not a retailer.

> Full product spec: [`docs/kapray-claude-code-spec.md`](docs/kapray-claude-code-spec.md) — the single source of truth.

## Monorepo layout

```
kapray/
├── CLAUDE.md          # working conventions for this repo
├── apps/mobile/       # Expo app (React Native + TypeScript)   [Phase 2+]
├── scraper/           # existing Python scraper (do not rewrite)
├── ingest/            # drops → Supabase: validate, upsert, diff, events
├── supabase/          # migrations (schema source of truth), functions, seed
└── docs/              # spec + reference material
```

## Stack

| Layer | Choice |
|---|---|
| Mobile | React Native + Expo (managed, TypeScript), Expo Router |
| Backend | Supabase (Postgres, Auth, Edge Functions, Storage, Realtime) |
| Ingestion | Python scraper → JSON drops → `ingest.py` → Supabase |
| Push | Expo Push Notifications |
| Checkout | In-app WebView of the brand's site (UTM-tagged) |

Postgres schema is kept **vanilla** — a self-hosted Node + Postgres migration is planned, so we avoid Supabase-only lock-in in the data layer.

## Build status

Work proceeds in phases (see spec §10). Current:

- [x] **Phase 0** — monorepo scaffold, schema migrations, RLS, seed (18 real products from the prototype)
- [x] **Phase 1** — ingest pipeline (validate → upsert → diff → events → campaign detect); 21 tests passing
- [x] **Phase 2** — app core (browse: Home / PDP / Brand / Sales / Saved) — pending live-device verification against a hosted Supabase project
- [ ] **Phase 3** — identity & engagement (auth, follows, wishlist sync, alerts)
- [ ] **Phase 4** — WebView analytics + push notifications
- [ ] **Phase 5** — hardening & release

**Blocked on:** hosted Supabase project URL + keys in `.env` (then: `supabase link`,
`db push`, seed, type generation, and a device run of the app).

## Getting started

Each package has its own README:

- Scraper — [`scraper/README.md`](scraper/README.md)
- Ingest — [`ingest/README.md`](ingest/README.md)
- Supabase — [`supabase/README.md`](supabase/README.md)

Copy [`.env.example`](.env.example) to `.env` and fill in your Supabase project values before running the ingest or the app.
