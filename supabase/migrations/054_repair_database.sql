-- Public-safe organization lookup for signup flows.
-- Exposes only minimal identity fields and only eligible organizations.

CREATE OR REPLACE FUNCTION public.search_signup_organizations(
  p_query text,
  p_limit integer DEFAULT 8
)
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  org_code text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_query text := trim(coalesce(p_query, ''));
  v_limit integer := greatest(1, least(coalesce(p_limit, 8), 20));
BEGIN
  IF length(v_query) < 2 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    o.id,
    o.name,
    o.slug,
    o.org_code
  FROM public.organizations o
  WHERE
    o.status IN ('active', 'trial')
    AND (
      o.name ILIKE '%' || v_query || '%'
      OR o.slug ILIKE v_query || '%'
      OR o.org_code ILIKE v_query || '%'
    )
  ORDER BY
    CASE
      WHEN lower(o.name) = lower(v_query) THEN 0
      WHEN lower(o.slug) = lower(v_query) THEN 1
      WHEN upper(o.org_code) = upper(v_query) THEN 2
      WHEN o.name ILIKE v_query || '%' THEN 3
      ELSE 4
    END,
    o.name ASC
  LIMIT v_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.find_signup_organization(
  p_slug_or_code text
)
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  org_code text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.id,
    o.name,
    o.slug,
    o.org_code
  FROM public.organizations o
  WHERE
    o.status IN ('active', 'trial')
    AND (
      lower(o.slug) = lower(trim(coalesce(p_slug_or_code, '')))
      OR upper(o.org_code) = upper(trim(coalesce(p_slug_or_code, '')))
    )
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.search_signup_organizations(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.find_signup_organization(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.search_signup_organizations(text, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.find_signup_organization(text) TO anon, authenticated, service_role;


-- Signup and owner-management RLS fixes for org-native auth flows.

SET search_path = public, extensions;

-- ============================================================================
-- PROFILES
-- ============================================================================

DROP POLICY IF EXISTS profiles_insert_self ON public.profiles;
CREATE POLICY profiles_insert_self ON public.profiles
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  OR public.app_is_platform_super_admin(auth.uid())
);

DROP POLICY IF EXISTS profiles_update_self ON public.profiles;
CREATE POLICY profiles_update_self ON public.profiles
FOR UPDATE
USING (
  auth.uid() = user_id
  OR public.app_is_platform_super_admin(auth.uid())
)
WITH CHECK (
  auth.uid() = user_id
  OR public.app_is_platform_super_admin(auth.uid())
);

-- ============================================================================
-- ORGANIZATIONS
-- ============================================================================

DROP POLICY IF EXISTS organizations_insert_owner_signup ON public.organizations;
CREATE POLICY organizations_insert_owner_signup ON public.organizations
FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated'
  AND owner_user_id = auth.uid()
);

DROP POLICY IF EXISTS organizations_update_owner_admin ON public.organizations;
CREATE POLICY organizations_update_owner_admin ON public.organizations
FOR UPDATE
USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.organization_id = organizations.id
      AND om.user_id = auth.uid()
      AND om.is_active = true
      AND om.account_state IN ('active', 'pending_verification')
      AND om.role IN ('owner', 'admin')
  )
)
WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.organization_id = organizations.id
      AND om.user_id = auth.uid()
      AND om.is_active = true
      AND om.account_state IN ('active', 'pending_verification')
      AND om.role IN ('owner', 'admin')
  )
);

-- ============================================================================
-- ORGANIZATION SUBSCRIPTIONS
-- ============================================================================

DROP POLICY IF EXISTS subs_insert_owner_signup ON public.organization_subscriptions;
CREATE POLICY subs_insert_owner_signup ON public.organization_subscriptions
FOR INSERT
WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.organizations o
    WHERE o.id = organization_subscriptions.organization_id
      AND o.owner_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS subs_update_owner_admin ON public.organization_subscriptions;
CREATE POLICY subs_update_owner_admin ON public.organization_subscriptions
FOR UPDATE
USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.organization_id = organization_subscriptions.organization_id
      AND om.user_id = auth.uid()
      AND om.is_active = true
      AND om.account_state IN ('active', 'pending_verification')
      AND om.role IN ('owner', 'admin')
  )
)
WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.organization_id = organization_subscriptions.organization_id
      AND om.user_id = auth.uid()
      AND om.is_active = true
      AND om.account_state IN ('active', 'pending_verification')
      AND om.role IN ('owner', 'admin')
  )
);

-- ============================================================================
-- ORGANIZATION MEMBERSHIPS
-- ============================================================================

DROP POLICY IF EXISTS memberships_insert_signup_paths ON public.organization_memberships;
CREATE POLICY memberships_insert_signup_paths ON public.organization_memberships
FOR INSERT
WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR (
    user_id = auth.uid()
    AND lower(email) = lower(coalesce(auth.jwt() ->> 'email', email))
    AND (
      (
        role = 'owner'
        AND account_state = 'pending_verification'
        AND is_active = true
        AND EXISTS (
          SELECT 1
          FROM public.organizations o
          WHERE o.id = organization_memberships.organization_id
            AND o.owner_user_id = auth.uid()
        )
      )
      OR (
        role = 'client'
        AND account_state = 'pending_approval'
        AND is_active = true
        AND EXISTS (
          SELECT 1
          FROM public.organizations o
          WHERE o.id = organization_memberships.organization_id
            AND o.status IN ('active', 'trial')
        )
      )
      OR (
        role IN ('admin', 'manager', 'employee')
        AND account_state = 'pending_verification'
        AND is_active = true
        AND EXISTS (
          SELECT 1
          FROM public.employee_invitations ei
          WHERE ei.organization_id = organization_memberships.organization_id
            AND lower(ei.invited_email) = lower(organization_memberships.email)
            AND ei.role = organization_memberships.role
            AND ei.status = 'pending'
            AND ei.expires_at > NOW()
        )
      )
      OR (
        role = 'client'
        AND account_state = 'pending_verification'
        AND is_active = true
        AND EXISTS (
          SELECT 1
          FROM public.client_invitations ci
          WHERE ci.organization_id = organization_memberships.organization_id
            AND lower(ci.invited_email) = lower(organization_memberships.email)
            AND ci.status = 'pending'
            AND ci.expires_at > NOW()
        )
      )
    )
  )
);

DROP POLICY IF EXISTS memberships_update_owner_admin ON public.organization_memberships;
CREATE POLICY memberships_update_owner_admin ON public.organization_memberships
FOR UPDATE
USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.organization_id = organization_memberships.organization_id
      AND om.user_id = auth.uid()
      AND om.is_active = true
      AND om.account_state IN ('active', 'pending_verification')
      AND om.role IN ('owner', 'admin')
  )
)
WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.organization_id = organization_memberships.organization_id
      AND om.user_id = auth.uid()
      AND om.is_active = true
      AND om.account_state IN ('active', 'pending_verification')
      AND om.role IN ('owner', 'admin')
  )
);

-- ============================================================================
-- INVITATION MUTATION POLICY RELAXATION
-- ============================================================================

DROP POLICY IF EXISTS employee_invites_mutate ON public.employee_invitations;
CREATE POLICY employee_invites_mutate ON public.employee_invitations
FOR ALL
USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = employee_invitations.organization_id
      AND om.is_active = true
      AND om.account_state IN ('active', 'pending_verification')
      AND om.role IN ('owner', 'admin')
  )
)
WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = employee_invitations.organization_id
      AND om.is_active = true
      AND om.account_state IN ('active', 'pending_verification')
      AND om.role IN ('owner', 'admin')
  )
);

DROP POLICY IF EXISTS client_invites_mutate ON public.client_invitations;
CREATE POLICY client_invites_mutate ON public.client_invitations
FOR ALL
USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = client_invitations.organization_id
      AND om.is_active = true
      AND om.account_state IN ('active', 'pending_verification')
      AND om.role IN ('owner', 'admin')
  )
)
WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = client_invitations.organization_id
      AND om.is_active = true
      AND om.account_state IN ('active', 'pending_verification')
      AND om.role IN ('owner', 'admin')
  )
);

-- Restore Supabase public-schema grants after full schema reset.
-- RLS policies remain the primary access control.

SET search_path = public, extensions;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
GRANT ALL ON TABLES TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

-- Allow newly created owners to read their organization row before membership insert.

SET search_path = public, extensions;

DROP POLICY IF EXISTS organizations_select ON public.organizations;
CREATE POLICY organizations_select ON public.organizations
FOR SELECT
USING (
  public.app_is_platform_super_admin(auth.uid())
  OR owner_user_id = auth.uid()
  OR public.app_user_has_organization_access(id)
);

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


-- SECURITY DEFINER RPC to create/update a profile during signup.
-- Bypasses RLS because auth.uid() is not yet available for newly signed-up
-- users whose email has not been confirmed.

SET search_path = public, extensions;

CREATE OR REPLACE FUNCTION public.create_signup_profile(
  p_user_id uuid,
  p_full_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_first text;
  v_last  text;
  v_parts text[];
BEGIN
  -- Split full name into first / last
  v_parts := string_to_array(btrim(p_full_name), ' ');
  v_first := coalesce(v_parts[1], '');
  v_last  := coalesce(array_to_string(v_parts[2:], ' '), '');

  INSERT INTO public.profiles (user_id, first_name, last_name, full_name, created_at, updated_at)
  VALUES (p_user_id, v_first, v_last, btrim(p_full_name), NOW(), NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name  = EXCLUDED.last_name,
    full_name  = EXCLUDED.full_name,
    updated_at = NOW();
END;
$$;

-- Allow both anon (pre-confirmation signup) and authenticated callers.
REVOKE ALL ON FUNCTION public.create_signup_profile(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_signup_profile(uuid, text) TO anon, authenticated, service_role;

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

-- =============================================================================
-- 015 HARDENED RLS POLICIES
-- =============================================================================
-- Clean-slate policy rebuild: drops every existing RLS policy on public tables
-- then re-creates per-operation policies following least-privilege principles.
--
-- Principles:
--   1. Every table gets explicit SELECT / INSERT / UPDATE / DELETE policies
--   2. No FOR ALL on business data
--   3. Role-based write control (owner/admin > manager > employee/client)
--   4. platform_super_admin is god mode everywhere
--   5. anon can only reach specific SECURITY DEFINER RPCs

SET search_path = public, extensions;

-- =============================================================================
-- 0. TIGHTEN TABLE-LEVEL GRANTS  (fixes 010_restore_public_grants)
-- =============================================================================
-- Revoke the dangerous blanket grant to anon.
-- Keep authenticated + service_role grants; RLS is the real control.

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;

-- anon still needs USAGE on schema + EXECUTE on specific RPCs (already granted).
GRANT USAGE ON SCHEMA public TO anon;

-- Ensure authenticated / service_role keep their access.
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
GRANT ALL ON TABLES TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
GRANT ALL ON SEQUENCES TO authenticated, service_role;

-- =============================================================================
-- 1. DROP ALL EXISTING POLICIES (clean slate)
-- =============================================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
                   r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- =============================================================================
-- 2. ENSURE RLS IS ENABLED ON EVERY TABLE
-- =============================================================================

DO $$
DECLARE
  t text;
  all_tables text[] := ARRAY[
    'profiles', 'platform_super_admins',
    'organizations', 'organization_subscriptions',
    'employee_roles', 'organization_memberships',
    'employee_invitations', 'client_invitations',
    'audit_logs', 'impersonation_sessions', 'background_jobs',
    -- Business data (with organization_id)
    'accounts', 'contacts', 'leads', 'opportunities', 'activities',
    'products', 'quotes', 'contract_templates', 'contracts',
    'suppliers', 'inventory_items', 'inventory_transactions',
    'purchase_orders', 'production_orders', 'financial_records',
    'document_templates', 'auto_documents',
    -- Child tables (no direct organization_id)
    'quote_line_items', 'contract_versions', 'contract_esignatures',
    'contract_scans', 'purchase_order_items', 'production_order_items',
    'document_versions', 'document_signatures', 'document_permissions',
    'document_esignatures'
  ];
BEGIN
  FOREACH t IN ARRAY all_tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      -- NOTE: We intentionally do NOT use FORCE ROW LEVEL SECURITY here.
      -- FORCE would make even the postgres superuser subject to RLS, which
      -- breaks SECURITY DEFINER RPCs (create_signup_organization, etc.)
      -- that need to bypass RLS for pre-confirmation signup flows.
    END IF;
  END LOOP;
END $$;

-- =============================================================================
-- 3. CORE AUTH / ORG TABLE POLICIES
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 3a. profiles
-- ---------------------------------------------------------------------------

CREATE POLICY profiles_select ON public.profiles
FOR SELECT USING (
  auth.uid() = user_id
  OR public.app_is_platform_super_admin(auth.uid())
);

CREATE POLICY profiles_insert ON public.profiles
FOR INSERT WITH CHECK (
  auth.uid() = user_id
  OR public.app_is_platform_super_admin(auth.uid())
);

CREATE POLICY profiles_update ON public.profiles
FOR UPDATE USING (
  auth.uid() = user_id
  OR public.app_is_platform_super_admin(auth.uid())
) WITH CHECK (
  auth.uid() = user_id
  OR public.app_is_platform_super_admin(auth.uid())
);

CREATE POLICY profiles_delete ON public.profiles
FOR DELETE USING (
  auth.uid() = user_id
  OR public.app_is_platform_super_admin(auth.uid())
);

-- ---------------------------------------------------------------------------
-- 3b. platform_super_admins  (super-admin-only CRUD)
-- ---------------------------------------------------------------------------

CREATE POLICY psa_select ON public.platform_super_admins
FOR SELECT USING (public.app_is_platform_super_admin(auth.uid()));

CREATE POLICY psa_insert ON public.platform_super_admins
FOR INSERT WITH CHECK (public.app_is_platform_super_admin(auth.uid()));

CREATE POLICY psa_update ON public.platform_super_admins
FOR UPDATE
USING (public.app_is_platform_super_admin(auth.uid()))
WITH CHECK (public.app_is_platform_super_admin(auth.uid()));

CREATE POLICY psa_delete ON public.platform_super_admins
FOR DELETE USING (public.app_is_platform_super_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- 3c. organizations
-- ---------------------------------------------------------------------------

-- SELECT: owner, members with access, or super admin
CREATE POLICY organizations_select ON public.organizations
FOR SELECT USING (
  public.app_is_platform_super_admin(auth.uid())
  OR owner_user_id = auth.uid()
  OR public.app_user_has_organization_access(id)
);

-- INSERT: authenticated user creating an org they own, or super admin
CREATE POLICY organizations_insert ON public.organizations
FOR INSERT WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR (
    auth.role() = 'authenticated'
    AND owner_user_id = auth.uid()
  )
);

-- UPDATE: owner or admin members, or super admin
CREATE POLICY organizations_update ON public.organizations
FOR UPDATE USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.organization_memberships om
    WHERE om.organization_id = organizations.id
      AND om.user_id = auth.uid()
      AND om.is_active = true
      AND om.account_state IN ('active', 'pending_verification')
      AND om.role IN ('owner', 'admin')
  )
) WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.organization_memberships om
    WHERE om.organization_id = organizations.id
      AND om.user_id = auth.uid()
      AND om.is_active = true
      AND om.account_state IN ('active', 'pending_verification')
      AND om.role IN ('owner', 'admin')
  )
);

-- DELETE: super admin only
CREATE POLICY organizations_delete ON public.organizations
FOR DELETE USING (
  public.app_is_platform_super_admin(auth.uid())
);

-- ---------------------------------------------------------------------------
-- 3d. organization_subscriptions
-- ---------------------------------------------------------------------------

CREATE POLICY org_subs_select ON public.organization_subscriptions
FOR SELECT USING (
  public.app_is_platform_super_admin(auth.uid())
  OR public.app_user_has_organization_access(organization_id)
);

-- INSERT: org owner or super admin
CREATE POLICY org_subs_insert ON public.organization_subscriptions
FOR INSERT WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = organization_subscriptions.organization_id
      AND o.owner_user_id = auth.uid()
  )
);

-- UPDATE: owner/admin or super admin
CREATE POLICY org_subs_update ON public.organization_subscriptions
FOR UPDATE USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.organization_memberships om
    WHERE om.organization_id = organization_subscriptions.organization_id
      AND om.user_id = auth.uid()
      AND om.is_active = true
      AND om.account_state IN ('active', 'pending_verification')
      AND om.role IN ('owner', 'admin')
  )
) WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.organization_memberships om
    WHERE om.organization_id = organization_subscriptions.organization_id
      AND om.user_id = auth.uid()
      AND om.is_active = true
      AND om.account_state IN ('active', 'pending_verification')
      AND om.role IN ('owner', 'admin')
  )
);

