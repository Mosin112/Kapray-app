-- Khaadi moves from the US storefront (USD) to the PK storefront (PKR),
-- per owner request. pk.khaadi.com serves PKR prices; the scraper now reads its
-- dataLayer. Update the brand row and clear the old USD products (different
-- SKUs, us.khaadi.com URLs) so the catalog isn't mixed-currency / stale-linked.

update brands
set domain = 'pk.khaadi.com', base_url = 'https://pk.khaadi.com',
    currency = 'PKR', platform = 'sfcc'
where slug = 'khaadi';

-- Clear old Khaadi catalog rows (events first — no cascade on product_events).
delete from product_events
where product_id in (
  select p.id from products p join brands b on b.id = p.brand_id
  where b.slug = 'khaadi'
);
delete from products
where brand_id in (select id from brands where slug = 'khaadi');

-- Let the Khaadi campaign re-pick a hero image from the new PKR catalog.
update campaigns
set hero_image = null
where brand_id in (select id from brands where slug = 'khaadi') and status = 'live';
