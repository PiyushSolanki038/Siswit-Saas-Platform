-- 036_fix_more_rls_recursion.sql
-- Fix Postgres 42501 (Forbidden / Infinite Recursion) errors everywhere by ensuring 
-- that the base `app_is_platform_super_admin` function runs as SECURITY DEFINER.
-- Since almost every single RLS policy checks `app_is_platform_super_admin`, any 
-- non-superuser evaluation would recurse infinitely on the platform_super_admins table's own policy.
-- Let's see if fixes or not
SET search_path = public, extensions;

-- Make app_is_platform_super_admin explicitly SECURITY DEFINER to bypass the platform_super_admins RLS evaluation during its execution
CREATE OR REPLACE FUNCTION public.app_is_platform_super_admin(
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_super_admins
    WHERE user_id = p_user_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.app_is_platform_super_admin(uuid) TO authenticated, service_role;
