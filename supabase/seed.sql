-- ─────────────────────────────────────────────────────────────────────────────
-- Kapray seed data. Idempotent — safe to run repeatedly.
--
-- Sources:
--   * Brands: brands.json + spec §5 facts (validated by live probing, Jul 2026).
--   * Products/campaigns: the approved prototype's data block
--     (docs/kapray-prototype.html, "LIVE DATA synced Jul 8 2026") —
--     7 Nishat + 6 Limelight (PKR) + 5 Khaadi (USD) = 18 products.
--
-- Image notes:
--   * Nishat: CDN filename follows the documented `{handle}-_1.jpg` pattern
--     (spec §5 example).
--   * Khaadi: full CDN URLs given in the prototype.
--   * Limelight: CDN filenames are arbitrary (not derivable from handles) and
--     the prototype embeds them as base64 — so Limelight seed products carry
--     no images. The ingest pipeline fills real ones on the first live run.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Brands ───────────────────────────────────────────────────────────────────
-- platform: DB enum is 'shopify'|'sfcc'|'magento'|'custom'. Khaadi launches on
-- its US storefront → currency USD (spec §11.2). Sapphire is 'blocked'
-- (bot-blocks all access); Kayseria/Gul Ahmed are 'onboarding' → both render
-- as "Joining soon" (spec §11.3, prototype sales hub).

insert into brands (slug, name, domain, base_url, platform, currency, sync_status)
values
  ('nishat',    'Nishat Linen', 'nishatlinen.com',    'https://nishatlinen.com',      'shopify', 'PKR', 'live'),
  ('limelight', 'Limelight',    'limelight.pk',       'https://www.limelight.pk',     'shopify', 'PKR', 'live'),
  ('khaadi',    'Khaadi',       'us.khaadi.com',      'https://us.khaadi.com',        'sfcc',    'USD', 'live'),
  ('sapphire',  'Sapphire',     'sapphireonline.pk',  'https://pk.sapphireonline.pk', 'shopify', 'PKR', 'blocked'),
  ('kayseria',  'Kayseria',     'kayseria.com',       'https://www.kayseria.com',     'shopify', 'PKR', 'onboarding'),
  ('gulahmed',  'Gul Ahmed',    'gulahmedshop.com',   'https://www.gulahmedshop.com', 'magento', 'PKR', 'onboarding')
on conflict (slug) do update set
  name        = excluded.name,
  domain      = excluded.domain,
  base_url    = excluded.base_url,
  platform    = excluded.platform,
  currency    = excluded.currency,
  sync_status = excluded.sync_status;