-- DELETE: super admin only
CREATE POLICY org_subs_delete ON public.organization_subscriptions
FOR DELETE USING (
  public.app_is_platform_super_admin(auth.uid())
);

-- ---------------------------------------------------------------------------
-- 3e. employee_roles
-- ---------------------------------------------------------------------------

CREATE POLICY employee_roles_select ON public.employee_roles
FOR SELECT USING (
  public.app_is_platform_super_admin(auth.uid())
  OR public.app_user_has_organization_access(organization_id)
);

CREATE POLICY employee_roles_insert ON public.employee_roles
FOR INSERT WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.organization_memberships om
    WHERE om.organization_id = employee_roles.organization_id
      AND om.user_id = auth.uid()
      AND om.is_active = true
      AND om.account_state IN ('active', 'pending_verification')
      AND om.role IN ('owner', 'admin')
  )
);

CREATE POLICY employee_roles_update ON public.employee_roles
FOR UPDATE USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.organization_memberships om
    WHERE om.organization_id = employee_roles.organization_id
      AND om.user_id = auth.uid()
      AND om.is_active = true
      AND om.account_state IN ('active', 'pending_verification')
      AND om.role IN ('owner', 'admin')
  )
) WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.organization_memberships om
    WHERE om.organization_id = employee_roles.organization_id
      AND om.user_id = auth.uid()
      AND om.is_active = true
      AND om.account_state IN ('active', 'pending_verification')
      AND om.role IN ('owner', 'admin')
  )
);

CREATE POLICY employee_roles_delete ON public.employee_roles
FOR DELETE USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.organization_memberships om
    WHERE om.organization_id = employee_roles.organization_id
      AND om.user_id = auth.uid()
      AND om.is_active = true
      AND om.account_state IN ('active', 'pending_verification')
      AND om.role IN ('owner', 'admin')
  )
);

-- ---------------------------------------------------------------------------
-- 3f. organization_memberships
-- ---------------------------------------------------------------------------

-- SELECT: own row, org members, or super admin
CREATE POLICY memberships_select ON public.organization_memberships
FOR SELECT USING (
  auth.uid() = user_id
  OR public.app_is_platform_super_admin(auth.uid())
  OR public.app_user_has_organization_access(organization_id)
);

-- INSERT: preserves all the signup-path logic from 009
CREATE POLICY memberships_insert ON public.organization_memberships
FOR INSERT WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR (
    user_id = auth.uid()
    AND lower(email) = lower(coalesce(auth.jwt() ->> 'email', email))
    AND (
      -- Owner creating their own membership during org signup
      (
        role = 'owner'
        AND account_state = 'pending_verification'
        AND is_active = true
        AND EXISTS (
          SELECT 1 FROM public.organizations o
          WHERE o.id = organization_memberships.organization_id
            AND o.owner_user_id = auth.uid()
        )
      )
      -- Client self-signup to an active org
      OR (
        role = 'client'
        AND account_state = 'pending_approval'
        AND is_active = true
        AND EXISTS (
          SELECT 1 FROM public.organizations o
          WHERE o.id = organization_memberships.organization_id
            AND o.status IN ('active', 'trial')
        )
      )
      -- Employee accepting an invitation
      OR (
        role IN ('admin', 'manager', 'employee')
        AND account_state = 'pending_verification'
        AND is_active = true
        AND EXISTS (
          SELECT 1 FROM public.employee_invitations ei
          WHERE ei.organization_id = organization_memberships.organization_id
            AND lower(ei.invited_email) = lower(organization_memberships.email)
            AND ei.role = organization_memberships.role
            AND ei.status = 'pending'
            AND ei.expires_at > NOW()
        )
      )
      -- Client accepting an invitation
      OR (
        role = 'client'
        AND account_state = 'pending_verification'
        AND is_active = true
        AND EXISTS (
          SELECT 1 FROM public.client_invitations ci
          WHERE ci.organization_id = organization_memberships.organization_id
            AND lower(ci.invited_email) = lower(organization_memberships.email)
            AND ci.status = 'pending'
            AND ci.expires_at > NOW()
        )
      )
    )
  )
);

-- UPDATE: owner/admin of the org, or super admin
CREATE POLICY memberships_update ON public.organization_memberships
FOR UPDATE USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.organization_memberships om
    WHERE om.organization_id = organization_memberships.organization_id
      AND om.user_id = auth.uid()
      AND om.is_active = true
      AND om.account_state IN ('active', 'pending_verification')
      AND om.role IN ('owner', 'admin')
  )
) WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.organization_memberships om
    WHERE om.organization_id = organization_memberships.organization_id
      AND om.user_id = auth.uid()
      AND om.is_active = true
      AND om.account_state IN ('active', 'pending_verification')
      AND om.role IN ('owner', 'admin')
  )
);

-- DELETE: owner/admin of the org, or super admin
CREATE POLICY memberships_delete ON public.organization_memberships
FOR DELETE USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.organization_memberships om
    WHERE om.organization_id = organization_memberships.organization_id
      AND om.user_id = auth.uid()
      AND om.is_active = true
      AND om.account_state IN ('active', 'pending_verification')
      AND om.role IN ('owner', 'admin')
  )
);

-- ---------------------------------------------------------------------------
-- 3g. employee_invitations
-- ---------------------------------------------------------------------------

CREATE POLICY emp_invites_select ON public.employee_invitations
FOR SELECT USING (
  public.app_is_platform_super_admin(auth.uid())
  OR public.app_user_has_organization_access(organization_id)
);

CREATE POLICY emp_invites_insert ON public.employee_invitations
FOR INSERT WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.organization_memberships om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = employee_invitations.organization_id
      AND om.is_active = true
      AND om.account_state IN ('active', 'pending_verification')
      AND om.role IN ('owner', 'admin')
  )
);

CREATE POLICY emp_invites_update ON public.employee_invitations
FOR UPDATE USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.organization_memberships om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = employee_invitations.organization_id
      AND om.is_active = true
      AND om.account_state IN ('active', 'pending_verification')
      AND om.role IN ('owner', 'admin')
  )
) WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.organization_memberships om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = employee_invitations.organization_id
      AND om.is_active = true
      AND om.account_state IN ('active', 'pending_verification')
      AND om.role IN ('owner', 'admin')
  )
);

CREATE POLICY emp_invites_delete ON public.employee_invitations
FOR DELETE USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.organization_memberships om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = employee_invitations.organization_id
      AND om.is_active = true
      AND om.account_state IN ('active', 'pending_verification')
      AND om.role IN ('owner', 'admin')
  )
);

-- ---------------------------------------------------------------------------
-- 3h. client_invitations
-- ---------------------------------------------------------------------------

CREATE POLICY client_invites_select ON public.client_invitations
FOR SELECT USING (
  public.app_is_platform_super_admin(auth.uid())
  OR public.app_user_has_organization_access(organization_id)
);

CREATE POLICY client_invites_insert ON public.client_invitations
FOR INSERT WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.organization_memberships om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = client_invitations.organization_id
      AND om.is_active = true
      AND om.account_state IN ('active', 'pending_verification')
      AND om.role IN ('owner', 'admin')
  )
);

CREATE POLICY client_invites_update ON public.client_invitations
FOR UPDATE USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.organization_memberships om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = client_invitations.organization_id
      AND om.is_active = true
      AND om.account_state IN ('active', 'pending_verification')
      AND om.role IN ('owner', 'admin')
  )
) WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.organization_memberships om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = client_invitations.organization_id
      AND om.is_active = true
      AND om.account_state IN ('active', 'pending_verification')
      AND om.role IN ('owner', 'admin')
  )
);

CREATE POLICY client_invites_delete ON public.client_invitations
FOR DELETE USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.organization_memberships om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = client_invitations.organization_id
      AND om.is_active = true
      AND om.account_state IN ('active', 'pending_verification')
      AND om.role IN ('owner', 'admin')
  )
);

-- ---------------------------------------------------------------------------
-- 3i. audit_logs  (append-only for users, full access for super admin)
-- ---------------------------------------------------------------------------

CREATE POLICY audit_logs_select ON public.audit_logs
FOR SELECT USING (
  public.app_is_platform_super_admin(auth.uid())
  OR (organization_id IS NOT NULL AND public.app_user_has_organization_access(organization_id))
);

-- INSERT: authenticated only, must set user_id to self (no spoofing)
CREATE POLICY audit_logs_insert ON public.audit_logs
FOR INSERT WITH CHECK (
  auth.role() = 'authenticated'
  AND (
    user_id = auth.uid()
    OR public.app_is_platform_super_admin(auth.uid())
  )
);

-- No UPDATE policy â€” audit logs are immutable
-- No DELETE policy â€” audit logs are immutable
-- (Super admin can still bypass via service_role if absolutely needed)

-- ---------------------------------------------------------------------------
-- 3j. impersonation_sessions  (super-admin-only)
-- ---------------------------------------------------------------------------

CREATE POLICY impersonation_select ON public.impersonation_sessions
FOR SELECT USING (public.app_is_platform_super_admin(auth.uid()));

CREATE POLICY impersonation_insert ON public.impersonation_sessions
FOR INSERT WITH CHECK (public.app_is_platform_super_admin(auth.uid()));

CREATE POLICY impersonation_update ON public.impersonation_sessions
FOR UPDATE
USING (public.app_is_platform_super_admin(auth.uid()))
WITH CHECK (public.app_is_platform_super_admin(auth.uid()));

CREATE POLICY impersonation_delete ON public.impersonation_sessions
FOR DELETE USING (public.app_is_platform_super_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- 3k. background_jobs
-- ---------------------------------------------------------------------------

CREATE POLICY bg_jobs_select ON public.background_jobs
FOR SELECT USING (
  public.app_is_platform_super_admin(auth.uid())
  OR public.app_user_has_organization_access(organization_id)
);

CREATE POLICY bg_jobs_insert ON public.background_jobs
FOR INSERT WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR public.app_user_has_organization_access(organization_id)
);

CREATE POLICY bg_jobs_update ON public.background_jobs
FOR UPDATE USING (
  public.app_is_platform_super_admin(auth.uid())
  OR public.app_user_has_organization_access(organization_id)
) WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR public.app_user_has_organization_access(organization_id)
);

-- DELETE: super admin only
CREATE POLICY bg_jobs_delete ON public.background_jobs
FOR DELETE USING (
  public.app_is_platform_super_admin(auth.uid())
);

-- =============================================================================
-- 4. BUSINESS DATA TABLES  (17 tables with organization_id / tenant_id)
-- =============================================================================
-- Role hierarchy for writes:
--   SELECT  : any active org member
--   INSERT  : owner, admin, manager
--   UPDATE  : owner, admin, manager
--   DELETE  : owner, admin only

-- Helper: reusable org membership check function for write operations
CREATE OR REPLACE FUNCTION public._rls_user_can_write_org(
  p_org_id uuid,
  p_min_roles public.app_role[] DEFAULT ARRAY['owner','admin','manager']::public.app_role[]
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    public.app_is_platform_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.organization_memberships om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = p_org_id
        AND om.is_active = true
        AND om.account_state IN ('active', 'pending_verification')
        AND om.role = ANY(p_min_roles)
    );
$$;

DO $$
DECLARE
  t text;
  biz_tables text[] := ARRAY[
    'accounts','contacts','leads','opportunities','activities',
    'products','quotes','contract_templates','contracts',
    'suppliers','inventory_items','inventory_transactions',
    'purchase_orders','production_orders','financial_records',
    'document_templates','auto_documents'
  ];
BEGIN
  FOREACH t IN ARRAY biz_tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      CONTINUE;
    END IF;

    -- SELECT: any org member or super admin
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT USING (
        public.app_is_platform_super_admin(auth.uid())
        OR public.app_user_has_organization_access(COALESCE(organization_id, tenant_id))
      )',
      t || '_select', t
    );

    -- INSERT: owner, admin, manager or super admin
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (
        public._rls_user_can_write_org(
          COALESCE(organization_id, tenant_id),
          ARRAY[''owner'',''admin'',''manager'']::public.app_role[]
        )
      )',
      t || '_insert', t
    );

    -- UPDATE: owner, admin, manager or super admin
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE
        USING (
          public._rls_user_can_write_org(
            COALESCE(organization_id, tenant_id),
            ARRAY[''owner'',''admin'',''manager'']::public.app_role[]
          )
        )
        WITH CHECK (
          public._rls_user_can_write_org(
            COALESCE(organization_id, tenant_id),
            ARRAY[''owner'',''admin'',''manager'']::public.app_role[]
          )
        )',
      t || '_update', t
    );

    -- DELETE: owner, admin only (or super admin)
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE USING (
        public._rls_user_can_write_org(
          COALESCE(organization_id, tenant_id),
          ARRAY[''owner'',''admin'']::public.app_role[]
        )
      )',
      t || '_delete', t
    );
  END LOOP;
END $$;

-- =============================================================================
-- 5. CHILD TABLES  (no direct organization_id â€” join through parent)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 5a. quote_line_items  (via quotes)
-- ---------------------------------------------------------------------------

CREATE POLICY qli_select ON public.quote_line_items
FOR SELECT USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.id = quote_line_items.quote_id
      AND public.app_user_has_organization_access(COALESCE(q.organization_id, q.tenant_id))
  )
);

CREATE POLICY qli_insert ON public.quote_line_items
FOR INSERT WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.id = quote_line_items.quote_id
      AND public._rls_user_can_write_org(
        COALESCE(q.organization_id, q.tenant_id),
        ARRAY['owner','admin','manager']::public.app_role[]
      )
  )
);

CREATE POLICY qli_update ON public.quote_line_items
FOR UPDATE USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.id = quote_line_items.quote_id
      AND public._rls_user_can_write_org(
        COALESCE(q.organization_id, q.tenant_id),
        ARRAY['owner','admin','manager']::public.app_role[]
      )
  )
) WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.id = quote_line_items.quote_id
      AND public._rls_user_can_write_org(
        COALESCE(q.organization_id, q.tenant_id),
        ARRAY['owner','admin','manager']::public.app_role[]
      )
  )
);

CREATE POLICY qli_delete ON public.quote_line_items
FOR DELETE USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.id = quote_line_items.quote_id
      AND public._rls_user_can_write_org(
        COALESCE(q.organization_id, q.tenant_id),
        ARRAY['owner','admin']::public.app_role[]
      )
  )
);

-- ---------------------------------------------------------------------------
-- 5b. contract_versions  (via contracts)
-- ---------------------------------------------------------------------------

CREATE POLICY cv_select ON public.contract_versions
FOR SELECT USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = contract_versions.contract_id
      AND public.app_user_has_organization_access(COALESCE(c.organization_id, c.tenant_id))
  )
);

CREATE POLICY cv_insert ON public.contract_versions
FOR INSERT WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = contract_versions.contract_id
      AND public._rls_user_can_write_org(
        COALESCE(c.organization_id, c.tenant_id),
        ARRAY['owner','admin','manager']::public.app_role[]
      )
  )
);

CREATE POLICY cv_update ON public.contract_versions
FOR UPDATE USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = contract_versions.contract_id
      AND public._rls_user_can_write_org(
        COALESCE(c.organization_id, c.tenant_id),
        ARRAY['owner','admin','manager']::public.app_role[]
      )
  )
) WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = contract_versions.contract_id
      AND public._rls_user_can_write_org(
        COALESCE(c.organization_id, c.tenant_id),
        ARRAY['owner','admin','manager']::public.app_role[]
      )
  )
);

CREATE POLICY cv_delete ON public.contract_versions
FOR DELETE USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = contract_versions.contract_id
      AND public._rls_user_can_write_org(
        COALESCE(c.organization_id, c.tenant_id),
        ARRAY['owner','admin']::public.app_role[]
      )
  )
);

-- ---------------------------------------------------------------------------
-- 5c. contract_esignatures  (via contracts)
-- ---------------------------------------------------------------------------

CREATE POLICY ces_select ON public.contract_esignatures
FOR SELECT USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = contract_esignatures.contract_id
      AND public.app_user_has_organization_access(COALESCE(c.organization_id, c.tenant_id))
  )
);

CREATE POLICY ces_insert ON public.contract_esignatures
FOR INSERT WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = contract_esignatures.contract_id
      AND public._rls_user_can_write_org(
        COALESCE(c.organization_id, c.tenant_id),
        ARRAY['owner','admin','manager']::public.app_role[]
      )
  )
);

CREATE POLICY ces_update ON public.contract_esignatures
FOR UPDATE USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = contract_esignatures.contract_id
      AND public._rls_user_can_write_org(
        COALESCE(c.organization_id, c.tenant_id),
        ARRAY['owner','admin','manager']::public.app_role[]
      )
  )
) WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = contract_esignatures.contract_id
      AND public._rls_user_can_write_org(
        COALESCE(c.organization_id, c.tenant_id),
        ARRAY['owner','admin','manager']::public.app_role[]
      )
  )
);

