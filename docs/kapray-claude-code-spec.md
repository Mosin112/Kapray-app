# KAPRAY — MVP Build Specification for Claude Code

**Version 1.0 · July 2026 · Owner: Mohsin Hafeez**
**Read this entire document before writing any code. It is the single source of truth for the MVP.**

---

## 1. What Kapray is

Kapray is a mobile **aggregator** of Pakistani women's fashion brands (Nishat Linen, Limelight, Khaadi at launch; Sapphire, Kayseria, Gul Ahmed later). It is **not a retailer**: we sync brand catalogs, surface campaigns/sales/drops in one feed, and send push alerts. When a user buys, we open the **brand's own mobile site in an in-app WebView** where they complete checkout. Brands own inventory, payment, fulfillment, and returns.

**The core loop:** follow brands → get push alert when a brand drops a collection or starts a sale → browse in Kapray → tap Buy → complete purchase on brand's site inside the app.

**Revenue instrumentation (build now, monetize later):** log every impression and clickout with UTM/affiliate params so we can prove traffic value to brands.

### Non-goals for MVP (do not build)
No in-app checkout or cart. No payments. No order tracking. No reviews/UGC. No brand self-serve portal. No iOS-specific work beyond what Expo gives for free (Android is the launch target). No admin web UI beyond what Supabase Studio provides.

---

## 2. Confirmed stack decisions

| Layer | Choice | Notes |
|---|---|---|
| Mobile app | **React Native + Expo (managed workflow, TypeScript)** | Expo Router, Expo Notifications, expo-web-browser / react-native-webview |
| Backend | **Supabase** (Postgres, Auth, Edge Functions, Storage, Realtime) | Schema must be vanilla Postgres — we migrate to self-hosted Node.js + Postgres post-MVP, so avoid Supabase-only lock-in in the data layer; keep business logic in SQL + Edge Functions that are portable |
| Ingestion | **Existing Python scraper (already built by owner)** that outputs **JSON/CSV files** | We add a thin Python "ingest" step that validates + upserts those files into Supabase via the service-role API |
| Push | Expo Push Notifications | Fan-out from an Edge Function |
| Analytics | Postgres tables first (events land in DB); PostHog optional later | Keep the event schema portable |
| Checkout | **In-app WebView** of brand's mobile site with UTM params appended | See §8 |

---

## 3. Repository layout (monorepo)

```
kapray/
├── CLAUDE.md                  # summary of this spec + conventions for Claude Code
├── apps/
│   └── mobile/                # Expo app (TypeScript)
│       ├── app/               # Expo Router routes
│       ├── src/
│       │   ├── components/
│       │   ├── features/      # feed, brand, pdp, wishlist, alerts, search, webview
│       │   ├── lib/           # supabase client, analytics, push
│       │   ├── theme/         # design tokens (§9)
│       │   └── types/         # generated from DB schema
│       └── app.json
├── scraper/                   # EXISTS — copy from ~/Scrapper (scraper.py, brands.json, README.md)
│   ├── scraper.py             # CLI: run / loop / status; stdlib only; do not rewrite
│   ├── brands.json            # brand configs (add Shopify brands here, no code)
│   └── drops/                 # canonical JSON output, {brand}/{timestamp}.json + latest.json (gitignored)
├── ingest/                    # Python: drops → Supabase (BUILD THIS)
│   ├── schemas/product_feed.schema.json   # JSON Schema matching the scraper's output (§5)
│   └── ingest.py              # validate → upsert → emit diff events
├── supabase/
│   ├── migrations/            # SQL migrations (source of truth for schema)
│   ├── functions/             # Edge Functions: fanout-notifications, campaign-detector
│   └── seed.sql               # seed brands + sample products (use real data below)
└── docs/
    └── this file
```

---

## 4. Data model (Postgres DDL — implement as Supabase migrations)

Design rule: **campaigns are first-class**, products belong to brands, all price/stock changes are event-sourced so notifications and "price history" are derivable.

