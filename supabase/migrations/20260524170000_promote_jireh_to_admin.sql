update public.profiles
set
  role = 'admin',
  full_name = coalesce(nullif(full_name, ''), 'Jireh'),
  username = coalesce(username, 'jireh')
where lower(coalesce(email, '')) in ('jireh@gmail.com', 'jireh@zoshleycoffee.com')
   or lower(coalesce(username, '')) = 'jireh'
   or lower(coalesce(full_name, '')) = 'jireh';