CREATE POLICY ces_delete ON public.contract_esignatures
FOR DELETE USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = contract_esignatures.contract_id
      AND public._rls_user_can_write_org(
        COALESCE(c.organization_id, c.tenant_id),
        ARRAY['owner','admin']::public.app_role[]
      )
  )
);

-- ---------------------------------------------------------------------------
-- 5d. contract_scans  (via contracts)
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='contract_scans') THEN

    EXECUTE 'CREATE POLICY cs_select ON public.contract_scans
    FOR SELECT USING (
      public.app_is_platform_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.contracts c
        WHERE c.id = contract_scans.contract_id
          AND public.app_user_has_organization_access(COALESCE(c.organization_id, c.tenant_id))
      )
    )';

    EXECUTE 'CREATE POLICY cs_insert ON public.contract_scans
    FOR INSERT WITH CHECK (
      public.app_is_platform_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.contracts c
        WHERE c.id = contract_scans.contract_id
          AND public._rls_user_can_write_org(
            COALESCE(c.organization_id, c.tenant_id),
            ARRAY[''owner'',''admin'',''manager'']::public.app_role[]
          )
      )
    )';

    EXECUTE 'CREATE POLICY cs_update ON public.contract_scans
    FOR UPDATE USING (
      public.app_is_platform_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.contracts c
        WHERE c.id = contract_scans.contract_id
          AND public._rls_user_can_write_org(
            COALESCE(c.organization_id, c.tenant_id),
            ARRAY[''owner'',''admin'',''manager'']::public.app_role[]
          )
      )
    ) WITH CHECK (
      public.app_is_platform_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.contracts c
        WHERE c.id = contract_scans.contract_id
          AND public._rls_user_can_write_org(
            COALESCE(c.organization_id, c.tenant_id),
            ARRAY[''owner'',''admin'',''manager'']::public.app_role[]
          )
      )
    )';

    EXECUTE 'CREATE POLICY cs_delete ON public.contract_scans
    FOR DELETE USING (
      public.app_is_platform_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.contracts c
        WHERE c.id = contract_scans.contract_id
          AND public._rls_user_can_write_org(
            COALESCE(c.organization_id, c.tenant_id),
            ARRAY[''owner'',''admin'']::public.app_role[]
          )
      )
    )';

  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5e. purchase_order_items  (via purchase_orders)
-- ---------------------------------------------------------------------------

CREATE POLICY poi_select ON public.purchase_order_items
FOR SELECT USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_items.purchase_order_id
      AND public.app_user_has_organization_access(COALESCE(po.organization_id, po.tenant_id))
  )
);

CREATE POLICY poi_insert ON public.purchase_order_items
FOR INSERT WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_items.purchase_order_id
      AND public._rls_user_can_write_org(
        COALESCE(po.organization_id, po.tenant_id),
        ARRAY['owner','admin','manager']::public.app_role[]
      )
  )
);

CREATE POLICY poi_update ON public.purchase_order_items
FOR UPDATE USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_items.purchase_order_id
      AND public._rls_user_can_write_org(
        COALESCE(po.organization_id, po.tenant_id),
        ARRAY['owner','admin','manager']::public.app_role[]
      )
  )
) WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_items.purchase_order_id
      AND public._rls_user_can_write_org(
        COALESCE(po.organization_id, po.tenant_id),
        ARRAY['owner','admin','manager']::public.app_role[]
      )
  )
);

CREATE POLICY poi_delete ON public.purchase_order_items
FOR DELETE USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_items.purchase_order_id
      AND public._rls_user_can_write_org(
        COALESCE(po.organization_id, po.tenant_id),
        ARRAY['owner','admin']::public.app_role[]
      )
  )
);

-- ---------------------------------------------------------------------------
-- 5f. production_order_items  (via production_orders)
-- ---------------------------------------------------------------------------

CREATE POLICY proi_select ON public.production_order_items
FOR SELECT USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.production_orders po
    WHERE po.id = production_order_items.production_order_id
      AND public.app_user_has_organization_access(COALESCE(po.organization_id, po.tenant_id))
  )
);

CREATE POLICY proi_insert ON public.production_order_items
FOR INSERT WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.production_orders po
    WHERE po.id = production_order_items.production_order_id
      AND public._rls_user_can_write_org(
        COALESCE(po.organization_id, po.tenant_id),
        ARRAY['owner','admin','manager']::public.app_role[]
      )
  )
);

CREATE POLICY proi_update ON public.production_order_items
FOR UPDATE USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.production_orders po
    WHERE po.id = production_order_items.production_order_id
      AND public._rls_user_can_write_org(
        COALESCE(po.organization_id, po.tenant_id),
        ARRAY['owner','admin','manager']::public.app_role[]
      )
  )
) WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.production_orders po
    WHERE po.id = production_order_items.production_order_id
      AND public._rls_user_can_write_org(
        COALESCE(po.organization_id, po.tenant_id),
        ARRAY['owner','admin','manager']::public.app_role[]
      )
  )
);

CREATE POLICY proi_delete ON public.production_order_items
FOR DELETE USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.production_orders po
    WHERE po.id = production_order_items.production_order_id
      AND public._rls_user_can_write_org(
        COALESCE(po.organization_id, po.tenant_id),
        ARRAY['owner','admin']::public.app_role[]
      )
  )
);

-- ---------------------------------------------------------------------------
-- 5g. document_versions  (via auto_documents)
-- ---------------------------------------------------------------------------

CREATE POLICY dv_select ON public.document_versions
FOR SELECT USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.auto_documents d
    WHERE d.id = document_versions.document_id
      AND public.app_user_has_organization_access(COALESCE(d.organization_id, d.tenant_id))
  )
);

CREATE POLICY dv_insert ON public.document_versions
FOR INSERT WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.auto_documents d
    WHERE d.id = document_versions.document_id
      AND public._rls_user_can_write_org(
        COALESCE(d.organization_id, d.tenant_id),
        ARRAY['owner','admin','manager']::public.app_role[]
      )
  )
);

CREATE POLICY dv_update ON public.document_versions
FOR UPDATE USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.auto_documents d
    WHERE d.id = document_versions.document_id
      AND public._rls_user_can_write_org(
        COALESCE(d.organization_id, d.tenant_id),
        ARRAY['owner','admin','manager']::public.app_role[]
      )
  )
) WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.auto_documents d
    WHERE d.id = document_versions.document_id
      AND public._rls_user_can_write_org(
        COALESCE(d.organization_id, d.tenant_id),
        ARRAY['owner','admin','manager']::public.app_role[]
      )
  )
);

CREATE POLICY dv_delete ON public.document_versions
FOR DELETE USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.auto_documents d
    WHERE d.id = document_versions.document_id
      AND public._rls_user_can_write_org(
        COALESCE(d.organization_id, d.tenant_id),
        ARRAY['owner','admin']::public.app_role[]
      )
  )
);

-- ---------------------------------------------------------------------------
-- 5h. document_signatures  (via auto_documents)
-- ---------------------------------------------------------------------------

CREATE POLICY ds_select ON public.document_signatures
FOR SELECT USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.auto_documents d
    WHERE d.id = document_signatures.document_id
      AND public.app_user_has_organization_access(COALESCE(d.organization_id, d.tenant_id))
  )
);

CREATE POLICY ds_insert ON public.document_signatures
FOR INSERT WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.auto_documents d
    WHERE d.id = document_signatures.document_id
      AND public._rls_user_can_write_org(
        COALESCE(d.organization_id, d.tenant_id),
        ARRAY['owner','admin','manager']::public.app_role[]
      )
  )
);

CREATE POLICY ds_update ON public.document_signatures
FOR UPDATE USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.auto_documents d
    WHERE d.id = document_signatures.document_id
      AND public._rls_user_can_write_org(
        COALESCE(d.organization_id, d.tenant_id),
        ARRAY['owner','admin','manager']::public.app_role[]
      )
  )
) WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.auto_documents d
    WHERE d.id = document_signatures.document_id
      AND public._rls_user_can_write_org(
        COALESCE(d.organization_id, d.tenant_id),
        ARRAY['owner','admin','manager']::public.app_role[]
      )
  )
);

CREATE POLICY ds_delete ON public.document_signatures
FOR DELETE USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.auto_documents d
    WHERE d.id = document_signatures.document_id
      AND public._rls_user_can_write_org(
        COALESCE(d.organization_id, d.tenant_id),
        ARRAY['owner','admin']::public.app_role[]
      )
  )
);

-- ---------------------------------------------------------------------------
-- 5i. document_permissions  (via auto_documents)
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='document_permissions') THEN

    EXECUTE 'CREATE POLICY dp_select ON public.document_permissions
    FOR SELECT USING (
      public.app_is_platform_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.auto_documents d
        WHERE d.id = document_permissions.document_id
          AND public.app_user_has_organization_access(COALESCE(d.organization_id, d.tenant_id))
      )
    )';

    EXECUTE 'CREATE POLICY dp_insert ON public.document_permissions
    FOR INSERT WITH CHECK (
      public.app_is_platform_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.auto_documents d
        WHERE d.id = document_permissions.document_id
          AND public._rls_user_can_write_org(
            COALESCE(d.organization_id, d.tenant_id),
            ARRAY[''owner'',''admin'',''manager'']::public.app_role[]
          )
      )
    )';

    EXECUTE 'CREATE POLICY dp_update ON public.document_permissions
    FOR UPDATE USING (
      public.app_is_platform_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.auto_documents d
        WHERE d.id = document_permissions.document_id
          AND public._rls_user_can_write_org(
            COALESCE(d.organization_id, d.tenant_id),
            ARRAY[''owner'',''admin'',''manager'']::public.app_role[]
          )
      )
    ) WITH CHECK (
      public.app_is_platform_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.auto_documents d
        WHERE d.id = document_permissions.document_id
          AND public._rls_user_can_write_org(
            COALESCE(d.organization_id, d.tenant_id),
            ARRAY[''owner'',''admin'',''manager'']::public.app_role[]
          )
      )
    )';

    EXECUTE 'CREATE POLICY dp_delete ON public.document_permissions
    FOR DELETE USING (
      public.app_is_platform_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.auto_documents d
        WHERE d.id = document_permissions.document_id
          AND public._rls_user_can_write_org(
            COALESCE(d.organization_id, d.tenant_id),
            ARRAY[''owner'',''admin'']::public.app_role[]
          )
      )
    )';

  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5j. document_esignatures  (via auto_documents)
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='document_esignatures') THEN

    EXECUTE 'CREATE POLICY des_select ON public.document_esignatures
    FOR SELECT USING (
      public.app_is_platform_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.auto_documents d
        WHERE d.id = document_esignatures.document_id
          AND public.app_user_has_organization_access(COALESCE(d.organization_id, d.tenant_id))
      )
    )';

    EXECUTE 'CREATE POLICY des_insert ON public.document_esignatures
    FOR INSERT WITH CHECK (
      public.app_is_platform_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.auto_documents d
        WHERE d.id = document_esignatures.document_id
          AND public._rls_user_can_write_org(
            COALESCE(d.organization_id, d.tenant_id),
            ARRAY[''owner'',''admin'',''manager'']::public.app_role[]
          )
      )
    )';

    EXECUTE 'CREATE POLICY des_update ON public.document_esignatures
    FOR UPDATE USING (
      public.app_is_platform_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.auto_documents d
        WHERE d.id = document_esignatures.document_id
          AND public._rls_user_can_write_org(
            COALESCE(d.organization_id, d.tenant_id),
            ARRAY[''owner'',''admin'',''manager'']::public.app_role[]
          )
      )
    ) WITH CHECK (
      public.app_is_platform_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.auto_documents d
        WHERE d.id = document_esignatures.document_id
          AND public._rls_user_can_write_org(
            COALESCE(d.organization_id, d.tenant_id),
            ARRAY[''owner'',''admin'',''manager'']::public.app_role[]
          )
      )
    )';

    EXECUTE 'CREATE POLICY des_delete ON public.document_esignatures
    FOR DELETE USING (
      public.app_is_platform_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.auto_documents d
        WHERE d.id = document_esignatures.document_id
          AND public._rls_user_can_write_org(
            COALESCE(d.organization_id, d.tenant_id),
            ARRAY[''owner'',''admin'']::public.app_role[]
          )
      )
    )';

  END IF;
END $$;

-- =============================================================================
-- 6. VERIFICATION QUERY (run after migration)
-- =============================================================================

-- Uncomment to verify all policies are in place:
-- SELECT tablename, policyname, permissive, roles, cmd, qual IS NOT NULL AS has_using, with_check IS NOT NULL AS has_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, cmd, policyname;

-- ============================================================================
-- Migration 016: Add tenant columns to 9 child tables
-- Fixes: S-01, S-02, S-03, S-04, S-05, X-02
-- ============================================================================

-- ---- contract_esignatures (S-01) ----
ALTER TABLE public.contract_esignatures
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

UPDATE public.contract_esignatures ce
  SET organization_id = c.organization_id, tenant_id = c.tenant_id
  FROM public.contracts c WHERE ce.contract_id = c.id AND ce.organization_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_contract_esignatures_org ON public.contract_esignatures(organization_id);

-- ---- contract_scans (S-02) ----
ALTER TABLE public.contract_scans
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

UPDATE public.contract_scans cs
  SET organization_id = c.organization_id, tenant_id = c.tenant_id
  FROM public.contracts c WHERE cs.contract_id = c.id AND cs.organization_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_contract_scans_org ON public.contract_scans(organization_id);

-- ---- contract_versions ----
ALTER TABLE public.contract_versions
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

UPDATE public.contract_versions cv
  SET organization_id = c.organization_id, tenant_id = c.tenant_id
  FROM public.contracts c WHERE cv.contract_id = c.id AND cv.organization_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_contract_versions_org ON public.contract_versions(organization_id);

-- ---- document_esignatures (S-03) ----
ALTER TABLE public.document_esignatures
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

UPDATE public.document_esignatures de
  SET organization_id = d.organization_id, tenant_id = d.tenant_id
  FROM public.auto_documents d WHERE de.document_id = d.id AND de.organization_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_document_esignatures_org ON public.document_esignatures(organization_id);

-- ---- document_versions (S-04) ----
ALTER TABLE public.document_versions
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

UPDATE public.document_versions dv
  SET organization_id = d.organization_id, tenant_id = d.tenant_id
  FROM public.auto_documents d WHERE dv.document_id = d.id AND dv.organization_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_document_versions_org ON public.document_versions(organization_id);

-- ---- document_permissions (S-05) ----
ALTER TABLE public.document_permissions
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

UPDATE public.document_permissions dp
  SET organization_id = d.organization_id, tenant_id = d.tenant_id
  FROM public.auto_documents d WHERE dp.document_id = d.id AND dp.organization_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_document_permissions_org ON public.document_permissions(organization_id);

-- ---- quote_line_items ----
ALTER TABLE public.quote_line_items
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

UPDATE public.quote_line_items qli
  SET organization_id = q.organization_id, tenant_id = q.tenant_id
  FROM public.quotes q WHERE qli.quote_id = q.id AND qli.organization_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_quote_line_items_org ON public.quote_line_items(organization_id);

-- ---- purchase_order_items ----
ALTER TABLE public.purchase_order_items
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

UPDATE public.purchase_order_items poi
  SET organization_id = po.organization_id, tenant_id = po.tenant_id
  FROM public.purchase_orders po WHERE poi.purchase_order_id = po.id AND poi.organization_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_purchase_order_items_org ON public.purchase_order_items(organization_id);

-- ---- production_order_items ----
ALTER TABLE public.production_order_items
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

UPDATE public.production_order_items proi
  SET organization_id = pro.organization_id, tenant_id = pro.tenant_id
  FROM public.production_orders pro WHERE proi.production_order_id = pro.id AND proi.organization_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_production_order_items_org ON public.production_order_items(organization_id);


-- ============================================================================
-- Add all 9 tables to the sync_scope_ids() trigger
-- ============================================================================

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'contract_esignatures', 'contract_scans', 'contract_versions',
    'document_esignatures', 'document_versions', 'document_permissions',
    'quote_line_items', 'purchase_order_items', 'production_order_items'
  ]
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%I_sync_scope_ids ON public.%I;
       CREATE TRIGGER trg_%I_sync_scope_ids
         BEFORE INSERT OR UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.sync_scope_ids();',
      tbl, tbl, tbl, tbl
    );
  END LOOP;
END $$;


