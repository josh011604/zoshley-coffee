alter table public.profiles add column if not exists username text unique;

create index if not exists profiles_username_idx on public.profiles (username);

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, username, full_name, role)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data->>'username', ''),
    nullif(new.raw_user_meta_data->>'full_name', ''),
    case
      when new.raw_user_meta_data->>'role' in ('admin', 'staff') then new.raw_user_meta_data->>'role'
      else 'staff'
    end
  )
  on conflict (id)
  do update set
    email = excluded.email,
    username = coalesce(excluded.username, public.profiles.username);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row
execute function public.handle_new_user_profile();
