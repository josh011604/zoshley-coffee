create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  item_name text not null unique,
  stock integer not null default 0 check (stock >= 0),
  threshold integer not null default 0 check (threshold >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inventory_items_item_name_idx on public.inventory_items (item_name);

drop trigger if exists set_inventory_items_updated_at on public.inventory_items;
create trigger set_inventory_items_updated_at
before update on public.inventory_items
for each row
execute function public.set_updated_at();

alter table public.inventory_items enable row level security;

drop policy if exists "Service role can manage inventory items" on public.inventory_items;
create policy "Service role can manage inventory items"
  on public.inventory_items
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

insert into public.inventory_items (item_name, stock, threshold)
select v.item_name, v.stock, v.threshold
from (
  values
    ('Espresso Beans', 12, 8),
    ('Milk', 18, 12),
    ('Butter Croissant', 5, 6)
) as v(item_name, stock, threshold)
where not exists (
  select 1
  from public.inventory_items i
  where i.item_name = v.item_name
);