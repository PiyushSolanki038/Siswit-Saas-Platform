begin;

drop trigger if exists on_auth_user_created_request on auth.users;
drop function if exists public.handle_new_signup_request();

alter function public.handle_new_user() security definer;
alter function public.ensure_user_role() security definer;
alter function public.current_app_role() security definer;
alter function public.is_admin() security definer;

alter function public.handle_new_user() owner to postgres;
alter function public.ensure_user_role() owner to postgres;
alter function public.current_app_role() owner to postgres;
alter function public.is_admin() owner to postgres;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

commit;
