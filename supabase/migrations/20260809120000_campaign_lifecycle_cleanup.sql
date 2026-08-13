-- Campaign lifecycle cleanup after the July→August pause.
--
-- pg_cron status transitions are Phase 4, so nothing ever flipped the July
-- sale campaigns off: the app was still showing "SALE LIVE" for sales whose
-- ends_at passed on ~20 Jul. Also purge the never-reviewed July [auto]
-- suggestions — the next full ingest re-suggests from fresh data if warranted.
-- Idempotent; safe to re-run.

-- 1. Any campaign past its end date is ended (the pg_cron job will own this
--    from Phase 4 onward).
update campaigns
set status = 'ended'
where status in ('live', 'scheduled')
  and ends_at is not null
  and ends_at < now();

-- 2. Drop stale auto-detected suggestions that were never promoted to live.
delete from campaigns
where source = 'auto_detected'
  and status = 'scheduled';

-- 3. Live campaigns keep a working hero image (from their brand's active
--    catalog) if theirs is missing.
update campaigns c
set hero_image = sub.src
from (
  select distinct on (p.brand_id) p.brand_id, pi.src
  from products p
  join product_images pi on pi.product_id = p.id
  where p.is_active = true and pi.src is not null and pi.src <> ''
  order by p.brand_id, pi.position, p.first_seen_at desc
) sub
where c.brand_id = sub.brand_id
  and c.status = 'live'
  and (c.hero_image is null or c.hero_image = '');
