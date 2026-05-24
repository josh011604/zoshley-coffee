-- Zoshley Coffee Shop Supabase schema
-- Paste this into the Supabase SQL editor.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  category text not null,
  price numeric(10,2) not null check (price >= 0),
  featured boolean not null default false,
  is_available boolean not null default true,
  image_url text,
  prep_time text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  fulfillment text not null check (fulfillment in ('pickup', 'delivery')),
  notes text,
  items jsonb not null default '[]'::jsonb,
  subtotal numeric(10,2) not null default 0,
  tax numeric(10,2) not null default 0,
  delivery_fee numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  status text not null default 'new' check (status in ('new', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists menu_items_category_idx on public.menu_items (category);
create index if not exists menu_items_featured_idx on public.menu_items (featured);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_created_at_idx on public.orders (created_at desc);

drop trigger if exists set_menu_items_updated_at on public.menu_items;
create trigger set_menu_items_updated_at
before update on public.menu_items
for each row
execute function public.set_updated_at();

drop trigger if exists set_orders_updated_at on public.orders;
create trigger set_orders_updated_at
before update on public.orders
for each row
execute function public.set_updated_at();

alter table public.menu_items enable row level security;
alter table public.orders enable row level security;

-- Public read access for menu items.
drop policy if exists "Anyone can read menu items" on public.menu_items;
create policy "Anyone can read menu items"
  on public.menu_items
  for select
  using (true);

-- Public order creation for the storefront.
drop policy if exists "Anyone can create orders" on public.orders;
create policy "Anyone can create orders"
  on public.orders
  for insert
  with check (true);

-- Demo dashboard and verification scripts can read the latest orders.
drop policy if exists "Anyone can read orders" on public.orders;
create policy "Anyone can read orders"
  on public.orders
  for select
  using (true);

-- Optional admin/service role access for menu items and orders.
drop policy if exists "Service role can manage menu items" on public.menu_items;
create policy "Service role can manage menu items"
  on public.menu_items
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Service role can manage orders" on public.orders;
create policy "Service role can manage orders"
  on public.orders
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

insert into public.menu_items (name, description, category, price, featured, is_available, image_url, prep_time)
select v.name, v.description, v.category, v.price, v.featured, v.is_available, v.image_url, v.prep_time
from (
  values
    ('Espresso', 'A short, intense shot with a bright crema and deep chocolate finish.', 'Espresso', 95, true, true, null, '4 min'),
    ('Cappuccino', 'Velvet milk foam over a balanced double shot and toasted aroma.', 'Espresso', 135, true, true, null, '5 min'),
    ('Vanilla Latte', 'Smooth espresso, steamed milk, and a clean vanilla lift.', 'Milk Drinks', 145, false, true, null, '6 min'),
    ('Cold Brew', 'Slow-steeped for 12 hours to keep it crisp, smooth, and naturally sweet.', 'Cold Brew', 155, true, true, null, '3 min'),
    ('Butter Croissant', 'Flaky layers, golden crust, and a rich buttery center.', 'Bakery', 80, false, true, null, '2 min'),
    ('Club Sandwich', 'Stacked, hearty, and made for a proper lunch break.', 'Food', 195, false, true, null, '10 min')
) as v(name, description, category, price, featured, is_available, image_url, prep_time)
where not exists (
  select 1
  from public.menu_items m
  where m.name = v.name
    and m.category = v.category
);
