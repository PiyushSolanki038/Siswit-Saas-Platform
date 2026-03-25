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
