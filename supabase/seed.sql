-- ─────────────────────────────────────────────────────────────────────────────
-- Kapray seed data. Idempotent — safe to run repeatedly (upsert on slug).
--
-- BRANDS are seeded here from real, verified config (spec §5 facts + brands.json).
--
-- PRODUCTS & CAMPAIGNS: intentionally NOT seeded here yet. The spec (§10 Phase 0)
-- sources the 18 launch products + campaign copy from the approved prototype
-- (kapray-prototype.html), which is not yet in the workspace. Two ways they land:
--   (a) paste the prototype's data block into a follow-up seed file, or
--   (b) run the ingest pipeline against scraper/drops/ (real catalog data).
-- Placeholders below mark where they go.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Brands ───────────────────────────────────────────────────────────────────
-- platform: DB enum is 'shopify'|'sfcc'|'magento'|'custom' (distinct from the
-- scraper's adapter key, e.g. 'khaadi_sfcc'). Khaadi launches on its US
-- storefront → currency USD, domain us.khaadi.com (spec §5, §11.2).

insert into brands (slug, name, domain, base_url, platform, currency, sync_status)
values
  ('nishat',    'Nishat Linen', 'nishatlinen.com',     'https://nishatlinen.com',       'shopify', 'PKR', 'live'),
  ('limelight', 'Limelight',    'limelight.pk',        'https://www.limelight.pk',      'shopify', 'PKR', 'live'),
  ('khaadi',    'Khaadi',       'us.khaadi.com',       'https://us.khaadi.com',         'sfcc',    'USD', 'live'),
  -- Blocks all automated access as of Jul 2026 → "Joining soon" in the app.
  ('sapphire',  'Sapphire',     'sapphireonline.pk',   'https://pk.sapphireonline.pk',  'shopify', 'PKR', 'blocked')
on conflict (slug) do update set
  name        = excluded.name,
  domain      = excluded.domain,
  base_url    = excluded.base_url,
  platform    = excluded.platform,
  currency    = excluded.currency,
  sync_status = excluded.sync_status;

-- ── Products (placeholder) ───────────────────────────────────────────────────
-- TODO(prototype): insert the 18 validated launch products
--   (13 Nishat/Limelight PKR + 5 Khaadi USD) from kapray-prototype.html's data
--   block, OR populate via `python3 ingest/ingest.py` against scraper/drops/.

-- ── Campaigns (placeholder) ──────────────────────────────────────────────────
-- TODO(prototype): insert launch campaign(s) + copy from the prototype.
