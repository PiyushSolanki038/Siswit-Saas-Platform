begin;

alter table public.user_roles
  add column if not exists approved boolean;

update public.user_roles
set approved = true
where approved is null;

alter table public.user_roles
  alter column approved set default true;

update public.user_roles
set approved = true
where role in ('admin', 'user');

update public.user_roles
set approved = false
where role = 'employee'
  and approved is null;

insert into public.user_roles (user_id, role, approved)
select sr.user_id, 'employee', false
from public.signup_requests sr
where sr.status = 'pending'
on conflict (user_id) do update
set role = 'employee',
    approved = false,
    updated_at = now();

alter table public.user_roles
  alter column approved set not null;

create index if not exists idx_user_roles_role_approved
  on public.user_roles (role, approved);

drop trigger if exists trg_cleanup_signup_requests on public.user_roles;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  first_name_value text;
  last_name_value text;
  signup_type_value text;
begin
  first_name_value := nullif(new.raw_user_meta_data ->> 'first_name', '');
  last_name_value := nullif(new.raw_user_meta_data ->> 'last_name', '');
  signup_type_value := lower(coalesce(nullif(new.raw_user_meta_data ->> 'signup_type', ''), 'customer'));

  insert into public.profiles (user_id, first_name, last_name)
  values (new.id, first_name_value, last_name_value)
  on conflict (user_id)
  do update
  set first_name = excluded.first_name,
      last_name = excluded.last_name,
      updated_at = now();

  if not exists (select 1 from public.user_roles) then
    insert into public.user_roles (user_id, role, approved)
    values (new.id, 'admin', true)
    on conflict (user_id) do update
    set role = 'admin',
        approved = true,
        updated_at = now();

  elsif signup_type_value = 'employee' then
    insert into public.user_roles (user_id, role, approved)
    values (new.id, 'employee', false)
    on conflict (user_id) do update
    set role = 'employee',
        approved = false,
        updated_at = now();

    insert into public.signup_requests (user_id, email, first_name, last_name, status)
    values (new.id, new.email, first_name_value, last_name_value, 'pending')
    on conflict (user_id) do update
    set email = excluded.email,
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        status = 'pending',
        updated_at = now();

  else
    insert into public.user_roles (user_id, role, approved)
    values (new.id, 'user', true)
    on conflict (user_id) do update
    set role = 'user',
        approved = true,
        updated_at = now();
  end if;

  return new;
end;
$$;

create or replace function public.ensure_user_role()
returns table (role text, approved boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.user_roles (user_id, role, approved)
  values (current_user_id, 'user', true)
  on conflict (user_id) do nothing;

  return query
  select ur.role, ur.approved
  from public.user_roles ur
  where ur.user_id = current_user_id
  limit 1;
end;
$$;

alter function public.handle_new_user() owner to postgres;
alter function public.ensure_user_role() owner to postgres;
alter function public.current_app_role() owner to postgres;
alter function public.is_admin() owner to postgres;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

grant execute on function public.ensure_user_role() to authenticated;

commit;