-- ============================================================================
-- RLS policies for all 9 child tables
-- ============================================================================

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'contract_esignatures', 'contract_scans', 'contract_versions',
    'document_esignatures', 'document_versions', 'document_permissions',
    'quote_line_items', 'purchase_order_items', 'production_order_items'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);

    EXECUTE format(
      'DROP POLICY IF EXISTS %I_tenant_isolation ON public.%I;
       CREATE POLICY %I_tenant_isolation ON public.%I
         FOR ALL
         USING (
           organization_id IN (
             SELECT om.organization_id FROM public.organization_memberships om
             WHERE om.user_id = auth.uid() AND om.is_active = true
           )
         );',
      tbl, tbl, tbl, tbl
    );
  END LOOP;
END $$;

-- Migration: Add CRM missing columns
-- Purpose: Add columns needed by useCRM.ts hooks that don't exist in the current schema
-- Date: 2026-03-09

-- ============================================
-- LEADS TABLE - Add missing columns
-- ============================================
ALTER TABLE leads ADD COLUMN IF NOT EXISTS title VARCHAR(255);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_status VARCHAR(50) DEFAULT 'new';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_source VARCHAR(50);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS website VARCHAR(500);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS converted_to_account_id UUID REFERENCES accounts(id);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS converted_to_contact_id UUID REFERENCES contacts(id);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS converted_to_opportunity_id UUID REFERENCES opportunities(id);

-- ============================================
-- ACCOUNTS TABLE - Add missing columns
-- ============================================
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS billing_address TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS billing_city VARCHAR(100);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS billing_state VARCHAR(100);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS billing_country VARCHAR(100);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS billing_zip VARCHAR(20);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS annual_revenue NUMERIC(15,2);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS number_of_employees INTEGER;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS ownership VARCHAR(100);

-- ============================================
-- CONTACTS TABLE - Add missing columns
-- ============================================
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS mobile_phone VARCHAR(50);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS department VARCHAR(100);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS state VARCHAR(100);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS country VARCHAR(100);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS zip VARCHAR(20);

-- ============================================
-- OPPORTUNITIES TABLE - Add missing columns
-- ============================================
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS lead_source VARCHAR(50);
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS expected_revenue NUMERIC(15,2);
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS next_step TEXT;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS is_closed BOOLEAN DEFAULT FALSE;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS is_won BOOLEAN DEFAULT FALSE;

-- ============================================
-- ACTIVITIES TABLE - Add missing columns
-- ============================================
ALTER TABLE activities ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE activities ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'medium';
ALTER TABLE activities ADD COLUMN IF NOT EXISTS related_to_type VARCHAR(50);
ALTER TABLE activities ADD COLUMN IF NOT EXISTS related_to_id UUID;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES leads(id);

-- ============================================
-- QUOTES TABLE - Add missing columns
-- ============================================
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(15,2);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- ============================================
-- QUOTE LINE ITEMS TABLE - Add missing columns
-- ============================================
ALTER TABLE quote_line_items ADD COLUMN IF NOT EXISTS product_name VARCHAR(255);
ALTER TABLE quote_line_items ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE quote_line_items ADD COLUMN IF NOT EXISTS total NUMERIC(15,2);
ALTER TABLE quote_line_items ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- ============================================
-- ADD RLS POLICIES FOR NEW COLUMNS
-- ============================================

-- Enable RLS on tables if not already enabled
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_line_items ENABLE ROW LEVEL SECURITY;

-- Create policies for the new columns (matching existing patterns)
-- Leads policies
DROP POLICY IF EXISTS "leads_select_policy" ON leads;
CREATE POLICY "leads_select_policy" ON leads FOR SELECT USING (
  organization_id = (SELECT organization_id FROM auth.users WHERE id = auth.uid())
  OR owner_id = auth.uid()
  OR auth.uid() IN (SELECT user_id FROM organization_memberships WHERE role IN ('owner', 'admin'))
);