-- ── Products (18, from the prototype data block) ─────────────────────────────
with seed(slug, external_id, title, product_url, category, fabric) as (
  values
    -- Nishat Linen · 3-pc embroidered suits · Mid-Summer Sale (flat -50%)
    ('nishat', '42519114', '3-Pc Embroidered Suit — Aqua',            'https://nishatlinen.com/products/42519114', 'unstitched', 'Cambric'),
    ('nishat', '42519116', '3-Pc Embroidered Suit — Fuchsia',         'https://nishatlinen.com/products/42519116', 'unstitched', null),
    ('nishat', '42519123', '3-Pc Embroidered Suit — Blush Pink',      'https://nishatlinen.com/products/42519123', 'unstitched', null),
    ('nishat', '42519135', '3-Pc Embroidered Suit — Fuchsia & Ivory', 'https://nishatlinen.com/products/42519135', 'unstitched', null),
    ('nishat', '42519137', '3-Pc Embroidered Suit — Lime',            'https://nishatlinen.com/products/42519137', 'unstitched', null),
    ('nishat', '42519190', '3-Pc Embroidered Suit — Pink',            'https://nishatlinen.com/products/42519190', 'unstitched', null),
    ('nishat', '42519191', '3-Pc Embroidered Suit — Navy',            'https://nishatlinen.com/products/42519191', 'unstitched', null),
    -- Limelight · Summer Clearance (up to -30%)
    ('limelight', 'u4316sd-2pc-374', '2-Pc Lawn Suit — Printed (Unstitched)', 'https://www.limelight.pk/products/u4316sd-2pc-374', 'unstitched',  'Lawn'),
    ('limelight', 'g0243tp-xsl-489', 'Silk Top',                              'https://www.limelight.pk/products/g0243tp-xsl-489', 'pret',        'Silk'),
    ('limelight', 'f3415su-809-143', '2-Pc Lawn Suit — Embroidered',          'https://www.limelight.pk/products/f3415su-809-143', 'unstitched',  'Lawn'),
    ('limelight', 'p9979su-sml-374', 'Grip Co-Ord Set — Dyed (Pret)',         'https://www.limelight.pk/products/p9979su-sml-374', 'pret',        'Grip'),
    ('limelight', 'i4949sc-fre-p17', 'Silk Scarf',                            'https://www.limelight.pk/products/i4949sc-fre-p17', 'accessories', 'Silk'),
    ('limelight', 'w1832dr-xsl-034', 'Grip Shirt — Printed (Pret)',           'https://www.limelight.pk/products/w1832dr-xsl-034', 'pret',        'Grip'),
    -- Khaadi (US storefront, USD) · Summer Collection drop (NEW)
    ('khaadi', '8-26-304-A-D1-VG_MULTI', 'Olive V-Neck Kurta',             'https://us.khaadi.com/olive-v-neck-kurta/8-26-304-A-D1-VG_MULTI.html',    'ready-to-wear', null),
    ('khaadi', '8-26-210-A-D1-VG_MULTI', 'Arabic Lawn Kurta — Embroidered','https://us.khaadi.com/arabic-lawn-kurta/8-26-210-A-D1-VG_MULTI.html',     'ready-to-wear', 'Lawn'),
    ('khaadi', '8-26-208-A-C1-VG_MULTI', 'Green V-Neck Kurta — Lyocell',   'https://us.khaadi.com/green-v-neck-kurta/8-26-208-A-C1-VG_MULTI.html',    'ready-to-wear', 'Lyocell'),
    ('khaadi', '8-26-208-A-A1-VG_MULTI', 'Long Lavender Kurta — Lyocell',  'https://us.khaadi.com/long-lavendar-kurta/8-26-208-A-A1-VG_MULTI.html',   'ready-to-wear', 'Lyocell'),
    ('khaadi', '8-26-210-A-A1-VG_MULTI', 'Black Lawn Kurta — Embroidered', 'https://us.khaadi.com/black-lawn-kurta/8-26-210-A-A1-VG_MULTI.html',      'ready-to-wear', 'Lawn')
)
insert into products (brand_id, external_id, title, product_url, category, fabric)
select b.id, s.external_id, s.title, s.product_url, s.category, s.fabric
from seed s join brands b on b.slug = s.slug
on conflict (brand_id, external_id) do update set
  title       = excluded.title,
  product_url = excluded.product_url,
  category    = excluded.category,
  fabric      = excluded.fabric,
  is_active   = true,
  last_seen_at = now();

-- ── Variants (one 'Default' per product, like the scraper emits) ─────────────
with seed(slug, external_id, price, compare_at_price, available) as (
  values
    ('nishat', '42519114', 8000.00, 16000.00, true),
    ('nishat', '42519116', 8750.00, 17500.00, true),
    ('nishat', '42519123', 6750.00, 13500.00, false),
    ('nishat', '42519135', 8000.00, 16000.00, false),
    ('nishat', '42519137', 8750.00, 17500.00, true),
    ('nishat', '42519190', 6750.00, 13500.00, false),
    ('nishat', '42519191', 8750.00, 17500.00, true),
    ('limelight', 'u4316sd-2pc-374', 1959.00, 2799.00, true),
    ('limelight', 'g0243tp-xsl-489', 1799.00, 2399.00, true),
    ('limelight', 'f3415su-809-143', 3674.00, 4899.00, true),
    ('limelight', 'p9979su-sml-374', 3899.00, 5199.00, true),
    ('limelight', 'i4949sc-fre-p17', 1799.00, 2399.00, true),
    ('limelight', 'w1832dr-xsl-034', 1959.00, 2799.00, true),
    ('khaadi', '8-26-304-A-D1-VG_MULTI', 35.00, null, true),
    ('khaadi', '8-26-210-A-D1-VG_MULTI', 35.00, null, true),
    ('khaadi', '8-26-208-A-C1-VG_MULTI', 40.00, null, true),
    ('khaadi', '8-26-208-A-A1-VG_MULTI', 40.00, null, true),
    ('khaadi', '8-26-210-A-A1-VG_MULTI', 35.00, null, true)
)
insert into variants (product_id, external_id, title, price, compare_at_price, available)
select p.id, s.external_id, 'Default', s.price, s.compare_at_price, s.available
from seed s
join brands b on b.slug = s.slug
join products p on p.brand_id = b.id and p.external_id = s.external_id
on conflict (product_id, external_id) do update set
  price            = excluded.price,
  compare_at_price = excluded.compare_at_price,
  available        = excluded.available;