```sql
create table brands (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,          -- 'nishat', 'limelight', 'khaadi'
  name          text not null,
  domain        text not null,                 -- 'nishatlinen.com'
  base_url      text not null,                 -- 'https://nishatlinen.com'
  logo_url      text,
  platform      text not null,                 -- 'shopify' | 'sfcc' | 'magento' | 'custom'
  currency      text not null default 'PKR',   -- Khaadi US feed is 'USD' (§11 caveats)
  sync_status   text not null default 'live',  -- 'live' | 'onboarding' | 'blocked'
  created_at    timestamptz default now()
);

create table products (
  id            uuid primary key default gen_random_uuid(),
  brand_id      uuid not null references brands(id),
  external_id   text not null,                 -- brand's product id/handle
  title         text not null,
  description   text,
  product_url   text not null,                 -- canonical brand PDP url
  category      text,                          -- 'unstitched' | 'pret' | 'kurta' | ...
  fabric        text,
  tags          text[] default '{}',
  first_seen_at timestamptz default now(),
  last_seen_at  timestamptz default now(),
  is_active     boolean default true,          -- false when absent from feed N times
  unique (brand_id, external_id)
);

create table product_images (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references products(id) on delete cascade,
  src         text not null,
  position    int not null default 1
);

create table variants (
  id                uuid primary key default gen_random_uuid(),
  product_id        uuid not null references products(id) on delete cascade,
  external_id       text not null,
  title             text,                      -- 'M', 'Default'
  price             numeric(12,2) not null,
  compare_at_price  numeric(12,2),             -- null = not on sale
  available         boolean not null default true,
  unique (product_id, external_id)
);

-- Event-sourced changes; the ingest diff engine writes these, triggers read them.
create table product_events (
  id          bigint generated always as identity primary key,
  product_id  uuid not null references products(id),
  variant_id  uuid references variants(id),
  type        text not null,   -- 'new_product' | 'price_drop' | 'price_rise' | 'restock' | 'out_of_stock' | 'removed'
  old_value   jsonb,
  new_value   jsonb,
  created_at  timestamptz default now()
);
create index on product_events (type, created_at desc);

create table campaigns (
  id          uuid primary key default gen_random_uuid(),
  brand_id    uuid not null references brands(id),
  title       text not null,                   -- 'Mid-Summer Sale'
  subtitle    text,                            -- 'Flat 50% off'
  hero_image  text,
  kind        text not null,                   -- 'sale' | 'drop' | 'clearance'
  starts_at   timestamptz not null,
  ends_at     timestamptz,
  status      text not null default 'scheduled', -- 'scheduled'|'live'|'ended'
  source      text not null default 'manual'   -- 'manual' | 'auto_detected'
);

-- Users & engagement (Supabase auth.users is the identity source)
create table profiles (
  id          uuid primary key references auth.users(id),
  phone       text,
  expo_push_token text,
  notif_prefs jsonb default '{"drops":true,"price_drops":true,"restocks":true,"max_per_day":3}',
  created_at  timestamptz default now()
);

create table follows (
  user_id   uuid references profiles(id) on delete cascade,
  brand_id  uuid references brands(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, brand_id)
);

create table wishlist_items (
  user_id    uuid references profiles(id) on delete cascade,
  product_id uuid references products(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, product_id)
);

create table notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id),
  type       text not null,       -- 'campaign_live'|'price_drop'|'restock'|'drop_reminder'
  title      text not null,
  body       text,
  deeplink   text,                -- kapray://product/{id} etc.
  sent_at    timestamptz,
  read_at    timestamptz,
  created_at timestamptz default now()
);

-- Analytics (the future brand-facing product; keep portable)
create table events_analytics (
  id         bigint generated always as identity primary key,
  user_id    uuid,
  session_id text,
  name       text not null,       -- 'impression'|'pdp_view'|'clickout'|'webview_opened'|'search'|'filter_applied'|'wishlist_add'|'push_open'
  props      jsonb default '{}',  -- {product_id, brand_id, campaign_id, price, position, query...}
  created_at timestamptz default now()
);
create index on events_analytics (name, created_at desc);
```

**RLS:** enable on all user-owned tables (`profiles`, `follows`, `wishlist_items`, `notifications`) with `user_id = auth.uid()` policies. Catalog tables (`brands`, `products`, `variants`, `product_images`, `campaigns`) are public-read, service-role-write. `events_analytics` is insert-only for authenticated + anon (rate-limit in Edge Function if abused).

---

## 5. Scraper contract (the scraper is BUILT and TESTED — do not rewrite it)

