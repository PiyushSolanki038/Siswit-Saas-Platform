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
