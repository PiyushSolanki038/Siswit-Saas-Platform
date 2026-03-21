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
