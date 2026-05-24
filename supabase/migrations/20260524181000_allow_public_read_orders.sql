drop policy if exists "Anyone can read orders" on public.orders;
create policy "Anyone can read orders"
  on public.orders
  for select
  using (true);