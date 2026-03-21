-- 035_fix_rls_recursion.sql
-- Fix the 403 (42501 insufficient_privilege) errors by ensuring that
-- core organization access functions bypass RLS during their internal checks.
-- This prevents infinite recursion and evaluation errors when querying tables 
-- that themselves call these functions in their SELECT policies.

SET search_path = public, extensions;

-- Make app_user_has_organization_access SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.app_user_has_organization_access(
  p_organization_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    public.app_is_platform_super_admin(p_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.organization_memberships om
      WHERE om.user_id = p_user_id
        AND om.organization_id = p_organization_id
        AND om.is_active = true
        AND om.account_state IN ('active', 'pending_approval', 'pending_verification')
    );
$$;

-- Make app_user_has_internal_organization_access SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.app_user_has_internal_organization_access(
  p_organization_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    public.app_is_platform_super_admin(p_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.organization_memberships om
      WHERE om.user_id = p_user_id
        AND om.organization_id = p_organization_id
        AND om.is_active = true
        AND om.account_state IN ('active', 'pending_approval', 'pending_verification')
        AND om.role IN ('owner', 'admin', 'manager', 'employee')
    );
$$;

-- Make app_user_can_select_portal_record SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.app_user_can_select_portal_record(
  p_organization_id uuid,
  p_account_id uuid DEFAULT NULL,
  p_contact_id uuid DEFAULT NULL,
  p_created_by uuid DEFAULT NULL,
  p_owner_id uuid DEFAULT NULL,
  p_user_id uuid DEFAULT auth.uid(),
  p_fallback_email text DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    public.app_is_platform_super_admin(p_user_id)
    OR public.app_user_has_internal_organization_access(p_organization_id, p_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.organization_memberships om
      WHERE om.user_id = p_user_id
        AND om.organization_id = p_organization_id
        AND om.is_active = true
        AND om.account_state IN ('active', 'pending_verification')
        AND om.role = 'client'
        AND (
          (p_account_id IS NOT NULL AND om.account_id = p_account_id)
          OR (p_contact_id IS NOT NULL AND om.contact_id = p_contact_id)
          OR (p_fallback_email IS NOT NULL AND lower(om.email) = lower(p_fallback_email) AND om.account_id IS NULL AND om.contact_id IS NULL)
          OR (p_created_by IS NOT NULL AND p_created_by = p_user_id)
          OR (p_owner_id IS NOT NULL AND p_owner_id = p_user_id)
        )
    );
$$;

-- Grant execute rights explicitly
GRANT EXECUTE ON FUNCTION public.app_user_has_organization_access(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_user_has_internal_organization_access(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_user_can_select_portal_record(uuid, uuid, uuid, uuid, uuid, uuid, text) TO authenticated, service_role;
