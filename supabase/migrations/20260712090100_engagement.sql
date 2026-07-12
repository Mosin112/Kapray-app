-- ─────────────────────────────────────────────────────────────────────────────
-- Kapray schema · 02 · Users & engagement. Source: spec §4.
-- Supabase auth.users is the identity source; profiles 1:1 extends it.
-- ─────────────────────────────────────────────────────────────────────────────

create table profiles (
  id              uuid primary key references auth.users(id),
  phone           text,
  expo_push_token text,
  notif_prefs     jsonb default '{"drops":true,"price_drops":true,"restocks":true,"max_per_day":3}',
  created_at      timestamptz default now()
);

create table follows (
  user_id    uuid references profiles(id) on delete cascade,
  brand_id   uuid references brands(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, brand_id)
);
create index on follows (brand_id);

create table wishlist_items (
  user_id    uuid references profiles(id) on delete cascade,
  product_id uuid references products(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, product_id)
);
create index on wishlist_items (product_id);

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
create index on notifications (user_id, created_at desc);

-- Analytics (the future brand-facing product; keep portable).
create table events_analytics (
  id         bigint generated always as identity primary key,
  user_id    uuid,
  session_id text,
  name       text not null,       -- 'impression'|'pdp_view'|'clickout'|'webview_opened'|'search'|'filter_applied'|'wishlist_add'|'push_open'|'purchase_detected'
  props      jsonb default '{}',  -- {product_id, brand_id, campaign_id, price, position, query...}
  created_at timestamptz default now()
);
create index on events_analytics (name, created_at desc);

-- Auto-provision a profile row when a new auth user is created, so the app can
-- rely on profiles existing. Vanilla trigger — ports to any Postgres.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, phone)
  values (new.id, new.phone)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
