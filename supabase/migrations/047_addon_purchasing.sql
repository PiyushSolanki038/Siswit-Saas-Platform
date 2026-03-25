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
