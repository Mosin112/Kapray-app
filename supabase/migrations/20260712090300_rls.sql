-- ─────────────────────────────────────────────────────────────────────────────
-- Kapray schema · 04 · Row-Level Security. Source: spec §4 (RLS paragraph) + §11.
--
-- Model:
--   * Catalog tables (brands, products, product_images, variants, campaigns):
--     public-read, service-role-write. RLS on + a permissive SELECT policy;
--     no write policies, so only the service-role key (which bypasses RLS) can
--     mutate them — that's the ingest pipeline / Edge Functions.
--   * User-owned tables (profiles, follows, wishlist_items, notifications):
--     owner-only via user_id = auth.uid().
--   * events_analytics: insert-only for anon + authenticated; no client SELECT.
--   * product_events, ingest_runs: internal; service-role only (RLS on, no
--     policies) — the app derives price history through views/queries later if
--     needed, but does not read raw events directly for MVP.
--
-- PostgREST exposes two client roles: `anon` (guest) and `authenticated`.
-- The service-role key connects as `service_role` and bypasses RLS entirely.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Catalog: public read, service-role write ────────────────────────────────
alter table brands          enable row level security;
alter table products        enable row level security;
alter table product_images  enable row level security;
alter table variants        enable row level security;
alter table campaigns       enable row level security;

create policy "catalog: public read brands"
  on brands for select to anon, authenticated using (true);
create policy "catalog: public read products"
  on products for select to anon, authenticated using (true);
create policy "catalog: public read product_images"
  on product_images for select to anon, authenticated using (true);
create policy "catalog: public read variants"
  on variants for select to anon, authenticated using (true);
create policy "catalog: public read campaigns"
  on campaigns for select to anon, authenticated using (true);

-- ── Internal tables: RLS on, no policies → service-role only ─────────────────
alter table product_events enable row level security;
alter table ingest_runs    enable row level security;

-- ── profiles: owner only ─────────────────────────────────────────────────────
alter table profiles enable row level security;

create policy "profiles: read own"
  on profiles for select to authenticated using (id = auth.uid());
create policy "profiles: insert own"
  on profiles for insert to authenticated with check (id = auth.uid());
create policy "profiles: update own"
  on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ── follows: owner only ──────────────────────────────────────────────────────
alter table follows enable row level security;

create policy "follows: read own"
  on follows for select to authenticated using (user_id = auth.uid());
create policy "follows: insert own"
  on follows for insert to authenticated with check (user_id = auth.uid());
create policy "follows: delete own"
  on follows for delete to authenticated using (user_id = auth.uid());

-- ── wishlist_items: owner only ───────────────────────────────────────────────
alter table wishlist_items enable row level security;

create policy "wishlist: read own"
  on wishlist_items for select to authenticated using (user_id = auth.uid());
create policy "wishlist: insert own"
  on wishlist_items for insert to authenticated with check (user_id = auth.uid());
create policy "wishlist: delete own"
  on wishlist_items for delete to authenticated using (user_id = auth.uid());

-- ── notifications: owner reads + marks read; server (service-role) inserts ────
alter table notifications enable row level security;

create policy "notifications: read own"
  on notifications for select to authenticated using (user_id = auth.uid());
create policy "notifications: update own"   -- e.g. set read_at
  on notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── events_analytics: insert-only, no client read ────────────────────────────
alter table events_analytics enable row level security;

create policy "analytics: anyone can insert"
  on events_analytics for insert to anon, authenticated with check (true);
