-- Give every live campaign a real hero image pulled from its brand's freshly
-- scraped catalog. The Limelight "Summer Clearance" campaign had a null
-- hero_image and rendered as a blank dark banner ("doesn't open properly");
-- this backfills any live campaign still missing one.

update campaigns c
set hero_image = sub.src
from (
  select distinct on (p.brand_id) p.brand_id, pi.src
  from products p
  join product_images pi on pi.product_id = p.id
  where p.is_active = true and pi.src is not null
  order by p.brand_id, pi.position, p.first_seen_at desc
) sub
where c.brand_id = sub.brand_id
  and c.status = 'live'
  and (c.hero_image is null or c.hero_image = '');
