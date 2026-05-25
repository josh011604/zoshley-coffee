-- Add persistent categories for admin-created menu groups.

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  parent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists categories_name_idx on public.categories (name);

drop trigger if exists set_categories_updated_at on public.categories;
create trigger set_categories_updated_at
before update on public.categories
for each row
execute function public.set_updated_at();

alter table public.categories enable row level security;

drop policy if exists "Anyone can read categories" on public.categories;
create policy "Anyone can read categories"
  on public.categories
  for select
  using (true);

drop policy if exists "Service role can manage categories" on public.categories;
create policy "Service role can manage categories"
  on public.categories
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

insert into public.categories (name, parent)
select v.name, v.parent
from (
  values
    ('Espresso', null),
    ('Milk Drinks', null),
    ('Bakery', null),
    ('Food', null),
    ('Cold Brew', null)
) as v(name, parent)
where not exists (
  select 1
  from public.categories c
  where c.name = v.name
);