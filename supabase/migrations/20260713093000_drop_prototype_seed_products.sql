-- Remove the original prototype seed products for Nishat & Limelight.
-- Their URLs/handles were illustrative (e.g. nishat '42519114', limelight
-- 'u4316sd-2pc-374') and 404 in the checkout WebView — the cause of the
-- "some Limelight links don't open" report. Real scraped catalogs (real
-- Shopify product ids + handle URLs) have since replaced them.
--
-- Khaadi's prototype seeds are intentionally kept: the live SFCC scrape
-- refreshed the same external_ids with real data.
--
-- product_events references products with no cascade, so clear those first;
-- variants + product_images cascade on delete.

with victims as (
  select p.id
  from products p
  join brands b on b.id = p.brand_id
  where (b.slug = 'nishat'    and p.external_id in
           ('42519114','42519116','42519123','42519135','42519137','42519190','42519191'))
     or (b.slug = 'limelight' and p.external_id in
           ('u4316sd-2pc-374','g0243tp-xsl-489','f3415su-809-143',
            'p9979su-sml-374','i4949sc-fre-p17','w1832dr-xsl-034'))
)
, _ev as (delete from product_events where product_id in (select id from victims))
delete from products where id in (select id from victims);
