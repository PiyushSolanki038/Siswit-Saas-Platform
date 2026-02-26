-- Backfill helper for invited users whose membership insert did not complete during signup.
-- Allows authenticated users to claim pending invites tied to their email address.

SET search_path = public, extensions;

CREATE OR REPLACE FUNCTION public.claim_pending_invitations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_claimed integer := 0;
BEGIN
  IF v_user_id IS NULL OR v_email = '' THEN
    RETURN 0;
  END IF;

  -- Re-attach stale pending memberships that were created for the same email with another user id.
  UPDATE public.organization_memberships om
  SET
    user_id = v_user_id,
    updated_at = NOW()
  WHERE lower(om.email) = v_email
    AND om.account_state = 'pending_verification'
    AND om.is_active = true
    AND om.user_id <> v_user_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.organization_memberships existing
      WHERE existing.organization_id = om.organization_id
        AND existing.user_id = v_user_id
    )
    AND (
      EXISTS (
        SELECT 1
        FROM public.employee_invitations ei
        WHERE ei.organization_id = om.organization_id
          AND lower(ei.invited_email) = v_email
          AND ei.status = 'pending'
          AND ei.expires_at > NOW()
      )
      OR EXISTS (
        SELECT 1
        FROM public.client_invitations ci
        WHERE ci.organization_id = om.organization_id
          AND lower(ci.invited_email) = v_email
          AND ci.status = 'pending'
          AND ci.expires_at > NOW()
      )
    );

  WITH employee_claims AS (
    INSERT INTO public.organization_memberships (
      organization_id,
      user_id,
      email,
      role,
      employee_role_id,
      account_state,
      is_email_verified,
      is_active,
      created_at,
      updated_at
    )
    SELECT
      ei.organization_id,
      v_user_id,
      ei.invited_email,
      ei.role,
      ei.employee_role_id,
      'pending_verification'::public.account_state,
      false,
      true,
      NOW(),
      NOW()
    FROM public.employee_invitations ei
    WHERE lower(ei.invited_email) = v_email
      AND ei.status = 'pending'
      AND ei.expires_at > NOW()
      AND NOT EXISTS (
        SELECT 1
        FROM public.organization_memberships om
        WHERE om.organization_id = ei.organization_id
          AND om.user_id = v_user_id
      )
    ON CONFLICT DO NOTHING
    RETURNING 1
  ),
  client_claims AS (
    INSERT INTO public.organization_memberships (
      organization_id,
      user_id,
      email,
      role,
      account_state,
      is_email_verified,
      is_active,
      created_at,
      updated_at
    )
    SELECT
      ci.organization_id,
      v_user_id,
      ci.invited_email,
      'client'::public.app_role,
      'pending_verification'::public.account_state,
      false,
      true,
      NOW(),
      NOW()
    FROM public.client_invitations ci
    WHERE lower(ci.invited_email) = v_email
      AND ci.status = 'pending'
      AND ci.expires_at > NOW()
      AND NOT EXISTS (
        SELECT 1
        FROM public.organization_memberships om
        WHERE om.organization_id = ci.organization_id
          AND om.user_id = v_user_id
      )
    ON CONFLICT DO NOTHING
    RETURNING 1
  )
  SELECT
    coalesce((SELECT count(*) FROM employee_claims), 0)
    + coalesce((SELECT count(*) FROM client_claims), 0)
  INTO v_claimed;

  UPDATE public.employee_invitations ei
  SET
    status = 'accepted',
    accepted_at = coalesce(ei.accepted_at, NOW()),
    updated_at = NOW()
  WHERE lower(ei.invited_email) = v_email
    AND ei.status = 'pending'
    AND ei.expires_at > NOW()
    AND EXISTS (
      SELECT 1
      FROM public.organization_memberships om
      WHERE om.organization_id = ei.organization_id
        AND om.user_id = v_user_id
        AND lower(om.email) = v_email
        AND om.role = ei.role
    );

  UPDATE public.client_invitations ci
  SET
    status = 'accepted',
    accepted_at = coalesce(ci.accepted_at, NOW()),
    updated_at = NOW()
  WHERE lower(ci.invited_email) = v_email
    AND ci.status = 'pending'
    AND ci.expires_at > NOW()
    AND EXISTS (
      SELECT 1
      FROM public.organization_memberships om
      WHERE om.organization_id = ci.organization_id
        AND om.user_id = v_user_id
        AND lower(om.email) = v_email
        AND om.role = 'client'
    );

  RETURN coalesce(v_claimed, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_pending_invitations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_pending_invitations() TO authenticated, service_role;