The scraper lives in `scraper/` (source: owner's `~/Scrapper` folder). It is a zero-dependency Python 3.10+ CLI, verified live against Nishat and Limelight in July 2026. **Claude Code must build `ingest/` around its output, not modify the scraper** (small bug fixes allowed; coordinate feature changes with the owner).

**Scraper behavior Claude Code can rely on:**
- `python3 scraper.py run [--brand slugs] [--force] [--limit N]` — scrapes enabled brands from `brands.json`; `loop --interval 30` for unattended re-runs; `status` shows last run per brand.
- Writes `drops/{brand_slug}/{YYYYMMDD-HHMMSS}.json` (never overwrites) **and** `drops/{brand_slug}/latest.json` (stable pointer — ingest should read this).
- Content-hash change detection: if a brand's catalog is unchanged, **no new drop file is written** — so a new timestamped file's existence is itself a "something changed" signal. State in `state/state.json`.
- Politeness built in: 1 req/2s, retries with backoff, honest User-Agent; per-brand failures never abort the run.

Every drop file conforms to this canonical schema (define `ingest/schemas/product_feed.schema.json` to match):

```json
{
  "brand_slug": "nishat",
  "scraped_at": "2026-07-12T09:00:00+05:00",
  "currency": "PKR",
  "products": [
    {
      "external_id": "42519114",
      "title": "3 Piece - Embroidered Suit - 42519114",
      "product_url": "https://nishatlinen.com/products/42519114",
      "category": "unstitched",
      "fabric": "Cambric",
      "tags": ["Mid-Summer-sale-2026", "3pc"],
      "images": ["https://cdn.shopify.com/s/files/1/0534/2065/4791/files/42519114-_1.jpg"],
      "variants": [
        {"external_id": "44840658010311", "title": "Default", "price": 8000.00,
         "compare_at_price": 16000.00, "available": true}
      ]
    }
  ]
}
```

No per-brand adapters are needed in ingest — the scraper already normalizes all brands (Shopify + Khaadi SFCC) into this one schema. Real sample files exist in `scraper/drops/` — use them as test fixtures.

**`ingest.py` pipeline (runs on cron or manually, after the scraper):**
1. Read `scraper/drops/{brand_slug}/latest.json` (or process new timestamped files since last ingest, tracked in an `ingest_runs` table); validate against JSON Schema; quarantine invalid files to `drops/_failed/` with an error log.
2. Upsert brands → products → images → variants (match on `brand_id + external_id`).
3. **Diff engine:** compare incoming vs stored variant `price` and `available`; insert `product_events` rows (`price_drop` when new < old, `restock` when false→true, `new_product` when product unseen). Mark products missing from 3 consecutive feeds `is_active = false` + `removed` event.
4. Touch `last_seen_at` on every product present.
5. **Campaign auto-detection heuristic:** if ≥20 `new_product` events for one brand within one run → create a `campaigns` row (`kind='drop'`, `source='auto_detected'`, `status='scheduled'`) for manual review. If ≥30% of a brand's active variants gain `compare_at_price` in one run → suggest `kind='sale'`.
6. Idempotent: re-running the same file produces zero new events.

**Real-world facts to encode (validated by live probing, July 2026):**
- Nishat Linen (`nishatlinen.com`) and Limelight (`limelight.pk`) are Shopify — `/products.json` works. Images on `cdn.shopify.com`.
- Khaadi is Salesforce Commerce Cloud; only the **US** storefront (`us.khaadi.com`) is scrapeable server-side, prices in **USD**. Store `currency='USD'` and render "USD 35" in the app — do not fake-convert.
- Sapphire (`sapphireonline.pk`) blocks all automated access (site, `products.json`, sitemap). Seed it with `sync_status='blocked'` and show as "Joining soon" in the app.
- Scrape cadence: run `scraper.py loop --interval 30` (or cron every 30 min); tighten to every 10 min during 9am–1pm PKT (drop windows). Etiquette (rate limit, backoff, UA) is already implemented in the scraper.

---

## 6. Notification pipeline

1. Postgres trigger (or the ingest step directly) calls Edge Function `fanout-notifications` with new `product_events` / campaign status changes.
2. Fanout rules:
   - `campaign_live` → all users following that brand (respect `notif_prefs.drops`).
   - `price_drop` / `restock` → only users with that product wishlisted.
   - Enforce `max_per_day` per user (default 3); drop lowest-priority first (priority: campaign_live > restock > price_drop).
3. Insert a `notifications` row, then send via Expo Push API in batches of 100. Store receipt errors; prune dead tokens.
4. Deep links: `kapray://product/{id}`, `kapray://brand/{slug}`, `kapray://campaign/{id}` — wire through Expo Router linking config.

Campaign `status` transitions (`scheduled→live→ended`) run on a Supabase scheduled function (pg_cron) every 5 min based on `starts_at`/`ends_at`.

---

## 7. Mobile app — screens and behavior

Build with Expo Router. All screens exist in the approved HTML prototype (`kapray-prototype.html`) — **match its visual design** (§9). Screens:

1. **Splash/Onboarding** — KAPRAY wordmark, editorial hero, partner-brand logo strip. First run only: brand picker grid (follow ≥3 suggested), then notification permission prompt framed as "Get alerts when your brands drop." Guest browsing allowed; phone OTP (Supabase Auth) required to follow/wishlist.
2. **Home** — top: campaign banner carousel (live campaigns, countdown for `ends_at`, auto-rotate 4s). Filter chips: **Price** (opens bottom sheet: quick ranges Under 2k / 2–5k / 5–9k / 9k+, "On sale only" toggle, live result count on the Apply button), brand chips, search bar (client-side across title/brand/fabric for MVP). Below: "Shop the look" 2-column masonry feed (FlashList), sorted: followed brands' new items first, then recency. Pin card = image, discount % or NEW badge, wishlist heart, brand logo+name, title, price (+strikethrough compare-at).
3. **PDP** — hero image (swipeable gallery), brand row (logo, domain, Visit store), title, price/compare-at/discount, stock line "● In stock on brand site · synced X min ago" (from `last_seen_at`), "More like this" cross-brand rail, sticky CTA **"Buy on {Brand} ↗"** → WebView (§8). Heart toggles wishlist.
4. **Sales & Drops hub** — featured campaign hero, list of live campaigns (logo, title, discount, ends-at), "Joining soon" section for `sync_status != 'live'` brands.
5. **Brand page** — logo, follower count, live campaign banner, category chips, product grid.
6. **Saved (wishlist)** — grid of hearted products; copy: "We'll alert you on price drops & restocks."
7. **Alerts** — notification inbox from `notifications` table, grouped by day; settings row → per-type toggles + per-brand mute (writes `notif_prefs`).

**State:** TanStack Query against Supabase (PostgREST) with 5-min stale time on catalog reads. Wishlist/follows optimistic updates. Analytics fired via a thin `track(name, props)` that batches inserts to `events_analytics` (flush every 10 events or 30s).

---

## 8. WebView checkout (the decided model)

- Tap "Buy on {Brand}" → push a full-screen `react-native-webview` route loading `product_url` + `?utm_source=kapray&utm_medium=app&utm_campaign={campaign_id|organic}&ref=kapray`.
- Header: brand name + lock icon + domain, close (×) button, share. No URL bar editing.
- Fire `clickout` (on open) and `webview_opened` analytics with product/brand/campaign ids.
- **Conversion heuristic (best-effort, MVP):** listen to `onNavigationStateChange`; if URL matches `/thank_you|/orders/|/checkout/.*/complete|order-confirmation` → fire `purchase_detected` analytics event. Shopify brands (Nishat, Limelight) use `/thank_you`. Do not block or inject scripts into checkout — trust matters and brands may object.
- Handle external payment redirects (JazzCash/bank 3DS pages) inside the same WebView; allow all navigation, block only `tel:`/`mailto:`/`intent:` (hand those to OS).
- On close, if `purchase_detected` fired, show a lightweight "Order placed with {Brand} 🎉 — the brand will handle delivery & updates" toast.

---

## 9. Design system (extract from the approved prototype)

```
colors: bg #FFFFFF · ink #111111 · muted #767676 · chip #F1F1F1 · line #ECECEC
        red (sale/live) #CC2B1D · green (stock/new) #1C7C46
type:   wordmark/logo = Georgia serif, letter-spaced caps ("KAPRAY", 4px tracking)
        UI = system sans (SF/Roboto); prices bold 700-800
shape:  cards 16px radius · chips 18-19px pill · sheets 28px top radius · CTA buttons squared, black, letter-spaced uppercase 11px
layout: 2-col masonry feed, 11px gutter, 16px page margin
brand colors (logo fallbacks): nishat #7A1F3D gold-text · limelight #111 · sapphire #0E6B5C · khaadi #C2452D · kayseria #8A1538 · gulahmed #1C5C34
```
Badges: `SALE LIVE` red pill; `NEW DROP` for drops; discount chip white/red `-50%`; NEW chip white/green.

---

## 10. Build plan — phases with acceptance criteria

Work in this order. Each phase must pass its checks before the next.

**Phase 0 — Foundations (repo, schema, seed)**
Monorepo scaffold, Supabase project + all migrations from §4, RLS policies, seed.sql with 3 brands + the 18 real products already validated (13 Nishat/Limelight PKR + 5 Khaadi USD — take them from the prototype's data block). TypeScript types generated from DB.
✅ `supabase db reset` runs clean; RLS verified with anon vs service key; type-safe client compiles.

**Phase 1 — Ingest pipeline**
`ingest/` package: JSON Schema matching the scraper's canonical output, validation, upsert + diff engine + event emission, campaign auto-detect heuristic, idempotency. The scraper in `scraper/` is done — wire ingest to consume its `drops/` directory.
✅ Unit tests: same-file-twice = 0 events; price change = 1 `price_drop`; restock detected; 25 new products = auto campaign suggestion. Test fixtures = real drop files from `scraper/drops/` (run `python3 scraper.py run --limit 20` to generate fresh ones).

**Phase 2 — App core (browse)**
Expo app: theme, Home feed (banner carousel, chips, price-filter sheet, search, masonry), PDP, Brand page, Sales hub — all read-only against Supabase.
✅ Feed renders 60fps on a mid-range Android (use FlashList); price filter + search + brand chips compose correctly; empty states designed.

**Phase 3 — Identity & engagement**
Phone OTP auth, profiles, onboarding brand picker, follows, wishlist, Saved screen, Alerts inbox, analytics batching.
✅ Guest → sign-in upgrade keeps local wishlist (migrate on auth); RLS blocks cross-user reads (test).

**Phase 4 — WebView checkout + notifications**
WebView flow per §8; Expo push registration; `fanout-notifications` Edge Function + pg_cron campaign transitions; deep links.
✅ E2E: mark a seeded campaign live → followed test user receives push → tap → lands on campaign screen. Clickout events land in `events_analytics`. Purchase-detected heuristic fires on Shopify `/thank_you` (mock).

**Phase 5 — Hardening & release**
Error boundaries, offline cache (last feed snapshot), image CDN params (`?width=540` for Shopify), Sentry, EAS build profile, Play Store assets.
✅ EAS Android build installs and runs the full loop on a physical device.

---

## 11. Constraints, gotchas, decisions already made — do not relitigate

1. **Do not build a cart or payments.** WebView checkout is the model.
2. **Khaadi prices are USD** (US storefront). Display "USD 35" honestly with a small info tooltip ("Sold via Khaadi's international store"). No fake FX conversion.
3. **Sapphire/Kayseria/Gul Ahmed** ship as `sync_status='blocked'/'onboarding'` → "Joining soon" UI. Design the adapter interface so adding them is config + one adapter file.
4. **Supabase → Node/Postgres migration is planned.** Keep SQL vanilla, business logic in migrations/Edge Functions with no exotic Supabase features beyond Auth, PostgREST, Edge Functions, pg_cron. No RLS-bypassing client hacks.
5. **Notification discipline is a product feature:** hard cap per user per day, per-brand mute from day one. An uninstall from spam costs more than a missed alert.
6. **Every image request** to Shopify CDNs must append `?width=540` (feed) / `?width=1080` (PDP) — bandwidth in PK matters.
7. **Legal posture:** we link out and attribute; we never present ourselves as the seller. Show "Checkout, delivery & returns handled by {Brand}" on every PDP CTA (copy exists in prototype).
8. Currency formatting: `Rs 8,000` (en-PK grouping), `USD 35` — helper exists conceptually in prototype (`fmt`).
9. Time zone: all user-facing times in `Asia/Karachi`.

## 12. Reference materials in this workspace

- `kapray-prototype.html` — approved interactive prototype: exact visual design, real seed data (18 products, 3 brands, campaign copy), working price-filter/search/wishlist logic to mirror.
- `prd-marketplace-app.md` — earlier PRD (metrics targets, risks).
- `feasibility-report.md` — market context and model rationale.

## 13. Questions Claude Code should ask the owner before Phase 1

1. Confirm the `~/Scrapper` folder has been copied into the monorepo as `scraper/` (it contains `scraper.py`, `brands.json`, `README.md`, and any existing `drops/` snapshots).
2. Supabase project URL + keys (or should it scaffold `supabase start` local-first? default: local-first).
3. Google Play developer account availability (affects Phase 5 timeline only).
4. Affiliate/UTM values agreed with any brand, if partnerships have started (default: `utm_source=kapray`).