DROP POLICY IF EXISTS "leads_insert_policy" ON leads;
CREATE POLICY "leads_insert_policy" ON leads FOR INSERT WITH CHECK (
  organization_id = (SELECT organization_id FROM auth.users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "leads_update_policy" ON leads;
CREATE POLICY "leads_update_policy" ON leads FOR UPDATE USING (
  organization_id = (SELECT organization_id FROM auth.users WHERE id = auth.uid())
  OR owner_id = auth.uid()
);

DROP POLICY IF EXISTS "leads_delete_policy" ON leads;
CREATE POLICY "leads_delete_policy" ON leads FOR DELETE USING (
  organization_id = (SELECT organization_id FROM auth.users WHERE id = auth.uid())
  OR owner_id = auth.uid()
);

-- Accounts policies
DROP POLICY IF EXISTS "accounts_select_policy" ON accounts;
CREATE POLICY "accounts_select_policy" ON accounts FOR SELECT USING (
  organization_id = (SELECT organization_id FROM auth.users WHERE id = auth.uid())
  OR owner_id = auth.uid()
  OR auth.uid() IN (SELECT user_id FROM organization_memberships WHERE role IN ('owner', 'admin'))
);

DROP POLICY IF EXISTS "accounts_insert_policy" ON accounts;
CREATE POLICY "accounts_insert_policy" ON accounts FOR INSERT WITH CHECK (
  organization_id = (SELECT organization_id FROM auth.users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "accounts_update_policy" ON accounts;
CREATE POLICY "accounts_update_policy" ON accounts FOR UPDATE USING (
  organization_id = (SELECT organization_id FROM auth.users WHERE id = auth.uid())
  OR owner_id = auth.uid()
);

DROP POLICY IF EXISTS "accounts_delete_policy" ON accounts;
CREATE POLICY "accounts_delete_policy" ON accounts FOR DELETE USING (
  organization_id = (SELECT organization_id FROM auth.users WHERE id = auth.uid())
  OR owner_id = auth.uid()
);

-- Contacts policies
DROP POLICY IF EXISTS "contacts_select_policy" ON contacts;
CREATE POLICY "contacts_select_policy" ON contacts FOR SELECT USING (
  organization_id = (SELECT organization_id FROM auth.users WHERE id = auth.uid())
  OR owner_id = auth.uid()
  OR auth.uid() IN (SELECT user_id FROM organization_memberships WHERE role IN ('owner', 'admin'))
);

DROP POLICY IF EXISTS "contacts_insert_policy" ON contacts;
CREATE POLICY "contacts_insert_policy" ON contacts FOR INSERT WITH CHECK (
  organization_id = (SELECT organization_id FROM auth.users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "contacts_update_policy" ON contacts;
CREATE POLICY "contacts_update_policy" ON contacts FOR UPDATE USING (
  organization_id = (SELECT organization_id FROM auth.users WHERE id = auth.uid())
  OR owner_id = auth.uid()
);

DROP POLICY IF EXISTS "contacts_delete_policy" ON contacts;
CREATE POLICY "contacts_delete_policy" ON contacts FOR DELETE USING (
  organization_id = (SELECT organization_id FROM auth.users WHERE id = auth.uid())
  OR owner_id = auth.uid()
);

-- Opportunities policies
DROP POLICY IF EXISTS "opportunities_select_policy" ON opportunities;
CREATE POLICY "opportunities_select_policy" ON opportunities FOR SELECT USING (
  organization_id = (SELECT organization_id FROM auth.users WHERE id = auth.uid())
  OR owner_id = auth.uid()
  OR auth.uid() IN (SELECT user_id FROM organization_memberships WHERE role IN ('owner', 'admin'))
);

DROP POLICY IF EXISTS "opportunities_insert_policy" ON opportunities;
CREATE POLICY "opportunities_insert_policy" ON opportunities FOR INSERT WITH CHECK (
  organization_id = (SELECT organization_id FROM auth.users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "opportunities_update_policy" ON opportunities;
CREATE POLICY "opportunities_update_policy" ON opportunities FOR UPDATE USING (
  organization_id = (SELECT organization_id FROM auth.users WHERE id = auth.uid())
  OR owner_id = auth.uid()
);

DROP POLICY IF EXISTS "opportunities_delete_policy" ON opportunities;
CREATE POLICY "opportunities_delete_policy" ON opportunities FOR DELETE USING (
  organization_id = (SELECT organization_id FROM auth.users WHERE id = auth.uid())
  OR owner_id = auth.uid()
);

-- Activities policies
DROP POLICY IF EXISTS "activities_select_policy" ON activities;
CREATE POLICY "activities_select_policy" ON activities FOR SELECT USING (
  organization_id = (SELECT organization_id FROM auth.users WHERE id = auth.uid())
  OR owner_id = auth.uid()
  OR auth.uid() IN (SELECT user_id FROM organization_memberships WHERE role IN ('owner', 'admin'))
);

DROP POLICY IF EXISTS "activities_insert_policy" ON activities;
CREATE POLICY "activities_insert_policy" ON activities FOR INSERT WITH CHECK (
  organization_id = (SELECT organization_id FROM auth.users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "activities_update_policy" ON activities;
CREATE POLICY "activities_update_policy" ON activities FOR UPDATE USING (
  organization_id = (SELECT organization_id FROM auth.users WHERE id = auth.uid())
  OR owner_id = auth.uid()
);

DROP POLICY IF EXISTS "activities_delete_policy" ON activities;
CREATE POLICY "activities_delete_policy" ON activities FOR DELETE USING (
  organization_id = (SELECT organization_id FROM auth.users WHERE id = auth.uid())
  OR owner_id = auth.uid()
);

-- Quotes policies
DROP POLICY IF EXISTS "quotes_select_policy" ON quotes;
CREATE POLICY "quotes_select_policy" ON quotes FOR SELECT USING (
  organization_id = (SELECT organization_id FROM auth.users WHERE id = auth.uid())
  OR owner_id = auth.uid()
  OR auth.uid() IN (SELECT user_id FROM organization_memberships WHERE role IN ('owner', 'admin'))
);

DROP POLICY IF EXISTS "quotes_insert_policy" ON quotes;
CREATE POLICY "quotes_insert_policy" ON quotes FOR INSERT WITH CHECK (
  organization_id = (SELECT organization_id FROM auth.users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "quotes_update_policy" ON quotes;
CREATE POLICY "quotes_update_policy" ON quotes FOR UPDATE USING (
  organization_id = (SELECT organization_id FROM auth.users WHERE id = auth.uid())
  OR owner_id = auth.uid()
);

DROP POLICY IF EXISTS "quotes_delete_policy" ON quotes;
CREATE POLICY "quotes_delete_policy" ON quotes FOR DELETE USING (
  organization_id = (SELECT organization_id FROM auth.users WHERE id = auth.uid())
  OR owner_id = auth.uid()
);

-- Quote line items policies
DROP POLICY IF EXISTS "quote_line_items_select_policy" ON quote_line_items;
CREATE POLICY "quote_line_items_select_policy" ON quote_line_items FOR SELECT USING (
  organization_id = (SELECT organization_id FROM auth.users WHERE id = auth.uid())
  OR auth.uid() IN (SELECT user_id FROM organization_memberships WHERE role IN ('owner', 'admin'))
);

DROP POLICY IF EXISTS "quote_line_items_insert_policy" ON quote_line_items;
CREATE POLICY "quote_line_items_insert_policy" ON quote_line_items FOR INSERT WITH CHECK (
  organization_id = (SELECT organization_id FROM auth.users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "quote_line_items_update_policy" ON quote_line_items;
CREATE POLICY "quote_line_items_update_policy" ON quote_line_items FOR UPDATE USING (
  organization_id = (SELECT organization_id FROM auth.users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "quote_line_items_delete_policy" ON quote_line_items;
CREATE POLICY "quote_line_items_delete_policy" ON quote_line_items FOR DELETE USING (
  organization_id = (SELECT organization_id FROM auth.users WHERE id = auth.uid())
);

-- ============================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(lead_status);
CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(lead_source);
CREATE INDEX IF NOT EXISTS idx_leads_website ON leads(website);
CREATE INDEX IF NOT EXISTS idx_leads_converted ON leads(converted_at);

CREATE INDEX IF NOT EXISTS idx_accounts_industry ON accounts(industry);
CREATE INDEX IF NOT EXISTS idx_accounts_annual_revenue ON accounts(annual_revenue);

CREATE INDEX IF NOT EXISTS idx_contacts_department ON contacts(department);
CREATE INDEX IF NOT EXISTS idx_contacts_city ON contacts(city);

CREATE INDEX IF NOT EXISTS idx_opportunities_stage ON opportunities(stage);
CREATE INDEX IF NOT EXISTS idx_opportunities_is_closed ON opportunities(is_closed);
CREATE INDEX IF NOT EXISTS idx_opportunities_is_won ON opportunities(is_won);

CREATE INDEX IF NOT EXISTS idx_activities_status ON activities(status);
CREATE INDEX IF NOT EXISTS idx_activities_priority ON activities(priority);
CREATE INDEX IF NOT EXISTS idx_activities_related_to ON activities(related_to_type, related_to_id);

CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_approved ON quotes(approved_at);

CREATE INDEX IF NOT EXISTS idx_quote_line_items_sort ON quote_line_items(sort_order);

-- Migration complete
SELECT 'CRM columns migration completed successfully' AS result;

-- Add missing columns that might have been accidentally deleted

-- Suppliers
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS website VARCHAR(500);
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS state VARCHAR(100);
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS country VARCHAR(100);
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS zip VARCHAR(20);
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(100);
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS rating NUMERIC(3,2);

-- Inventory Items
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS quantity_reserved INTEGER DEFAULT 0;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS quantity_available INTEGER DEFAULT 0;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS reorder_quantity INTEGER;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS reorder_level INTEGER;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS average_cost NUMERIC(15,2);
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS warehouse_location VARCHAR(255);

-- Products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS family VARCHAR(100);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS list_price NUMERIC(15,2);

-- Purchase Orders
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS expected_delivery_date TIMESTAMPTZ;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS actual_delivery_date TIMESTAMPTZ;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS subtotal NUMERIC(15,2);
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(15,2);
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS shipping_amount NUMERIC(15,2);
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS total_amount NUMERIC(15,2);
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS order_number VARCHAR(100);
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS vendor_id UUID;

-- Purchase Order Items
ALTER TABLE public.purchase_order_items ADD COLUMN IF NOT EXISTS product_name VARCHAR(255);
ALTER TABLE public.purchase_order_items ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.purchase_order_items ADD COLUMN IF NOT EXISTS quantity_ordered INTEGER;
ALTER TABLE public.purchase_order_items ADD COLUMN IF NOT EXISTS unit_price NUMERIC(15,2);
ALTER TABLE public.purchase_order_items ADD COLUMN IF NOT EXISTS total_price NUMERIC(15,2);

-- Production Orders
ALTER TABLE public.production_orders ADD COLUMN IF NOT EXISTS quantity_to_produce INTEGER;
ALTER TABLE public.production_orders ADD COLUMN IF NOT EXISTS quantity_produced INTEGER DEFAULT 0;
ALTER TABLE public.production_orders ADD COLUMN IF NOT EXISTS actual_end_date TIMESTAMPTZ;
ALTER TABLE public.production_orders ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;
ALTER TABLE public.production_orders ADD COLUMN IF NOT EXISTS notes TEXT;

-- Financial Records
ALTER TABLE public.financial_records ADD COLUMN IF NOT EXISTS record_type VARCHAR(50);
ALTER TABLE public.financial_records ADD COLUMN IF NOT EXISTS record_date TIMESTAMPTZ;
ALTER TABLE public.financial_records ADD COLUMN IF NOT EXISTS status VARCHAR(50);
ALTER TABLE public.financial_records ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.financial_records ADD COLUMN IF NOT EXISTS transaction_type VARCHAR(50);
ALTER TABLE public.financial_records ADD COLUMN IF NOT EXISTS transaction_date TIMESTAMPTZ;

-- Accounts
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS annual_revenue NUMERIC(15,2);
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS number_of_employees INTEGER;

-- Activities
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT false;

-- Quotes
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(15,2);
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS expiration_date TIMESTAMPTZ;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255);

-- Contract Templates
ALTER TABLE public.contract_templates ADD COLUMN IF NOT EXISTS type VARCHAR(50);

-- Contracts
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS total_value NUMERIC(15,2);

-- Document ESignatures
ALTER TABLE public.document_esignatures ADD COLUMN IF NOT EXISTS recipient_name VARCHAR(255);
ALTER TABLE public.document_esignatures ADD COLUMN IF NOT EXISTS recipient_email VARCHAR(255);
ALTER TABLE public.document_esignatures ADD COLUMN IF NOT EXISTS reminder_count INTEGER DEFAULT 0;
ALTER TABLE public.document_esignatures ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ;

-- Document Templates
ALTER TABLE public.document_templates ADD COLUMN IF NOT EXISTS type VARCHAR(50);
ALTER TABLE public.document_templates ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;

-- Auto Documents
ALTER TABLE public.auto_documents ADD COLUMN IF NOT EXISTS type VARCHAR(50);

-- Document Permissions
ALTER TABLE public.document_permissions ADD COLUMN IF NOT EXISTS permission_type VARCHAR(50);

-- Add remaining missing columns and foreign keys that were missed in previous migrations

-- Suppliers
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Purchase Orders
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(100);

-- Foreign Key for Purchase Orders to Accounts (vendor_id usually maps to accounts or suppliers, but the query uses accounts)
-- Based on the error: "could not find the relation between purchase_orders and accounts"
ALTER TABLE public.purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_vendor_id_fkey;
ALTER TABLE public.purchase_orders ADD CONSTRAINT purchase_orders_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.accounts(id);

-- Purchase Order Items
ALTER TABLE public.purchase_order_items ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.purchase_order_items ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);

-- Products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS quantity_on_hand INTEGER DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS quantity_reserved INTEGER DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS quantity_available INTEGER DEFAULT 0;

-- Quotes
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(100);
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS notes TEXT;

-- Contracts
-- Foreign Key for Contracts to Accounts
-- Based on the error: "could not find the relation between contracts and accounts"
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS account_id UUID;
ALTER TABLE public.contracts DROP CONSTRAINT IF EXISTS contracts_account_id_fkey;
ALTER TABLE public.contracts ADD CONSTRAINT contracts_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id);

-- Add missing company column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company VARCHAR(255);

-- Create missing RPC for get_inventory_value
CREATE OR REPLACE FUNCTION public.get_inventory_value()
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total numeric;
BEGIN
  -- Assuming inventory value is quantity_on_hand * unit_cost or average_cost
  SELECT COALESCE(SUM(quantity_available * average_cost), 0) INTO total
  FROM public.inventory_items;
  
  RETURN total;
END;
$$;

-- Create missing RPC for get_revenue_mtd
CREATE OR REPLACE FUNCTION public.get_revenue_mtd(start_date date, end_date date)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total numeric;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO total
  FROM public.financial_records
  WHERE transaction_type = 'income'
  AND transaction_date >= start_date 
  AND transaction_date <= end_date;
  
  RETURN total;
END;
$$;

-- ============================================================================
-- Migration 021: Ensure quote_line_items has organization scope columns
-- ============================================================================

ALTER TABLE public.quote_line_items
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id),
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.organizations(id);

-- Backfill from parent quote scope.
UPDATE public.quote_line_items qli
SET
  organization_id = q.organization_id,
  tenant_id = q.tenant_id
FROM public.quotes q
WHERE qli.quote_id = q.id
  AND (qli.organization_id IS NULL OR qli.tenant_id IS NULL);

-- Enforce organization scope after backfill.
ALTER TABLE public.quote_line_items
  ALTER COLUMN organization_id SET NOT NULL;

-- ============================================================================
-- Migration 022: Add missing semantic columns used by app mappings
-- ============================================================================

-- Accounts: add canonical description column and backfill from legacy ownership.
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS description text;

UPDATE public.accounts
SET description = ownership
WHERE description IS NULL
  AND ownership IS NOT NULL;

-- Financial records: add reference_type and backfill from legacy status field.
ALTER TABLE public.financial_records
  ADD COLUMN IF NOT EXISTS reference_type text;

UPDATE public.financial_records
SET reference_type = status
WHERE reference_type IS NULL
  AND status IS NOT NULL;

-- ============================================================================
-- Migration 023: Add soft-delete columns to quote_line_items
-- ============================================================================

ALTER TABLE public.quote_line_items
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_quote_line_items_deleted_at
  ON public.quote_line_items(deleted_at);

-- ============================================================================
-- Migration 024: Add cost_price column to products
-- ============================================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS cost_price numeric(15,2);

-- Backfill from legacy cost column where available.
UPDATE public.products
SET cost_price = cost
WHERE cost_price IS NULL
  AND cost IS NOT NULL;

-- ============================================================================
-- Migration 025: Recompute quote totals in database via trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION public.recompute_quote_totals_for_quote(p_quote_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_subtotal numeric := 0;
  v_discount_percent numeric := 0;
  v_tax_percent numeric := 0;
  v_discount_amount numeric := 0;
  v_taxable_amount numeric := 0;
  v_tax_amount numeric := 0;
  v_total_amount numeric := 0;
BEGIN
  IF p_quote_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(COALESCE(total, line_total, 0)), 0)
  INTO v_subtotal
  FROM public.quote_line_items
  WHERE quote_id = p_quote_id
    AND deleted_at IS NULL;

  SELECT
    COALESCE(discount_percent, 0),
    COALESCE(tax_percent, 0)
  INTO
    v_discount_percent,
    v_tax_percent
  FROM public.quotes
  WHERE id = p_quote_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_discount_amount := v_subtotal * v_discount_percent / 100;
  v_taxable_amount := v_subtotal - v_discount_amount;
  v_tax_amount := v_taxable_amount * v_tax_percent / 100;
  v_total_amount := v_taxable_amount + v_tax_amount;

  UPDATE public.quotes
  SET
    subtotal = v_subtotal,
    discount_amount = v_discount_amount,
    tax_amount = v_tax_amount,
    total_amount = v_total_amount,
    updated_at = now()
  WHERE id = p_quote_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.recompute_quote_totals(p_quote_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.recompute_quote_totals_for_quote(p_quote_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_recompute_quote_totals()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.recompute_quote_totals_for_quote(COALESCE(NEW.quote_id, OLD.quote_id));

  IF TG_OP = 'UPDATE' AND NEW.quote_id IS DISTINCT FROM OLD.quote_id THEN
    PERFORM public.recompute_quote_totals_for_quote(OLD.quote_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_recompute_quote_totals ON public.quote_line_items;

CREATE TRIGGER trg_recompute_quote_totals
AFTER INSERT OR UPDATE OR DELETE ON public.quote_line_items
FOR EACH ROW
EXECUTE FUNCTION public.trg_recompute_quote_totals();

DO $$
DECLARE
  v_quote record;
BEGIN
  FOR v_quote IN SELECT id FROM public.quotes LOOP
    PERFORM public.recompute_quote_totals_for_quote(v_quote.id);
  END LOOP;
END;
$$;

-- ============================================================================
-- Migration 026: Enforce non-null organization/tenant scope on child tables
-- ============================================================================

-- contract_esignatures <- contracts
UPDATE public.contract_esignatures ce
SET
  organization_id = c.organization_id,
  tenant_id = COALESCE(c.tenant_id, c.organization_id)
FROM public.contracts c
WHERE ce.contract_id = c.id
  AND (ce.organization_id IS NULL OR ce.tenant_id IS NULL);

UPDATE public.contract_esignatures
SET tenant_id = organization_id
WHERE tenant_id IS NULL
  AND organization_id IS NOT NULL;

ALTER TABLE public.contract_esignatures
  ALTER COLUMN organization_id SET NOT NULL,
  ALTER COLUMN tenant_id SET NOT NULL;

-- contract_scans <- contracts
UPDATE public.contract_scans cs
SET
  organization_id = c.organization_id,
  tenant_id = COALESCE(c.tenant_id, c.organization_id)
FROM public.contracts c
WHERE cs.contract_id = c.id
  AND (cs.organization_id IS NULL OR cs.tenant_id IS NULL);

UPDATE public.contract_scans
SET tenant_id = organization_id
WHERE tenant_id IS NULL
  AND organization_id IS NOT NULL;

ALTER TABLE public.contract_scans
  ALTER COLUMN organization_id SET NOT NULL,
  ALTER COLUMN tenant_id SET NOT NULL;

-- contract_versions <- contracts
UPDATE public.contract_versions cv
SET
  organization_id = c.organization_id,
  tenant_id = COALESCE(c.tenant_id, c.organization_id)
FROM public.contracts c
WHERE cv.contract_id = c.id
  AND (cv.organization_id IS NULL OR cv.tenant_id IS NULL);

UPDATE public.contract_versions
SET tenant_id = organization_id
WHERE tenant_id IS NULL
  AND organization_id IS NOT NULL;

ALTER TABLE public.contract_versions
  ALTER COLUMN organization_id SET NOT NULL,
  ALTER COLUMN tenant_id SET NOT NULL;

-- document_esignatures <- auto_documents
UPDATE public.document_esignatures de
SET
  organization_id = d.organization_id,
  tenant_id = COALESCE(d.tenant_id, d.organization_id)
FROM public.auto_documents d
WHERE de.document_id = d.id
  AND (de.organization_id IS NULL OR de.tenant_id IS NULL);

UPDATE public.document_esignatures
SET tenant_id = organization_id
WHERE tenant_id IS NULL
  AND organization_id IS NOT NULL;

ALTER TABLE public.document_esignatures
  ALTER COLUMN organization_id SET NOT NULL,
  ALTER COLUMN tenant_id SET NOT NULL;

-- document_versions <- auto_documents
UPDATE public.document_versions dv
SET
  organization_id = d.organization_id,
  tenant_id = COALESCE(d.tenant_id, d.organization_id)
FROM public.auto_documents d
WHERE dv.document_id = d.id
  AND (dv.organization_id IS NULL OR dv.tenant_id IS NULL);

UPDATE public.document_versions
SET tenant_id = organization_id
WHERE tenant_id IS NULL
  AND organization_id IS NOT NULL;

ALTER TABLE public.document_versions
  ALTER COLUMN organization_id SET NOT NULL,
  ALTER COLUMN tenant_id SET NOT NULL;

-- document_permissions <- auto_documents
UPDATE public.document_permissions dp
SET
  organization_id = d.organization_id,
  tenant_id = COALESCE(d.tenant_id, d.organization_id)
FROM public.auto_documents d
WHERE dp.document_id = d.id
  AND (dp.organization_id IS NULL OR dp.tenant_id IS NULL);

UPDATE public.document_permissions
SET tenant_id = organization_id
WHERE tenant_id IS NULL
  AND organization_id IS NOT NULL;

ALTER TABLE public.document_permissions
  ALTER COLUMN organization_id SET NOT NULL,
  ALTER COLUMN tenant_id SET NOT NULL;

-- quote_line_items <- quotes
UPDATE public.quote_line_items qli
SET
  organization_id = q.organization_id,
  tenant_id = COALESCE(q.tenant_id, q.organization_id)
FROM public.quotes q
WHERE qli.quote_id = q.id
  AND (qli.organization_id IS NULL OR qli.tenant_id IS NULL);

UPDATE public.quote_line_items
SET tenant_id = organization_id
WHERE tenant_id IS NULL
  AND organization_id IS NOT NULL;

ALTER TABLE public.quote_line_items
  ALTER COLUMN organization_id SET NOT NULL,
  ALTER COLUMN tenant_id SET NOT NULL;

-- purchase_order_items <- purchase_orders
UPDATE public.purchase_order_items poi
SET
  organization_id = po.organization_id,
  tenant_id = COALESCE(po.tenant_id, po.organization_id)
FROM public.purchase_orders po
WHERE poi.purchase_order_id = po.id
  AND (poi.organization_id IS NULL OR poi.tenant_id IS NULL);

UPDATE public.purchase_order_items
SET tenant_id = organization_id
WHERE tenant_id IS NULL
  AND organization_id IS NOT NULL;

ALTER TABLE public.purchase_order_items
  ALTER COLUMN organization_id SET NOT NULL,
  ALTER COLUMN tenant_id SET NOT NULL;

-- production_order_items <- production_orders
UPDATE public.production_order_items poi
SET
  organization_id = po.organization_id,
  tenant_id = COALESCE(po.tenant_id, po.organization_id)
FROM public.production_orders po
WHERE poi.production_order_id = po.id
  AND (poi.organization_id IS NULL OR poi.tenant_id IS NULL);

UPDATE public.production_order_items
SET tenant_id = organization_id
WHERE tenant_id IS NULL
  AND organization_id IS NOT NULL;

ALTER TABLE public.production_order_items
  ALTER COLUMN organization_id SET NOT NULL,
  ALTER COLUMN tenant_id SET NOT NULL;

-- ============================================================================
-- Migration 027: Add missing CLM/Documents columns used by frontend payloads
-- ============================================================================

-- -----------------------------
-- CLM: contract_templates
-- -----------------------------
ALTER TABLE public.contract_templates
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

UPDATE public.contract_templates
SET is_active = CASE
  WHEN lower(coalesce(status, 'active')) IN ('inactive', 'disabled', 'archived') THEN false
  ELSE true
END
WHERE is_active IS NULL;

-- -----------------------------
-- CLM: contracts
-- -----------------------------
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS opportunity_id uuid,
  ADD COLUMN IF NOT EXISTS contact_id uuid;

DO $$
BEGIN
  ALTER TABLE public.contracts
    ADD CONSTRAINT contracts_opportunity_id_fkey
    FOREIGN KEY (opportunity_id) REFERENCES public.opportunities(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE public.contracts
    ADD CONSTRAINT contracts_contact_id_fkey
    FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- -----------------------------
-- CLM: contract_scans
-- -----------------------------
ALTER TABLE public.contract_scans
  ADD COLUMN IF NOT EXISTS file_path text,
  ADD COLUMN IF NOT EXISTS content_type text,
  ADD COLUMN IF NOT EXISTS file_size bigint,
  ADD COLUMN IF NOT EXISTS ocr_text text,
  ADD COLUMN IF NOT EXISTS scan_date timestamptz,
  ADD COLUMN IF NOT EXISTS created_by uuid;

UPDATE public.contract_scans
SET file_path = file_url
WHERE file_path IS NULL
  AND file_url IS NOT NULL;

UPDATE public.contract_scans
SET ocr_text = extracted_text
WHERE ocr_text IS NULL
  AND extracted_text IS NOT NULL;

UPDATE public.contract_scans
SET scan_date = created_at
WHERE scan_date IS NULL
  AND created_at IS NOT NULL;

DO $$
BEGIN
  ALTER TABLE public.contract_scans
    ADD CONSTRAINT contract_scans_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- -----------------------------
-- Documents: document_templates
-- -----------------------------
ALTER TABLE public.document_templates
  ADD COLUMN IF NOT EXISTS variables jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- -----------------------------
-- Documents: auto_documents
-- -----------------------------
ALTER TABLE public.auto_documents
  ADD COLUMN IF NOT EXISTS related_entity_type text,
  ADD COLUMN IF NOT EXISTS related_entity_id uuid,
  ADD COLUMN IF NOT EXISTS file_path text,
  ADD COLUMN IF NOT EXISTS file_name text,
  ADD COLUMN IF NOT EXISTS format text,
  ADD COLUMN IF NOT EXISTS file_size bigint,
  ADD COLUMN IF NOT EXISTS generated_from text DEFAULT 'template';

UPDATE public.auto_documents
SET generated_from = 'template'
WHERE generated_from IS NULL;

-- -----------------------------
-- Documents: document_esignatures
-- -----------------------------
ALTER TABLE public.document_esignatures
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_by uuid;

UPDATE public.document_esignatures
SET sent_at = created_at
WHERE sent_at IS NULL
  AND created_at IS NOT NULL;

DO $$
BEGIN
  ALTER TABLE public.document_esignatures
    ADD CONSTRAINT document_esignatures_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- -----------------------------
-- Documents: document_versions
-- -----------------------------
ALTER TABLE public.document_versions
  ADD COLUMN IF NOT EXISTS file_path text,
  ADD COLUMN IF NOT EXISTS file_name text,
  ADD COLUMN IF NOT EXISTS format text,
  ADD COLUMN IF NOT EXISTS file_size bigint;

-- -----------------------------
-- Documents: document_permissions
-- -----------------------------
ALTER TABLE public.document_permissions
  ADD COLUMN IF NOT EXISTS shared_by uuid;

DO $$
BEGIN
  ALTER TABLE public.document_permissions
    ADD CONSTRAINT document_permissions_shared_by_fkey
    FOREIGN KEY (shared_by) REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- ============================================================================
-- Migration 028: Add is_public to contract_templates
-- ============================================================================

ALTER TABLE public.contract_templates
  ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false;

UPDATE public.contract_templates
SET is_public = false
WHERE is_public IS NULL;

ALTER TABLE public.contract_templates
  ALTER COLUMN is_public SET NOT NULL;

-- Tighten client read access for portal-facing records while keeping
-- full organization visibility for internal roles.

CREATE OR REPLACE FUNCTION public.app_user_has_internal_organization_access(
  p_organization_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
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

CREATE OR REPLACE FUNCTION public.app_user_can_select_portal_record(
  p_organization_id uuid,
  p_customer_email text DEFAULT NULL,
  p_signer_email text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL,
  p_owner_id uuid DEFAULT NULL,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
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
          (p_customer_email IS NOT NULL AND lower(om.email) = lower(p_customer_email))
          OR (p_signer_email IS NOT NULL AND lower(om.email) = lower(p_signer_email))
          OR (p_created_by IS NOT NULL AND p_created_by = p_user_id)
          OR (p_owner_id IS NOT NULL AND p_owner_id = p_user_id)
        )
    );
$$;

DROP POLICY IF EXISTS quotes_select ON public.quotes;
CREATE POLICY quotes_select ON public.quotes
FOR SELECT USING (
  public.app_user_can_select_portal_record(
    COALESCE(organization_id, tenant_id),
    customer_email,
    NULL,
    NULL,
    owner_id
  )
);

DROP POLICY IF EXISTS contracts_select ON public.contracts;
CREATE POLICY contracts_select ON public.contracts
FOR SELECT USING (
  public.app_user_can_select_portal_record(
    COALESCE(organization_id, tenant_id),
    customer_email,
    NULL,
    NULL,
    owner_id
  )
);

DROP POLICY IF EXISTS auto_documents_select ON public.auto_documents;
CREATE POLICY auto_documents_select ON public.auto_documents
FOR SELECT USING (
  public.app_user_can_select_portal_record(
    COALESCE(organization_id, tenant_id),
    NULL,
    NULL,
    created_by,
    owner_id
  )
);

DROP POLICY IF EXISTS qli_select ON public.quote_line_items;
CREATE POLICY qli_select ON public.quote_line_items
FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM public.quotes q
    WHERE q.id = quote_line_items.quote_id
      AND public.app_user_can_select_portal_record(
        COALESCE(q.organization_id, q.tenant_id),
        q.customer_email,
        NULL,
        NULL,
        q.owner_id
      )
  )
);

DROP POLICY IF EXISTS cv_select ON public.contract_versions;
CREATE POLICY cv_select ON public.contract_versions
FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM public.contracts c
    WHERE c.id = contract_versions.contract_id
      AND public.app_user_can_select_portal_record(
        COALESCE(c.organization_id, c.tenant_id),
        c.customer_email,
        NULL,
        NULL,
        c.owner_id
      )
  )
);

DROP POLICY IF EXISTS ces_select ON public.contract_esignatures;
CREATE POLICY ces_select ON public.contract_esignatures
FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM public.contracts c
    WHERE c.id = contract_esignatures.contract_id
      AND public.app_user_can_select_portal_record(
        COALESCE(c.organization_id, c.tenant_id),
        c.customer_email,
        contract_esignatures.signer_email,
        NULL,
        c.owner_id
      )
  )
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'contract_scans'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS cs_select ON public.contract_scans';
    EXECUTE '
      CREATE POLICY cs_select ON public.contract_scans
      FOR SELECT USING (
        EXISTS (
          SELECT 1
          FROM public.contracts c
          WHERE c.id = contract_scans.contract_id
            AND public.app_user_can_select_portal_record(
              COALESCE(c.organization_id, c.tenant_id),
              c.customer_email,
              NULL,
              NULL,
              c.owner_id
            )
        )
      )';
  END IF;
END $$;

-- 030_portal_strict_rls_and_signatures.sql
-- Fix email-only portal scoping by introducing structural contact/account links for clients.
-- Enable clients to securely sign documents.

ALTER TABLE public.organization_memberships
ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL;

ALTER TABLE public.client_invitations
ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_memberships_account ON public.organization_memberships(account_id);
CREATE INDEX IF NOT EXISTS idx_memberships_contact ON public.organization_memberships(contact_id);

-- Update the main portal record read policy to rely on account/contact links rather than fallback emails.
CREATE OR REPLACE FUNCTION public.app_user_can_select_portal_record(
  p_organization_id uuid,
  p_account_id uuid DEFAULT NULL,
  p_contact_id uuid DEFAULT NULL,
  p_created_by uuid DEFAULT NULL,
  p_owner_id uuid DEFAULT NULL,
  p_user_id uuid DEFAULT auth.uid(),
  p_fallback_email text DEFAULT NULL -- Kept for legacy compatibility during migration
)
RETURNS boolean
LANGUAGE sql
STABLE
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
          -- Fallback email match ONLY if no structural link exists, as a migration transition feature
          OR (p_fallback_email IS NOT NULL AND lower(om.email) = lower(p_fallback_email) AND om.account_id IS NULL AND om.contact_id IS NULL)
          OR (p_created_by IS NOT NULL AND p_created_by = p_user_id)
          OR (p_owner_id IS NOT NULL AND p_owner_id = p_user_id)
        )
    );
$$;

-- Replace existing quotes reading policy
DROP POLICY IF EXISTS quotes_select ON public.quotes;
CREATE POLICY quotes_select ON public.quotes
FOR SELECT USING (
  public.app_user_can_select_portal_record(
    COALESCE(organization_id, tenant_id),
    account_id,
    contact_id,
    NULL,
    owner_id,
    auth.uid(),
    customer_email
  )
);

-- Replace existing contracts reading policy
DROP POLICY IF EXISTS contracts_select ON public.contracts;
CREATE POLICY contracts_select ON public.contracts
FOR SELECT USING (
  public.app_user_can_select_portal_record(
    COALESCE(organization_id, tenant_id),
    NULL,
    NULL,
    NULL,
    owner_id,
    auth.uid(),
    customer_email
  )
);
-- Contracts don't have account_id/contact_id natively yet, we should add them if they don't exist!
ALTER TABLE public.contracts
ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL;

-- Redefine contracts reading policy now that columns exist
DROP POLICY IF EXISTS contracts_select ON public.contracts;
CREATE POLICY contracts_select ON public.contracts
FOR SELECT USING (
  public.app_user_can_select_portal_record(
    COALESCE(organization_id, tenant_id),
    account_id,
    contact_id,
    NULL,
    owner_id,
    auth.uid(),
    customer_email
  )
);

-- Quote line items & Contract Versions (No change needed, they rely on quotes_select / contracts_select!)

-- Add specific Client UPDATE policy for contract_esignatures
DROP POLICY IF EXISTS ces_update_client ON public.contract_esignatures;
CREATE POLICY ces_update_client ON public.contract_esignatures
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.contracts c
    JOIN public.organization_memberships om ON om.organization_id = COALESCE(c.organization_id, c.tenant_id)
    WHERE c.id = contract_esignatures.contract_id
      AND om.user_id = auth.uid()
      AND om.is_active = true
      AND om.role = 'client'
      AND (
         (c.account_id IS NOT NULL AND om.account_id = c.account_id) OR
         (c.contact_id IS NOT NULL AND om.contact_id = c.contact_id) OR
         (om.account_id IS NULL AND om.contact_id IS NULL AND lower(om.email) = lower(c.customer_email))
      )
      AND lower(om.email) = lower(contract_esignatures.signer_email)
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.contracts c
    JOIN public.organization_memberships om ON om.organization_id = COALESCE(c.organization_id, c.tenant_id)
    WHERE c.id = contract_esignatures.contract_id
      AND om.user_id = auth.uid()
      AND om.is_active = true
      AND om.role = 'client'
      AND (
         (c.account_id IS NOT NULL AND om.account_id = c.account_id) OR
         (c.contact_id IS NOT NULL AND om.contact_id = c.contact_id) OR
         (om.account_id IS NULL AND om.contact_id IS NULL AND lower(om.email) = lower(c.customer_email))
      )
      AND lower(om.email) = lower(contract_esignatures.signer_email)
  )
);

-- Contract eSignature reads should also enforce contact/email match properly
DROP POLICY IF EXISTS ces_select ON public.contract_esignatures;
CREATE POLICY ces_select ON public.contract_esignatures
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = contract_esignatures.contract_id
      AND public.app_user_can_select_portal_record(
        COALESCE(c.organization_id, c.tenant_id),
        c.account_id,
        c.contact_id,
        NULL,
        c.owner_id,
        auth.uid(),
        c.customer_email
      )
  )
);

-- Migration to create contact_inquiries table for the public contact form

CREATE TABLE IF NOT EXISTS public.contact_inquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    company TEXT,
    interest TEXT,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new', -- e.g., 'new', 'contacted', 'resolved'
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contact_inquiries ENABLE ROW LEVEL SECURITY;

-- Allow anyone to submit a contact inquiry (Public Insert)
CREATE POLICY contact_inquiries_insert_policy ON public.contact_inquiries
    FOR INSERT 
    WITH CHECK (true);

-- Only allow authenticated admins to view/manage inquiries (Service Role handles this usually, but let's be safe)
CREATE POLICY contact_inquiries_select_admin_policy ON public.contact_inquiries
    FOR SELECT
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.organization_memberships
        WHERE user_id = auth.uid() 
        AND role IN ('owner', 'admin')
    ));

-- Grant access to public for inserts
GRANT INSERT ON public.contact_inquiries TO anon, authenticated;

-- =============================================================================
-- 032_fix_qli_select_policy.sql
-- =============================================================================
-- Fix: Migration 029 rewrote qli_select but lost the standalone
-- app_is_platform_super_admin check. This restores it as a top-level OR
-- so super admins can always read quote line items.

DROP POLICY IF EXISTS qli_select ON public.quote_line_items;
CREATE POLICY qli_select ON public.quote_line_items
FOR SELECT USING (
  public.app_is_platform_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.quotes q
    WHERE q.id = quote_line_items.quote_id
      AND public.app_user_can_select_portal_record(
        COALESCE(q.organization_id, q.tenant_id),
        q.account_id,
        q.contact_id,
        NULL,
        q.owner_id,
        auth.uid(),
        q.customer_email
      )
  )
);

-- 034_fix_employee_permissions.sql
-- Grant INSERT and UPDATE access to 'employee' role for business tables.

SET search_path = public, extensions;

-- Employees need to be able to create and update records in the CRM/CPQ/ERP tables.
-- Originally, only 'owner', 'admin', 'manager' were allowed in 015_hardened_rls_policies.sql.

DO $$
DECLARE
  t text;
  biz_tables text[] := ARRAY[
    'accounts','contacts','leads','opportunities','activities',
    'products','quotes','contract_templates','contracts',
    'suppliers','inventory_items','inventory_transactions',
    'purchase_orders','production_orders','financial_records',
    'document_templates','auto_documents'
  ];
BEGIN
  FOREACH t IN ARRAY biz_tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      CONTINUE;
    END IF;

    -- Re-create INSERT policy to include 'employee'
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_insert', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (
        public._rls_user_can_write_org(
          COALESCE(organization_id, tenant_id),
          ARRAY[''owner'',''admin'',''manager'',''employee'']::public.app_role[]
        )
      )',
      t || '_insert', t
    );

    -- Re-create UPDATE policy to include 'employee'
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_update', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE
        USING (
          public._rls_user_can_write_org(
            COALESCE(organization_id, tenant_id),
            ARRAY[''owner'',''admin'',''manager'',''employee'']::public.app_role[]
          )
        )
        WITH CHECK (
          public._rls_user_can_write_org(
            COALESCE(organization_id, tenant_id),
            ARRAY[''owner'',''admin'',''manager'',''employee'']::public.app_role[]
          )
        )',
      t || '_update', t
    );
  END LOOP;
