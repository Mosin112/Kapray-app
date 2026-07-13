-- Expand the brand roster to the launch set (spec §1 + owner request Jul 2026).
-- Nine live brands (all Shopify /products.json verified, Khaadi SFCC) + Sapphire
-- still blocked. Idempotent: safe to re-run. Gul Ahmed is promoted from
-- 'onboarding' to 'live' — its Shopify storefront (gulahmedshop.com) serves
-- products.json, unlike the Magento assumption in the original spec.

insert into brands (slug, name, domain, base_url, platform, currency, sync_status)
values
  ('nishat',      'Nishat Linen',     'nishatlinen.com',    'https://nishatlinen.com',      'shopify', 'PKR', 'live'),
  ('limelight',   'Limelight',        'limelight.pk',       'https://www.limelight.pk',     'shopify', 'PKR', 'live'),
  ('khaadi',      'Khaadi',           'us.khaadi.com',      'https://us.khaadi.com',        'sfcc',    'USD', 'live'),
  ('sanasafinaz', 'Sana Safinaz',     'sanasafinaz.com',    'https://www.sanasafinaz.com',  'shopify', 'PKR', 'live'),
  ('mariab',      'Maria B',          'mariab.pk',          'https://www.mariab.pk',        'shopify', 'PKR', 'live'),
  ('alkaram',     'Alkaram Studio',   'alkaramstudio.com',  'https://www.alkaramstudio.com','shopify', 'PKR', 'live'),
  ('bonanza',     'Bonanza Satrangi', 'bonanzasatrangi.com','https://bonanzasatrangi.com',  'shopify', 'PKR', 'live'),
  ('beechtree',   'BEECHTREE',        'beechtree.pk',       'https://beechtree.pk',         'shopify', 'PKR', 'live'),
  ('gulahmed',    'Gul Ahmed',        'gulahmedshop.com',   'https://www.gulahmedshop.com', 'shopify', 'PKR', 'live'),
  ('sapphire',    'Sapphire',         'sapphireonline.pk',  'https://pk.sapphireonline.pk', 'shopify', 'PKR', 'blocked')
on conflict (slug) do update set
  name        = excluded.name,
  domain      = excluded.domain,
  base_url    = excluded.base_url,
  platform    = excluded.platform,
  currency    = excluded.currency,
  sync_status = excluded.sync_status;

-- Drop the leftover prototype-only onboarding brand that isn't in the launch set.
delete from brands where slug = 'kayseria'
  and not exists (select 1 from products where products.brand_id = brands.id);
