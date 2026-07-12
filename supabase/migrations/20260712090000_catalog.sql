-- ─────────────────────────────────────────────────────────────────────────────
-- Kapray schema · 01 · Catalog (brands, products, images, variants, events,
-- campaigns). Source: spec §4. Design rule: campaigns are first-class; products
-- belong to brands; all price/stock changes are event-sourced so notifications
-- and price history are derivable.
--
-- Portability note (spec §11.4): vanilla Postgres only. gen_random_uuid() ships
-- with core Postgres 13+ (pgcrypto not required), but we enable pgcrypto anyway
-- to be explicit and safe across environments.
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists pgcrypto;

-- ── brands ───────────────────────────────────────────────────────────────────
create table brands (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,          -- 'nishat', 'limelight', 'khaadi'
  name          text not null,
  domain        text not null,                 -- 'nishatlinen.com'
  base_url      text not null,                 -- 'https://nishatlinen.com'
  logo_url      text,
  platform      text not null,                 -- 'shopify' | 'sfcc' | 'magento' | 'custom'
  currency      text not null default 'PKR',   -- Khaadi US feed is 'USD'
  sync_status   text not null default 'live',  -- 'live' | 'onboarding' | 'blocked'
  created_at    timestamptz default now()
);

-- ── products ─────────────────────────────────────────────────────────────────
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
  missing_count int not null default 0,        -- consecutive feeds absent (ingest §5.3)
  unique (brand_id, external_id)
);
create index on products (brand_id);
create index on products (is_active);

-- ── product_images ───────────────────────────────────────────────────────────
create table product_images (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references products(id) on delete cascade,
  src         text not null,
  position    int not null default 1
);
create index on product_images (product_id);

-- ── variants ─────────────────────────────────────────────────────────────────
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
create index on variants (product_id);

-- ── product_events (event-sourced changes; ingest writes, triggers read) ──────
create table product_events (
  id          bigint generated always as identity primary key,
  product_id  uuid not null references products(id),
  variant_id  uuid references variants(id),
  type        text not null,   -- 'new_product'|'price_drop'|'price_rise'|'restock'|'out_of_stock'|'removed'
  old_value   jsonb,
  new_value   jsonb,
  created_at  timestamptz default now()
);
create index on product_events (type, created_at desc);
create index on product_events (product_id, created_at desc);

-- ── campaigns (first-class) ──────────────────────────────────────────────────
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
create index on campaigns (status);
create index on campaigns (brand_id);