END $$;

-- Update child tables
DO $$
BEGIN
  -- quote_line_items
  DROP POLICY IF EXISTS qli_insert ON public.quote_line_items;
  CREATE POLICY qli_insert ON public.quote_line_items FOR INSERT WITH CHECK (
    public.app_is_platform_super_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.quotes q WHERE q.id = quote_line_items.quote_id AND public._rls_user_can_write_org(COALESCE(q.organization_id, q.tenant_id), ARRAY['owner','admin','manager','employee']::public.app_role[])
    )
  );

  DROP POLICY IF EXISTS qli_update ON public.quote_line_items;
  CREATE POLICY qli_update ON public.quote_line_items FOR UPDATE USING (
    public.app_is_platform_super_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.quotes q WHERE q.id = quote_line_items.quote_id AND public._rls_user_can_write_org(COALESCE(q.organization_id, q.tenant_id), ARRAY['owner','admin','manager','employee']::public.app_role[])
    )
  ) WITH CHECK (
    public.app_is_platform_super_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.quotes q WHERE q.id = quote_line_items.quote_id AND public._rls_user_can_write_org(COALESCE(q.organization_id, q.tenant_id), ARRAY['owner','admin','manager','employee']::public.app_role[])
    )
  );

  -- contract_versions
  DROP POLICY IF EXISTS cv_insert ON public.contract_versions;
  CREATE POLICY cv_insert ON public.contract_versions FOR INSERT WITH CHECK (
    public.app_is_platform_super_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.contracts c WHERE c.id = contract_versions.contract_id AND public._rls_user_can_write_org(COALESCE(c.organization_id, c.tenant_id), ARRAY['owner','admin','manager','employee']::public.app_role[])
    )
  );

  -- purchase_order_items
  DROP POLICY IF EXISTS poi_insert ON public.purchase_order_items;
  CREATE POLICY poi_insert ON public.purchase_order_items FOR INSERT WITH CHECK (
    public.app_is_platform_super_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.purchase_orders p WHERE p.id = purchase_order_items.purchase_order_id AND public._rls_user_can_write_org(COALESCE(p.organization_id, p.tenant_id), ARRAY['owner','admin','manager','employee']::public.app_role[])
    )
  );

  DROP POLICY IF EXISTS poi_update ON public.purchase_order_items;
  CREATE POLICY poi_update ON public.purchase_order_items FOR UPDATE USING (
    public.app_is_platform_super_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.purchase_orders p WHERE p.id = purchase_order_items.purchase_order_id AND public._rls_user_can_write_org(COALESCE(p.organization_id, p.tenant_id), ARRAY['owner','admin','manager','employee']::public.app_role[])
    )
  ) WITH CHECK (
    public.app_is_platform_super_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.purchase_orders p WHERE p.id = purchase_order_items.purchase_order_id AND public._rls_user_can_write_org(COALESCE(p.organization_id, p.tenant_id), ARRAY['owner','admin','manager','employee']::public.app_role[])
    )
  );

  -- production_order_items
  DROP POLICY IF EXISTS prodoi_insert ON public.production_order_items;
  CREATE POLICY prodoi_insert ON public.production_order_items FOR INSERT WITH CHECK (
    public.app_is_platform_super_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.production_orders p WHERE p.id = production_order_items.production_order_id AND public._rls_user_can_write_org(COALESCE(p.organization_id, p.tenant_id), ARRAY['owner','admin','manager','employee']::public.app_role[])
    )
  );

  DROP POLICY IF EXISTS prodoi_update ON public.production_order_items;
  CREATE POLICY prodoi_update ON public.production_order_items FOR UPDATE USING (
    public.app_is_platform_super_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.production_orders p WHERE p.id = production_order_items.production_order_id AND public._rls_user_can_write_org(COALESCE(p.organization_id, p.tenant_id), ARRAY['owner','admin','manager','employee']::public.app_role[])
    )
  ) WITH CHECK (
    public.app_is_platform_super_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.production_orders p WHERE p.id = production_order_items.production_order_id AND public._rls_user_can_write_org(COALESCE(p.organization_id, p.tenant_id), ARRAY['owner','admin','manager','employee']::public.app_role[])
    )
  );

  -- document_versions
  DROP POLICY IF EXISTS dv_insert ON public.document_versions;
  CREATE POLICY dv_insert ON public.document_versions FOR INSERT WITH CHECK (
    public.app_is_platform_super_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.auto_documents d WHERE d.id = document_versions.document_id AND public._rls_user_can_write_org(COALESCE(d.organization_id, d.tenant_id), ARRAY['owner','admin','manager','employee']::public.app_role[])
    )
  );

  -- document_permissions
  DROP POLICY IF EXISTS dp_insert ON public.document_permissions;
  CREATE POLICY dp_insert ON public.document_permissions FOR INSERT WITH CHECK (
    public.app_is_platform_super_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.auto_documents d WHERE d.id = document_permissions.document_id AND public._rls_user_can_write_org(COALESCE(d.organization_id, d.tenant_id), ARRAY['owner','admin','manager','employee']::public.app_role[])
    )
  );

  DROP POLICY IF EXISTS dp_update ON public.document_permissions;
  CREATE POLICY dp_update ON public.document_permissions FOR UPDATE USING (
    public.app_is_platform_super_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.auto_documents d WHERE d.id = document_permissions.document_id AND public._rls_user_can_write_org(COALESCE(d.organization_id, d.tenant_id), ARRAY['owner','admin','manager','employee']::public.app_role[])
    )
  ) WITH CHECK (
    public.app_is_platform_super_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.auto_documents d WHERE d.id = document_permissions.document_id AND public._rls_user_can_write_org(COALESCE(d.organization_id, d.tenant_id), ARRAY['owner','admin','manager','employee']::public.app_role[])
    )
  );
END $$;

-- Fix any missing GRANTS by explicitly granting SELECT/INSERT/UPDATE/DELETE to authenticated to all tables cleanly
-- This prevents the '42501 insufficient_privilege' missing grant error on recently added tables or columns.
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

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

