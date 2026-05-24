create or replace function public.lookup_staff_email(login_value text)
returns text
language sql
security definer
set search_path = public
as $$
  select email
  from public.profiles
  where username = login_value
     or email ilike login_value || '@%'
  limit 1;
$$;
