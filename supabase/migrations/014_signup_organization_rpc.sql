-- SECURITY DEFINER RPC that creates the full organization signup bundle:
-- organization row, subscription, and owner membership.
-- Bypasses RLS because auth.uid() is NULL before email confirmation.

SET search_path = public, extensions;

CREATE OR REPLACE FUNCTION public.create_signup_organization(
  p_user_id       uuid,
  p_email         text,
  p_org_name      text,
  p_org_slug      text,
  p_org_code      text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id   uuid;
  v_slug     text := p_org_slug;
  v_code     text := p_org_code;
  v_attempt  integer := 0;
  v_inserted boolean := false;
BEGIN
  -- Try inserting with slug/code collision retry (up to 10 attempts)
  WHILE v_attempt < 10 AND NOT v_inserted LOOP
    BEGIN
      INSERT INTO public.organizations (
        name, slug, org_code, owner_user_id, status, plan_type, created_at, updated_at
      ) VALUES (
        p_org_name, v_slug, v_code, p_user_id, 'trial', 'foundation', NOW(), NOW()
      )
      RETURNING id INTO v_org_id;

      v_inserted := true;
    EXCEPTION WHEN unique_violation THEN
      v_attempt := v_attempt + 1;
      v_slug := p_org_slug || '-' || floor(100 + random() * 900)::text;
      v_code := left(p_org_code, 8) || floor(10 + random() * 89)::text;
    END;
  END LOOP;

  IF NOT v_inserted THEN
    RAISE EXCEPTION 'Unable to create organization after % attempts', v_attempt;
  END IF;

  -- Create starter subscription
  INSERT INTO public.organization_subscriptions (
    organization_id, plan_type, status,
    module_crm, module_cpq, module_documents, module_clm, module_erp,
    created_at, updated_at
  ) VALUES (
    v_org_id, 'foundation', 'trial',
    true, true, true, false, false,
    NOW(), NOW()
  );

  -- Create owner membership
  INSERT INTO public.organization_memberships (
    organization_id, user_id, email, role, account_state,
    is_email_verified, is_active, created_at, updated_at
  ) VALUES (
    v_org_id, p_user_id, p_email, 'owner', 'pending_verification',
    false, true, NOW(), NOW()
  );

  RETURN jsonb_build_object('id', v_org_id, 'slug', v_slug);
END;
$$;

REVOKE ALL ON FUNCTION public.create_signup_organization(uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_signup_organization(uuid, text, text, text, text) TO anon, authenticated, service_role;