-- ── Images (Nishat pattern-derived; Khaadi full URLs; Limelight via ingest) ──
with seed(slug, external_id, src) as (
  values
    ('nishat', '42519114', 'https://cdn.shopify.com/s/files/1/0534/2065/4791/files/42519114-_1.jpg'),
    ('nishat', '42519116', 'https://cdn.shopify.com/s/files/1/0534/2065/4791/files/42519116-_1.jpg'),
    ('nishat', '42519123', 'https://cdn.shopify.com/s/files/1/0534/2065/4791/files/42519123-_1.jpg'),
    ('nishat', '42519135', 'https://cdn.shopify.com/s/files/1/0534/2065/4791/files/42519135-_1.jpg'),
    ('nishat', '42519137', 'https://cdn.shopify.com/s/files/1/0534/2065/4791/files/42519137-_1.jpg'),
    ('nishat', '42519190', 'https://cdn.shopify.com/s/files/1/0534/2065/4791/files/42519190-_1.jpg'),
    ('nishat', '42519191', 'https://cdn.shopify.com/s/files/1/0534/2065/4791/files/42519191-_1.jpg'),
    ('khaadi', '8-26-304-A-D1-VG_MULTI', 'https://us.khaadi.com/dw/image/v2/BJTG_PRD/on/demandware.static/-/Sites-khaadi-master-catalog/default/dw939b2d4f/images/hi-res/8-26-304-a-d1_multi_1.jpg?sw=400&sh=600'),
    ('khaadi', '8-26-210-A-D1-VG_MULTI', 'https://us.khaadi.com/dw/image/v2/BJTG_PRD/on/demandware.static/-/Sites-khaadi-master-catalog/default/dwfcf10bb7/images/hi-res/8-26-210-a-d1_multi_1.jpg?sw=400&sh=600'),
    ('khaadi', '8-26-208-A-C1-VG_MULTI', 'https://us.khaadi.com/dw/image/v2/BJTG_PRD/on/demandware.static/-/Sites-khaadi-master-catalog/default/dwdab8be60/images/hi-res/8-26-208-a-c1_multi_1.jpg?sw=400&sh=600'),
    ('khaadi', '8-26-208-A-A1-VG_MULTI', 'https://us.khaadi.com/dw/image/v2/BJTG_PRD/on/demandware.static/-/Sites-khaadi-master-catalog/default/dwf08f36dc/images/hi-res/8-26-208-a-a1_multi_1.jpg?sw=400&sh=600'),
    ('khaadi', '8-26-210-A-A1-VG_MULTI', 'https://us.khaadi.com/dw/image/v2/BJTG_PRD/on/demandware.static/-/Sites-khaadi-master-catalog/default/dw39a91de2/images/hi-res/8-26-210-a-a1_multi_1.jpg?sw=400&sh=600')
),
resolved as (
  select p.id as product_id, s.src
  from seed s
  join brands b on b.slug = s.slug
  join products p on p.brand_id = b.id and p.external_id = s.external_id
),
cleared as (
  delete from product_images where product_id in (select product_id from resolved)
)
insert into product_images (product_id, src, position)
select product_id, src, 1 from resolved;

-- ── Campaigns (copy from the prototype) ──────────────────────────────────────
-- Live sales for Nishat/Limelight, a NEW drop for Khaadi. Times are relative to
-- seed-run so the countdown UI has something real to show.
delete from campaigns where source = 'manual'
  and title in ('Mid-Summer Sale', 'Summer Clearance', 'Summer Collection');

insert into campaigns (brand_id, title, subtitle, hero_image, kind, starts_at, ends_at, status, source)
select b.id, c.title, c.subtitle, c.hero_image, c.kind,
       now() - interval '2 days',
       case when c.kind = 'drop' then null else now() + interval '7 days' end,
       'live', 'manual'
from (values
  ('nishat',    'Mid-Summer Sale',   'Flat 50% off · luxury ready-to-stitch',
   'https://cdn.shopify.com/s/files/1/0534/2065/4791/files/42519135-_1.jpg', 'sale'),
  ('limelight', 'Summer Clearance',  'Up to 30% off · lawn, pret & silk',
   null, 'sale'),
  ('khaadi',    'Summer Collection', 'New in · ready to wear',
   'https://us.khaadi.com/dw/image/v2/BJTG_PRD/on/demandware.static/-/Sites-khaadi-master-catalog/default/dwfcf10bb7/images/hi-res/8-26-210-a-d1_multi_1.jpg?sw=800&sh=1200', 'drop')
) c(slug, title, subtitle, hero_image, kind)
join brands b on b.slug = c.slug;
