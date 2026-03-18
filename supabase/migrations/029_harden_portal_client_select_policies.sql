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