-- 037_drop_bad_crm_policies.sql
-- Migration 017 incorrectly added secondary RLS policies (e.g., `leads_select_policy`)
-- to the CRM tables. These policies contained direct SELECTs on `auth.users`, which
-- the `authenticated` role doesn't have permissions to query, causing 42501 (Forbidden)
-- errors to be thrown across the entire app.
-- 
-- We drop all of these "_policy" suffixed rogue policies, letting the correct
-- policies from 015 and 034 (e.g., `leads_select`) take full control without crashing.

SET search_path = public, extensions;

-- Drop Leads 017 policies
DROP POLICY IF EXISTS "leads_select_policy" ON leads;
DROP POLICY IF EXISTS "leads_insert_policy" ON leads;
DROP POLICY IF EXISTS "leads_update_policy" ON leads;
DROP POLICY IF EXISTS "leads_delete_policy" ON leads;

-- Drop Accounts 017 policies
DROP POLICY IF EXISTS "accounts_select_policy" ON accounts;
DROP POLICY IF EXISTS "accounts_insert_policy" ON accounts;
DROP POLICY IF EXISTS "accounts_update_policy" ON accounts;
DROP POLICY IF EXISTS "accounts_delete_policy" ON accounts;

-- Drop Contacts 017 policies
DROP POLICY IF EXISTS "contacts_select_policy" ON contacts;
DROP POLICY IF EXISTS "contacts_insert_policy" ON contacts;
DROP POLICY IF EXISTS "contacts_update_policy" ON contacts;
DROP POLICY IF EXISTS "contacts_delete_policy" ON contacts;

-- Drop Opportunities 017 policies
DROP POLICY IF EXISTS "opportunities_select_policy" ON opportunities;
DROP POLICY IF EXISTS "opportunities_insert_policy" ON opportunities;
DROP POLICY IF EXISTS "opportunities_update_policy" ON opportunities;
DROP POLICY IF EXISTS "opportunities_delete_policy" ON opportunities;

-- Drop Activities 017 policies
DROP POLICY IF EXISTS "activities_select_policy" ON activities;
DROP POLICY IF EXISTS "activities_insert_policy" ON activities;
DROP POLICY IF EXISTS "activities_update_policy" ON activities;
DROP POLICY IF EXISTS "activities_delete_policy" ON activities;

-- Drop Quotes 017 policies
DROP POLICY IF EXISTS "quotes_select_policy" ON quotes;
DROP POLICY IF EXISTS "quotes_insert_policy" ON quotes;
DROP POLICY IF EXISTS "quotes_update_policy" ON quotes;
DROP POLICY IF EXISTS "quotes_delete_policy" ON quotes;

-- Drop Quote Line Items 017 policies
DROP POLICY IF EXISTS "quote_line_items_select_policy" ON quote_line_items;
DROP POLICY IF EXISTS "quote_line_items_insert_policy" ON quote_line_items;
DROP POLICY IF EXISTS "quote_line_items_update_policy" ON quote_line_items;
DROP POLICY IF EXISTS "quote_line_items_delete_policy" ON quote_line_items;

-- =============================================================================
-- 031_fix_manager_delete_policy.sql
-- =============================================================================
-- Fix: RLS DELETE policies on all 17 business data tables only allowed
-- owner/admin, blocking managers from deleting any record (403).
-- This migration adds 'manager' to the allowed roles for DELETE operations.

DO $$
DECLARE
  t text;
  biz_tables text[] := ARRAY[
    'accounts','contacts','leads','opportunities','activities',
    'products','quotes','contract_templates','contracts',
    'suppliers','inventory_items','inventory_transactions',
    'purchase_orders','production_orders','financial_records',
    'document_templates','auto_documents'
  ];
BEGIN
  FOREACH t IN ARRAY biz_tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_delete', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE USING (
        public._rls_user_can_write_org(
          COALESCE(organization_id, tenant_id),
          ARRAY[''owner'',''admin'',''manager'']::public.app_role[]
        )
      )', t || '_delete', t
    );
  END LOOP;
END $$;

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

-- pg_cron schedule calls - only run if pg_cron is enabled
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('reset-daily-usage', '0 0 * * *',
      'UPDATE usage_tracking SET current_count = 0, period_start = now() WHERE resource_type IN (SELECT resource_type FROM plan_limits WHERE period = ''daily'')');
    PERFORM cron.schedule('reset-monthly-usage', '0 0 1 * *',
      'UPDATE usage_tracking SET current_count = 0, period_start = now() WHERE resource_type IN (SELECT resource_type FROM plan_limits WHERE period = ''monthly'')');
  END IF;
END $$;

-- Migration: 043_upgrade_plan_rpc.sql

CREATE OR REPLACE FUNCTION upgrade_organization_plan(
  p_organization_id UUID,
  p_new_plan TEXT
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check user permissions
  IF NOT EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE organization_id = p_organization_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin', 'platform_super_admin')
  ) THEN
    RAISE EXCEPTION 'Not authorized to change subscription plan';
  END IF;

  -- Update subscription
  UPDATE organization_subscriptions
  SET plan_type = p_new_plan, updated_at = now()
  WHERE organization_id = p_organization_id;

  IF NOT FOUND THEN
    INSERT INTO organization_subscriptions (organization_id, plan_type)
    VALUES (p_organization_id, p_new_plan);
  END IF;

  -- Reseed limits
  PERFORM seed_plan_limits_for_organization(p_organization_id, p_new_plan);

  RETURN true;
END;
$$;

-- =============================================================================
-- 033 PLAN LIMITS AND USAGE TRACKING
-- =============================================================================
-- Creates tables and RPCs for plan-based resource limits and usage tracking.
--
-- Author: Solanki
-- Date: 2026-03-23

SET search_path = public, extensions;

-- =============================================================================
-- 1. PLAN LIMITS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.plan_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  resource_type text NOT NULL,
  max_allowed bigint NOT NULL DEFAULT 0,
  period text DEFAULT 'total', -- 'total' | 'monthly' | 'daily'
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, resource_type)
);

COMMENT ON TABLE public.plan_limits IS 'Per-organization resource limits based on subscription plan';
COMMENT ON COLUMN public.plan_limits.resource_type IS 'Resource identifier: contacts, accounts, leads, opportunities, products, quotes, contracts, contract_templates, documents, document_templates, suppliers, purchase_orders, storage_mb, api_calls, esignatures';
COMMENT ON COLUMN public.plan_limits.period IS 'Limit period: total (lifetime), monthly (resets each month), daily (resets each day)';

-- =============================================================================
-- 2. USAGE TRACKING TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.usage_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  resource_type text NOT NULL,
  current_count bigint NOT NULL DEFAULT 0,
  period_start timestamptz,
  period_end timestamptz,
  last_incremented_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, resource_type)
);

COMMENT ON TABLE public.usage_tracking IS 'Tracks current resource usage per organization';

-- =============================================================================
-- 3. ENABLE RLS
-- =============================================================================

ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 4. RLS POLICIES â€” plan_limits
-- =============================================================================

-- SELECT: org members can see their own limits, super admin sees all
CREATE POLICY plan_limits_select ON public.plan_limits
FOR SELECT USING (
  public.app_is_platform_super_admin(auth.uid())
  OR public.app_user_has_organization_access(organization_id)
);

-- INSERT: super admin or org owner/admin only
CREATE POLICY plan_limits_insert ON public.plan_limits
FOR INSERT WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR public._rls_user_can_write_org(
    organization_id,
    ARRAY['owner','admin']::public.app_role[]
  )
);

-- UPDATE: super admin or org owner/admin only
CREATE POLICY plan_limits_update ON public.plan_limits
FOR UPDATE USING (
  public.app_is_platform_super_admin(auth.uid())
  OR public._rls_user_can_write_org(
    organization_id,
    ARRAY['owner','admin']::public.app_role[]
  )
) WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR public._rls_user_can_write_org(
    organization_id,
    ARRAY['owner','admin']::public.app_role[]
  )
);

-- DELETE: super admin only
CREATE POLICY plan_limits_delete ON public.plan_limits
FOR DELETE USING (
  public.app_is_platform_super_admin(auth.uid())
);

-- =============================================================================
-- 5. RLS POLICIES â€” usage_tracking
-- =============================================================================

CREATE POLICY usage_tracking_select ON public.usage_tracking
FOR SELECT USING (
  public.app_is_platform_super_admin(auth.uid())
  OR public.app_user_has_organization_access(organization_id)
);

CREATE POLICY usage_tracking_insert ON public.usage_tracking
FOR INSERT WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR public.app_user_has_organization_access(organization_id)
);

CREATE POLICY usage_tracking_update ON public.usage_tracking
FOR UPDATE USING (
  public.app_is_platform_super_admin(auth.uid())
  OR public.app_user_has_organization_access(organization_id)
) WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR public.app_user_has_organization_access(organization_id)
);

CREATE POLICY usage_tracking_delete ON public.usage_tracking
FOR DELETE USING (
  public.app_is_platform_super_admin(auth.uid())
);

-- =============================================================================
-- 6. RPC: check_plan_limit
-- =============================================================================

CREATE OR REPLACE FUNCTION public.check_plan_limit(
  p_organization_id uuid,
  p_resource_type text
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_max_allowed bigint;
  v_current_count bigint;
  v_period text;
  v_allowed boolean;
BEGIN
  -- Get the limit for this resource
  SELECT max_allowed, period INTO v_max_allowed, v_period
  FROM public.plan_limits
  WHERE organization_id = p_organization_id
    AND resource_type = p_resource_type;

  -- If no limit is set, allow (unlimited)
  IF v_max_allowed IS NULL THEN
    RETURN json_build_object(
      'allowed', true,
      'current_count', 0,
      'max_allowed', 999999999,
      'remaining', 999999999
    );
  END IF;

  -- Get current usage
  SELECT current_count INTO v_current_count
  FROM public.usage_tracking
  WHERE organization_id = p_organization_id
    AND resource_type = p_resource_type;

  v_current_count := COALESCE(v_current_count, 0);
  v_allowed := v_current_count < v_max_allowed;

  RETURN json_build_object(
    'allowed', v_allowed,
    'current_count', v_current_count,
    'max_allowed', v_max_allowed,
    'remaining', GREATEST(0, v_max_allowed - v_current_count)
  );
END;
$$;

-- =============================================================================
-- 7. RPC: increment_usage
-- =============================================================================

CREATE OR REPLACE FUNCTION public.increment_usage(
  p_organization_id uuid,
  p_resource_type text,
  p_amount bigint DEFAULT 1
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_max_allowed bigint;
  v_current_count bigint;
  v_new_count bigint;
BEGIN
  -- Get limit
  SELECT max_allowed INTO v_max_allowed
  FROM public.plan_limits
  WHERE organization_id = p_organization_id
    AND resource_type = p_resource_type;

  -- Get or create usage record
  INSERT INTO public.usage_tracking (organization_id, resource_type, current_count, last_incremented_at)
  VALUES (p_organization_id, p_resource_type, 0, now())
  ON CONFLICT (organization_id, resource_type) DO NOTHING;

  SELECT current_count INTO v_current_count
  FROM public.usage_tracking
  WHERE organization_id = p_organization_id
    AND resource_type = p_resource_type
  FOR UPDATE;

  v_current_count := COALESCE(v_current_count, 0);

  -- Check limit (if limit exists)
  IF v_max_allowed IS NOT NULL AND v_current_count + p_amount > v_max_allowed THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Plan limit exceeded for ' || p_resource_type,
      'current_count', v_current_count,
      'max_allowed', v_max_allowed
    );
  END IF;

  -- Increment
  v_new_count := v_current_count + p_amount;

  UPDATE public.usage_tracking
  SET current_count = v_new_count,
      last_incremented_at = now(),
      updated_at = now()
  WHERE organization_id = p_organization_id
    AND resource_type = p_resource_type;

  RETURN json_build_object(
    'success', true,
    'current_count', v_new_count,
    'max_allowed', COALESCE(v_max_allowed, 999999999)
  );
END;
$$;

-- =============================================================================
-- 8. RPC: decrement_usage
-- =============================================================================

CREATE OR REPLACE FUNCTION public.decrement_usage(
  p_organization_id uuid,
  p_resource_type text,
  p_amount bigint DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.usage_tracking
  SET current_count = GREATEST(0, current_count - p_amount),
      updated_at = now()
  WHERE organization_id = p_organization_id
    AND resource_type = p_resource_type;
END;
$$;

-- =============================================================================
-- 9. RPC: get_organization_usage
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_organization_usage(
  p_organization_id uuid
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_result json;
BEGIN
  SELECT json_object_agg(
    ut.resource_type,
    json_build_object(
      'current_count', ut.current_count,
      'max_allowed', COALESCE(pl.max_allowed, 999999999),
      'period', COALESCE(pl.period, 'total'),
      'usage_percent', CASE
        WHEN COALESCE(pl.max_allowed, 999999999) = 0 THEN 0
        ELSE ROUND((ut.current_count::numeric / COALESCE(pl.max_allowed, 999999999)::numeric) * 100, 1)
      END
    )
  ) INTO v_result
  FROM public.usage_tracking ut
  LEFT JOIN public.plan_limits pl
    ON pl.organization_id = ut.organization_id
    AND pl.resource_type = ut.resource_type
  WHERE ut.organization_id = p_organization_id;

  RETURN COALESCE(v_result, '{}'::json);
END;
$$;

-- =============================================================================
-- 10. SEED DEFAULT LIMITS FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION public.seed_plan_limits_for_organization(
  p_organization_id uuid,
  p_plan_type text DEFAULT 'foundation'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_limits jsonb;
BEGIN
  -- Define limits per plan
  CASE p_plan_type
    WHEN 'foundation' THEN
      v_limits := '{
        "contacts": {"max": 500, "period": "total"},
        "accounts": {"max": 100, "period": "total"},
        "leads": {"max": 200, "period": "total"},
        "opportunities": {"max": 100, "period": "total"},
        "products": {"max": 50, "period": "total"},
        "quotes": {"max": 50, "period": "monthly"},
        "documents": {"max": 100, "period": "total"},
        "document_templates": {"max": 10, "period": "total"},
        "storage_mb": {"max": 1024, "period": "total"},
        "api_calls": {"max": 1000, "period": "daily"},
        "esignatures": {"max": 10, "period": "monthly"}
      }'::jsonb;
    WHEN 'growth' THEN
      v_limits := '{
        "contacts": {"max": 5000, "period": "total"},
        "accounts": {"max": 1000, "period": "total"},
        "leads": {"max": 2000, "period": "total"},
        "opportunities": {"max": 1000, "period": "total"},
        "products": {"max": 500, "period": "total"},
        "quotes": {"max": 500, "period": "monthly"},
        "contracts": {"max": 100, "period": "total"},
        "contract_templates": {"max": 20, "period": "total"},
        "documents": {"max": 1000, "period": "total"},
        "document_templates": {"max": 100, "period": "total"},
        "storage_mb": {"max": 10240, "period": "total"},
        "api_calls": {"max": 10000, "period": "daily"},
        "esignatures": {"max": 100, "period": "monthly"}
      }'::jsonb;
    WHEN 'commercial' THEN
      v_limits := '{
        "contacts": {"max": 50000, "period": "total"},
        "accounts": {"max": 10000, "period": "total"},
        "leads": {"max": 20000, "period": "total"},
        "opportunities": {"max": 10000, "period": "total"},
        "products": {"max": 5000, "period": "total"},
        "quotes": {"max": 5000, "period": "monthly"},
        "contracts": {"max": 1000, "period": "total"},
        "contract_templates": {"max": 200, "period": "total"},
        "documents": {"max": 10000, "period": "total"},
        "document_templates": {"max": 1000, "period": "total"},
        "suppliers": {"max": 500, "period": "total"},
        "purchase_orders": {"max": 1000, "period": "total"},
        "storage_mb": {"max": 102400, "period": "total"},
        "api_calls": {"max": 100000, "period": "daily"},
        "esignatures": {"max": 1000, "period": "monthly"}
      }'::jsonb;
    WHEN 'enterprise' THEN
      v_limits := '{
        "contacts": {"max": 999999999, "period": "total"},
        "accounts": {"max": 999999999, "period": "total"},
        "leads": {"max": 999999999, "period": "total"},
        "opportunities": {"max": 999999999, "period": "total"},
        "products": {"max": 999999999, "period": "total"},
        "quotes": {"max": 999999999, "period": "monthly"},
        "contracts": {"max": 999999999, "period": "total"},
        "contract_templates": {"max": 999999999, "period": "total"},
        "documents": {"max": 999999999, "period": "total"},
        "document_templates": {"max": 999999999, "period": "total"},
        "suppliers": {"max": 999999999, "period": "total"},
        "purchase_orders": {"max": 999999999, "period": "total"},
        "storage_mb": {"max": 512000, "period": "total"},
        "api_calls": {"max": 999999999, "period": "daily"},
        "esignatures": {"max": 999999999, "period": "monthly"}
      }'::jsonb;
    ELSE
      -- Default to foundation
      PERFORM public.seed_plan_limits_for_organization(p_organization_id, 'foundation');
      RETURN;
  END CASE;

  -- Upsert limits
  INSERT INTO public.plan_limits (organization_id, resource_type, max_allowed, period)
  SELECT
    p_organization_id,
    key,
    (value->>'max')::bigint,
    value->>'period'
  FROM jsonb_each(v_limits)
  ON CONFLICT (organization_id, resource_type)
  DO UPDATE SET
    max_allowed = EXCLUDED.max_allowed,
    period = EXCLUDED.period,
    updated_at = now();

  -- Initialize usage tracking rows
  INSERT INTO public.usage_tracking (organization_id, resource_type, current_count)
  SELECT p_organization_id, key, 0
  FROM jsonb_each(v_limits)
  ON CONFLICT (organization_id, resource_type) DO NOTHING;
