-- Invitation lookup and signup helpers.
-- These RPCs handle pre-verification flows where auth.uid() may still be NULL.

SET search_path = public, extensions;

CREATE OR REPLACE FUNCTION public.get_employee_invitation_details(
  p_token text
)
RETURNS TABLE (
  id uuid,
  organization_id uuid,
  invited_email text,
  role public.app_role,
  employee_role_id uuid,
  expires_at timestamptz,
  status public.invitation_state,
  organization_name text,
  organization_code text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT
    ei.id,
    ei.organization_id,
    ei.invited_email,
    ei.role,
    ei.employee_role_id,
    ei.expires_at,
    CASE
      WHEN ei.status = 'pending' AND ei.expires_at <= NOW() THEN 'expired'::public.invitation_state
      ELSE ei.status
    END AS status,
    o.name AS organization_name,
    o.org_code AS organization_code
  FROM public.employee_invitations ei
  INNER JOIN public.organizations o ON o.id = ei.organization_id
  WHERE ei.token_hash = public.hash_invitation_token(trim(p_token))
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_client_invitation_details(
  p_token text
)
RETURNS TABLE (
  id uuid,
  organization_id uuid,
  invited_email text,
  expires_at timestamptz,
  status public.invitation_state,
  organization_name text,
  organization_code text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT
    ci.id,
    ci.organization_id,
    ci.invited_email,
    ci.expires_at,
    CASE
      WHEN ci.status = 'pending' AND ci.expires_at <= NOW() THEN 'expired'::public.invitation_state
      ELSE ci.status
    END AS status,
    o.name AS organization_name,
    o.org_code AS organization_code
  FROM public.client_invitations ci
  INNER JOIN public.organizations o ON o.id = ci.organization_id
  WHERE ci.token_hash = public.hash_invitation_token(trim(p_token))
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.create_client_signup_membership(
  p_user_id uuid,
  p_organization_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_status text;
  v_user_email text;
  v_membership_id uuid;
BEGIN
  IF p_user_id IS NULL OR p_organization_id IS NULL THEN
    RAISE EXCEPTION 'Missing client signup details';
  END IF;

  SELECT o.status
  INTO v_org_status
  FROM public.organizations o
  WHERE o.id = p_organization_id;

  IF v_org_status IS NULL OR v_org_status NOT IN ('active', 'trial') THEN
    RAISE EXCEPTION 'Organization not found or unavailable';
  END IF;

  SELECT lower(u.email)
  INTO v_user_email
  FROM auth.users u
  WHERE u.id = p_user_id;

  IF coalesce(v_user_email, '') = '' THEN
    RAISE EXCEPTION 'User account not found';
  END IF;

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
  ) VALUES (
    p_organization_id,
    p_user_id,
    v_user_email,
    'client',
    'pending_verification',
    false,
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (organization_id, email) DO UPDATE
  SET
    user_id = EXCLUDED.user_id,
    role = EXCLUDED.role,
    account_state = EXCLUDED.account_state,
    is_email_verified = EXCLUDED.is_email_verified,
    is_active = EXCLUDED.is_active,
    updated_at = NOW()
  RETURNING id INTO v_membership_id;

  RETURN v_membership_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_employee_invitation_signup(
  p_user_id uuid,
  p_token text,
  p_employee_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_invitation public.employee_invitations%ROWTYPE;
  v_user_email text;
  v_membership_id uuid;
BEGIN
  IF p_user_id IS NULL OR coalesce(trim(p_token), '') = '' THEN
    RAISE EXCEPTION 'Missing employee invitation details';
  END IF;

  SELECT *
  INTO v_invitation
  FROM public.employee_invitations
  WHERE token_hash = public.hash_invitation_token(trim(p_token))
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid invitation token';
  END IF;

  IF v_invitation.status <> 'pending' THEN
    RAISE EXCEPTION 'Invitation is no longer valid';
  END IF;

  IF v_invitation.expires_at <= NOW() THEN
    UPDATE public.employee_invitations
    SET
      status = 'expired',
      updated_at = NOW()
    WHERE id = v_invitation.id;

    RAISE EXCEPTION 'Invitation has expired';
  END IF;

  SELECT lower(u.email)
  INTO v_user_email
  FROM auth.users u
  WHERE u.id = p_user_id;

  IF coalesce(v_user_email, '') = '' THEN
    RAISE EXCEPTION 'User account not found';
  END IF;

  IF v_user_email <> lower(v_invitation.invited_email) THEN
    RAISE EXCEPTION 'Invitation email does not match account email';
  END IF;

  INSERT INTO public.organization_memberships (
    organization_id,
    user_id,
    email,
    role,
    employee_role_id,
    employee_id,
    invited_by_user_id,
    account_state,
    is_email_verified,
    is_active,
    created_at,
    updated_at
  ) VALUES (
    v_invitation.organization_id,
    p_user_id,
    v_user_email,
    v_invitation.role,
    v_invitation.employee_role_id,
    nullif(trim(coalesce(p_employee_id, '')), ''),
    v_invitation.invited_by_user_id,
    'pending_verification',
    false,
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (organization_id, email) DO UPDATE
  SET
    user_id = EXCLUDED.user_id,
    role = EXCLUDED.role,
    employee_role_id = EXCLUDED.employee_role_id,
    employee_id = coalesce(EXCLUDED.employee_id, organization_memberships.employee_id),
    invited_by_user_id = EXCLUDED.invited_by_user_id,
    account_state = EXCLUDED.account_state,
    is_email_verified = EXCLUDED.is_email_verified,
    is_active = EXCLUDED.is_active,
    updated_at = NOW()
  RETURNING id INTO v_membership_id;

  UPDATE public.employee_invitations
  SET
    status = 'accepted',
    accepted_at = coalesce(accepted_at, NOW()),
    updated_at = NOW()
  WHERE id = v_invitation.id;

  RETURN v_membership_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_client_invitation_signup(
  p_user_id uuid,
  p_token text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_invitation public.client_invitations%ROWTYPE;
  v_user_email text;
  v_membership_id uuid;
BEGIN
  IF p_user_id IS NULL OR coalesce(trim(p_token), '') = '' THEN
    RAISE EXCEPTION 'Missing client invitation details';
  END IF;

  SELECT *
  INTO v_invitation
  FROM public.client_invitations
  WHERE token_hash = public.hash_invitation_token(trim(p_token))
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid invitation token';
  END IF;

  IF v_invitation.status <> 'pending' THEN
    RAISE EXCEPTION 'Invitation is no longer valid';
  END IF;

  IF v_invitation.expires_at <= NOW() THEN
    UPDATE public.client_invitations
    SET
      status = 'expired',
      updated_at = NOW()
    WHERE id = v_invitation.id;

    RAISE EXCEPTION 'Invitation has expired';
  END IF;

  SELECT lower(u.email)
  INTO v_user_email
  FROM auth.users u
  WHERE u.id = p_user_id;

  IF coalesce(v_user_email, '') = '' THEN
    RAISE EXCEPTION 'User account not found';
  END IF;

  IF v_user_email <> lower(v_invitation.invited_email) THEN
    RAISE EXCEPTION 'Invitation email does not match account email';
  END IF;

  INSERT INTO public.organization_memberships (
    organization_id,
    user_id,
    email,
    role,
    invited_by_user_id,
    account_state,
    is_email_verified,
    is_active,
    created_at,
    updated_at
  ) VALUES (
    v_invitation.organization_id,
    p_user_id,
    v_user_email,
    'client',
    v_invitation.invited_by_user_id,
    'pending_verification',
    false,
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (organization_id, email) DO UPDATE
  SET
    user_id = EXCLUDED.user_id,
    role = EXCLUDED.role,
    invited_by_user_id = EXCLUDED.invited_by_user_id,
    account_state = EXCLUDED.account_state,
    is_email_verified = EXCLUDED.is_email_verified,
    is_active = EXCLUDED.is_active,
    updated_at = NOW()
  RETURNING id INTO v_membership_id;

  UPDATE public.client_invitations
  SET
    status = 'accepted',
    accepted_at = coalesce(accepted_at, NOW()),
    updated_at = NOW()
  WHERE id = v_invitation.id;

  RETURN v_membership_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_employee_invitation_details(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_employee_invitation_details(text) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_client_invitation_details(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_client_invitation_details(text) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.create_client_signup_membership(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_client_signup_membership(uuid, uuid) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.accept_employee_invitation_signup(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_employee_invitation_signup(uuid, text, text) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.accept_client_invitation_signup(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_client_invitation_signup(uuid, text) TO anon, authenticated, service_role;