END;
$$;

-- =============================================================================
-- 11. GRANT EXECUTE ON RPCs
-- =============================================================================

GRANT EXECUTE ON FUNCTION public.check_plan_limit(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_usage(uuid, text, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_usage(uuid, text, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_organization_usage(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seed_plan_limits_for_organization(uuid, text) TO authenticated, service_role;

-- Grant table access
GRANT ALL ON public.plan_limits TO authenticated, service_role;
GRANT ALL ON public.usage_tracking TO authenticated, service_role;

-- Trigger that automatically synchronizes verification state from auth.users to organization_memberships.
-- This replaces the intermittent Edge Function calls from the frontend.

SET search_path = public, extensions;

CREATE OR REPLACE FUNCTION public.handle_user_verification_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if email was just confirmed
  IF (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL) THEN
    -- Update all pending verification memberships for this user
    UPDATE public.organization_memberships
    SET 
      account_state = CASE 
        WHEN role = 'client' THEN 'pending_approval'::public.account_state
        ELSE 'active'::public.account_state
      END,
      is_email_verified = true,
      updated_at = NOW()
    WHERE user_id = NEW.id
      AND account_state = 'pending_verification';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop if exists to ensure clean idempotent rollout
DROP TRIGGER IF EXISTS trg_sync_user_verification ON auth.users;

-- Recreate trigger
CREATE TRIGGER trg_sync_user_verification
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_verification_sync();

-- =============================================================================
-- Migration 047: Add-on Purchasing
-- Author: Sunny
-- Date: 2026-03-25
-- Description: Add-on purchases table, RLS policies, and purchase_addon RPC
-- =============================================================================

-- Add-on purchases table
CREATE TABLE IF NOT EXISTS public.addon_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  addon_key TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  purchase_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  expiry_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active', -- active, expired, cancelled
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, addon_key)
);

-- Enable RLS
ALTER TABLE public.addon_purchases ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY addon_purchases_select ON public.addon_purchases
FOR SELECT USING (
  public.app_is_platform_super_admin(auth.uid())
  OR public.app_user_has_organization_access(organization_id)
);

CREATE POLICY addon_purchases_insert ON public.addon_purchases
FOR INSERT WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR public._rls_user_can_write_org(organization_id, ARRAY['owner','admin']::public.app_role[])
);

CREATE POLICY addon_purchases_update ON public.addon_purchases
FOR UPDATE USING (
  public.app_is_platform_super_admin(auth.uid())
  OR public._rls_user_can_write_org(organization_id, ARRAY['owner','admin']::public.app_role[])
) WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR public._rls_user_can_write_org(organization_id, ARRAY['owner','admin']::public.app_role[])
);

-- RPC to purchase add-on
CREATE OR REPLACE FUNCTION public.purchase_addon(
  p_organization_id UUID,
  p_addon_key TEXT,
  p_quantity INTEGER DEFAULT 1
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_addon RECORD;
  v_purchase RECORD;
  v_resource_type TEXT;
  v_increment INTEGER;
BEGIN
  -- Map addon_key to resource_type and increment
  CASE p_addon_key
    WHEN 'extra_contacts_500' THEN
      v_resource_type := 'contacts';
      v_increment := 500;
    WHEN 'extra_storage_10gb' THEN
      v_resource_type := 'documents';
      v_increment := 100;
    WHEN 'extra_api_calls_5000' THEN
      v_resource_type := 'api_calls';
      v_increment := 5000;
    ELSE
      RETURN json_build_object(
        'success', false,
        'error', 'Unknown addon_key: ' || p_addon_key
      );
  END CASE;

  -- Check if addon already exists for this org
  SELECT * INTO v_addon FROM public.addon_purchases
  WHERE organization_id = p_organization_id AND addon_key = p_addon_key;

  IF FOUND THEN
    -- Update existing
    UPDATE public.addon_purchases
    SET quantity = quantity + p_quantity,
        updated_at = now()
    WHERE organization_id = p_organization_id AND addon_key = p_addon_key
    RETURNING * INTO v_purchase;
  ELSE
    -- Insert new
    INSERT INTO public.addon_purchases (organization_id, addon_key, quantity)
    VALUES (p_organization_id, p_addon_key, p_quantity)
    RETURNING * INTO v_purchase;
  END IF;

  -- Update plan_limits: increase max_allowed for the mapped resource
  UPDATE public.plan_limits
  SET max_allowed = max_allowed + (v_increment * p_quantity),
      updated_at = now()
  WHERE organization_id = p_organization_id
    AND resource_type = v_resource_type;

  RETURN json_build_object(
    'success', true,
    'purchase', json_build_object(
      'id', v_purchase.id,
      'addon_key', v_purchase.addon_key,
      'quantity', v_purchase.quantity
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.purchase_addon(UUID, TEXT, INTEGER) TO authenticated;
GRANT ALL ON public.addon_purchases TO authenticated, service_role;

-- =============================================================================
-- Migration 048: Billing Integration
-- Author: Sunny
-- Date: 2026-03-25
-- Description: billing_customers table, RLS policies, create_billing_customer
--              and get_billing_info RPCs
-- =============================================================================

-- Customer billing records
CREATE TABLE IF NOT EXISTS public.billing_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  razorpay_customer_id TEXT UNIQUE,
  razorpay_subscription_id TEXT,
  billing_email TEXT,
  billing_contact_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id)
);

-- Enable RLS
ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY billing_customers_select ON public.billing_customers
FOR SELECT USING (
  public.app_is_platform_super_admin(auth.uid())
  OR public.app_user_has_organization_access(organization_id)
);

CREATE POLICY billing_customers_insert ON public.billing_customers
FOR INSERT WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR public._rls_user_can_write_org(organization_id, ARRAY['owner','admin']::public.app_role[])
);

CREATE POLICY billing_customers_update ON public.billing_customers
FOR UPDATE USING (
  public.app_is_platform_super_admin(auth.uid())
  OR public._rls_user_can_write_org(organization_id, ARRAY['owner','admin']::public.app_role[])
) WITH CHECK (
  public.app_is_platform_super_admin(auth.uid())
  OR public._rls_user_can_write_org(organization_id, ARRAY['owner','admin']::public.app_role[])
);

-- RPC to create Razorpay customer
CREATE OR REPLACE FUNCTION public.create_billing_customer(
  p_organization_id UUID,
  p_email TEXT,
  p_name TEXT
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer RECORD;
BEGIN
  -- Check if already exists
  SELECT * INTO v_customer
  FROM public.billing_customers
  WHERE organization_id = p_organization_id;

  IF FOUND THEN
    RETURN json_build_object(
      'success', true,
      'customer_id', v_customer.razorpay_customer_id,
      'already_exists', true
    );
  END IF;

  -- Insert placeholder (actual Razorpay call would be in Edge Function)
  INSERT INTO public.billing_customers (
    organization_id,
    billing_email,
    billing_contact_name,
    razorpay_customer_id
  )
  VALUES (
    p_organization_id,
    p_email,
    p_name,
    'cust_' || gen_random_uuid()::text
  )
  RETURNING * INTO v_customer;

  RETURN json_build_object(
    'success', true,
    'customer_id', v_customer.razorpay_customer_id,
    'already_exists', false
  );
END;
$$;

-- RPC to get billing info
CREATE OR REPLACE FUNCTION public.get_billing_info(
  p_organization_id UUID
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_billing RECORD;
  v_subscription RECORD;
BEGIN
  SELECT * INTO v_billing
  FROM public.billing_customers
  WHERE organization_id = p_organization_id;

  SELECT * INTO v_subscription
  FROM public.organization_subscriptions
  WHERE organization_id = p_organization_id;

  RETURN json_build_object(
    'customer_id', v_billing.razorpay_customer_id,
    'billing_email', v_billing.billing_email,
    'billing_contact_name', v_billing.billing_contact_name,
    'plan_type', v_subscription.plan_type,
    'status', v_subscription.status,
    'subscription_start_date', v_subscription.subscription_start_date,
    'subscription_end_date', v_subscription.subscription_end_date
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_billing_customer(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_billing_info(UUID) TO authenticated;
GRANT ALL ON public.billing_customers TO authenticated, service_role;

-- ==========================================================
-- Supabase Storage Setup for SISWIT File Uploads
-- Run this in Supabase SQL Editor
-- ==========================================================

-- 1. Create storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  52428800,  -- 50MB
  ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/png', 'image/jpeg', 'image/jpg']
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contract-scans',
  'contract-scans',
  false,
  52428800,  -- 50MB
  ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/png', 'image/jpeg', 'image/jpg']
)
ON CONFLICT (id) DO NOTHING;

-- ==========================================================
-- 2. RLS Policies for 'documents' bucket
-- ==========================================================

-- SELECT: org members can read their own org's files
CREATE POLICY "documents_select_org_members" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM public.organization_memberships WHERE user_id = auth.uid()
    )
  );

-- INSERT: owner/admin/manager can upload
CREATE POLICY "documents_insert_managers" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM public.organization_memberships
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager')
    )
  );

-- DELETE: owner/admin can delete
CREATE POLICY "documents_delete_admins" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM public.organization_memberships
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- ==========================================================
-- 3. RLS Policies for 'contract-scans' bucket
-- ==========================================================

-- SELECT: org members can read their own org's files
CREATE POLICY "contract_scans_select_org_members" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'contract-scans'
    AND (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM public.organization_memberships WHERE user_id = auth.uid()
    )
  );

-- INSERT: owner/admin/manager can upload
CREATE POLICY "contract_scans_insert_managers" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'contract-scans'
    AND (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM public.organization_memberships
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager')
    )
  );

-- DELETE: owner/admin can delete
CREATE POLICY "contract_scans_delete_admins" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'contract-scans'
    AND (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM public.organization_memberships
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    is_read BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_org_created ON public.notifications(organization_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own notifications"
    ON public.notifications FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
    ON public.notifications FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications"
    ON public.notifications FOR DELETE
    USING (auth.uid() = user_id);

-- RPC: Mark single notification as read
CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE public.notifications
    SET is_read = true
    WHERE id = p_notification_id AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Mark all notifications as read for a user
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read(p_user_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE public.notifications
    SET is_read = true
    WHERE user_id = p_user_id AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Get unread count
CREATE OR REPLACE FUNCTION public.get_unread_count(p_user_id UUID)
RETURNS integer AS $$
DECLARE
    v_count integer;
BEGIN
    SELECT count(*) INTO v_count
    FROM public.notifications
    WHERE user_id = p_user_id AND is_read = false;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Create notification (server-side helper)
CREATE OR REPLACE FUNCTION public.create_notification(
    p_organization_id UUID,
    p_user_id UUID,
    p_type TEXT,
    p_title TEXT,
    p_message TEXT,
    p_link TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO public.notifications (
        organization_id,
        user_id,
        type,
        title,
        message,
        link,
        metadata
    ) VALUES (
        p_organization_id,
        p_user_id,
        p_type,
        p_title,
        p_message,
        p_link,
        p_metadata
    ) RETURNING id INTO v_id;
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Migration 051: Update Plan Names
-- Description: Update starter -> foundation, professional -> growth and update constraints

-- 1. Update organizations table
ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_plan_type_check;
UPDATE public.organizations SET plan_type = 'foundation' WHERE plan_type = 'starter';
UPDATE public.organizations SET plan_type = 'growth' WHERE plan_type = 'professional';
ALTER TABLE public.organizations ADD CONSTRAINT organizations_plan_type_check 
  CHECK (plan_type IN ('foundation', 'growth', 'enterprise', 'commercial'));

-- 2. Update organization_subscriptions table
ALTER TABLE public.organization_subscriptions DROP CONSTRAINT IF EXISTS organization_subscriptions_plan_type_check;
UPDATE public.organization_subscriptions SET plan_type = 'foundation' WHERE plan_type = 'starter';
UPDATE public.organization_subscriptions SET plan_type = 'growth' WHERE plan_type = 'professional';
ALTER TABLE public.organization_subscriptions ADD CONSTRAINT organization_subscriptions_plan_type_check 
  CHECK (plan_type IN ('foundation', 'growth', 'enterprise', 'commercial'));

-- Migration 052: Fix Upgrade Plan RPC
-- Description: Update upgrade_organization_plan to also update organizations 
--              and organization_subscriptions modules

CREATE OR REPLACE FUNCTION public.upgrade_organization_plan(
  p_organization_id UUID,
  p_new_plan TEXT
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_users INTEGER;
  v_max_storage BIGINT;
  v_module_crm BOOLEAN := TRUE;
  v_module_cpq BOOLEAN := TRUE;
  v_module_docs BOOLEAN := TRUE;
  v_module_clm BOOLEAN := FALSE;
  v_module_erp BOOLEAN := FALSE;
BEGIN
  -- 1. Check user permissions
  IF NOT EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE organization_id = p_organization_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin', 'platform_super_admin')
  ) THEN
    RAISE EXCEPTION 'Not authorized to change subscription plan';
  END IF;

  -- 2. Determine limits and modules based on plan
  IF p_new_plan = 'foundation' THEN
    v_max_users := 5;
    v_max_storage := 1024;
  ELSIF p_new_plan = 'growth' THEN
    v_max_users := 25;
    v_max_storage := 10240;
    v_module_clm := TRUE;
  ELSIF p_new_plan = 'commercial' THEN
    v_max_users := 100;
    v_max_storage := 102400;
    v_module_clm := TRUE;
    v_module_erp := TRUE;
  ELSIF p_new_plan = 'enterprise' THEN
    v_max_users := 999999;
    v_max_storage := 512000;
    v_module_clm := TRUE;
    v_module_erp := TRUE;
  ELSE
    RAISE EXCEPTION 'Invalid plan type: %', p_new_plan;
  END IF;

  -- 3. Update organizations table
  UPDATE public.organizations
  SET 
    plan_type = p_new_plan,
    max_users = v_max_users,
    max_storage_mb = v_max_storage,
    updated_at = now()
  WHERE id = p_organization_id;

  -- 4. Update organization_subscriptions table (upsert)
  INSERT INTO public.organization_subscriptions (
    organization_id, 
    plan_type, 
    module_crm, 
    module_cpq, 
    module_clm, 
    module_erp, 
    module_documents,
    updated_at
  )
  VALUES (
    p_organization_id, 
    p_new_plan, 
    v_module_crm, 
    v_module_cpq, 
    v_module_clm, 
    v_module_erp, 
    v_module_docs,
    now()
  )
  ON CONFLICT (organization_id) DO UPDATE SET
    plan_type = EXCLUDED.plan_type,
    module_crm = EXCLUDED.module_crm,
    module_cpq = EXCLUDED.module_cpq,
    module_clm = EXCLUDED.module_clm,
    module_erp = EXCLUDED.module_erp,
    module_documents = EXCLUDED.module_documents,
    updated_at = EXCLUDED.updated_at;

  -- 5. Reseed limits in plan_limits table
  PERFORM public.seed_plan_limits_for_organization(p_organization_id, p_new_plan);

  RETURN true;
END;
$$;

-- Migration 053: Add indices for billing and usage performance

-- Improve membership count queries
CREATE INDEX IF NOT EXISTS idx_organization_memberships_org_id ON public.organization_memberships(organization_id);

-- Improve subscription lookups
CREATE INDEX IF NOT EXISTS idx_organization_subscriptions_org_id ON public.organization_subscriptions(organization_id);

-- Improve billing info lookups
CREATE INDEX IF NOT EXISTS idx_billing_customers_org_id ON public.billing_customers(organization_id);

-- Improve usage and limit lookups
CREATE INDEX IF NOT EXISTS idx_plan_limits_org_id ON public.plan_limits(organization_id);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_org_id ON public.usage_tracking(organization_id);

