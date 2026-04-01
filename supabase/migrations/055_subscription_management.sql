-- =============================================================================
-- Migration 055: Subscription Management System
-- Author: Solanki
-- Date: 2026-03-30
-- Description: Adds trial/subscription management columns, subscription_events
--              table, and RPCs for trial, activation, cancellation, and status.
-- =============================================================================

-- ============================================================================
-- 1. ALTER organization_subscriptions — add new columns
-- ============================================================================

-- Convert trial dates from date → timestamptz
ALTER TABLE public.organization_subscriptions
  ALTER COLUMN trial_start_date TYPE timestamptz USING trial_start_date::timestamptz;

ALTER TABLE public.organization_subscriptions
  ALTER COLUMN trial_end_date TYPE timestamptz USING trial_end_date::timestamptz;

-- Add new columns
ALTER TABLE public.organization_subscriptions
  ADD COLUMN IF NOT EXISTS is_trial boolean NOT NULL DEFAULT true;

ALTER TABLE public.organization_subscriptions
  ADD COLUMN IF NOT EXISTS razorpay_subscription_id text;

ALTER TABLE public.organization_subscriptions
  ADD COLUMN IF NOT EXISTS razorpay_plan_id text;

ALTER TABLE public.organization_subscriptions
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

ALTER TABLE public.organization_subscriptions
  ADD COLUMN IF NOT EXISTS cancel_reason text;

ALTER TABLE public.organization_subscriptions
  ADD COLUMN IF NOT EXISTS subscription_start_date timestamptz;

ALTER TABLE public.organization_subscriptions
  ADD COLUMN IF NOT EXISTS subscription_end_date timestamptz;

-- ============================================================================
-- 2. CREATE subscription_events table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.subscription_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN (
    'trial_started',
    'trial_ended',
    'subscription_created',
    'payment_success',
    'payment_failed',
    'subscription_cancelled',
    'plan_upgraded',
    'plan_downgraded'
  )),
  plan_type text,
  amount integer,
  razorpay_payment_id text,
  razorpay_subscription_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_subscription_events_org_id
  ON public.subscription_events(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_subscription_events_type
  ON public.subscription_events(event_type);

-- ============================================================================
-- 3. RLS for subscription_events
-- ============================================================================

ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

-- Org members can SELECT their own events
CREATE POLICY subscription_events_select ON public.subscription_events
  FOR SELECT USING (
    public.app_is_platform_super_admin(auth.uid())
    OR public.app_user_has_organization_access(organization_id)
  );

-- Only service_role can INSERT (used by webhook edge function)
CREATE POLICY subscription_events_insert_service ON public.subscription_events
  FOR INSERT WITH CHECK (
    current_setting('role', true) = 'service_role'
    OR public.app_is_platform_super_admin(auth.uid())
  );

-- Only service_role can UPDATE
CREATE POLICY subscription_events_update_service ON public.subscription_events
  FOR UPDATE USING (
    current_setting('role', true) = 'service_role'
    OR public.app_is_platform_super_admin(auth.uid())
  );

-- Add service_role INSERT policy on organization_subscriptions for webhook
CREATE POLICY org_subs_insert_service ON public.organization_subscriptions
  FOR INSERT WITH CHECK (
    current_setting('role', true) = 'service_role'
  );

CREATE POLICY org_subs_update_service ON public.organization_subscriptions
  FOR UPDATE USING (
    current_setting('role', true) = 'service_role'
  );

-- Grant permissions
GRANT ALL ON public.subscription_events TO authenticated, service_role;

-- ============================================================================
-- 4. RPC: start_trial
-- ============================================================================

CREATE OR REPLACE FUNCTION public.start_trial(
  p_org_id uuid,
  p_plan_type text DEFAULT 'foundation'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trial_start timestamptz := now();
  v_trial_end timestamptz := now() + interval '14 days';
  v_sub record;
BEGIN
  -- Validate plan type
  IF p_plan_type NOT IN ('foundation', 'growth', 'commercial', 'enterprise') THEN
    RAISE EXCEPTION 'Invalid plan type: %', p_plan_type;
  END IF;

  -- Upsert subscription with trial info
  INSERT INTO public.organization_subscriptions (
    organization_id,
    plan_type,
    status,
    is_trial,
    trial_start_date,
    trial_end_date,
    subscription_start_date,
    updated_at
  )
  VALUES (
    p_org_id,
    p_plan_type,
    'trial',
    true,
    v_trial_start,
    v_trial_end,
    v_trial_start,
    now()
  )
  ON CONFLICT (organization_id) DO UPDATE SET
    plan_type = EXCLUDED.plan_type,
    status = 'trial',
    is_trial = true,
    trial_start_date = EXCLUDED.trial_start_date,
    trial_end_date = EXCLUDED.trial_end_date,
    subscription_start_date = EXCLUDED.subscription_start_date,
    cancelled_at = NULL,
    cancel_reason = NULL,
    updated_at = now()
  RETURNING * INTO v_sub;

  -- Seed plan limits
  PERFORM public.seed_plan_limits_for_organization(p_org_id, p_plan_type);

  -- Log trial started event
  INSERT INTO public.subscription_events (
    organization_id,
    event_type,
    plan_type,
    metadata
  )
  VALUES (
    p_org_id,
    'trial_started',
    p_plan_type,
    jsonb_build_object(
      'trial_start', v_trial_start,
      'trial_end', v_trial_end,
      'trial_days', 14
    )
  );

  RETURN json_build_object(
    'success', true,
    'trial_start', v_trial_start,
    'trial_end', v_trial_end,
    'plan_type', p_plan_type
  );
END;
$$;

-- ============================================================================
-- 5. RPC: activate_subscription
-- ============================================================================

CREATE OR REPLACE FUNCTION public.activate_subscription(
  p_org_id uuid,
  p_plan_type text,
  p_razorpay_sub_id text,
  p_razorpay_plan_id text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub record;
  v_max_users integer;
  v_max_storage bigint;
  v_module_crm boolean := true;
  v_module_cpq boolean := true;
  v_module_docs boolean := true;
  v_module_clm boolean := false;
  v_module_erp boolean := false;
BEGIN
  -- Validate plan type
  IF p_plan_type NOT IN ('foundation', 'growth', 'commercial', 'enterprise') THEN
    RAISE EXCEPTION 'Invalid plan type: %', p_plan_type;
  END IF;

  -- Determine modules/limits based on plan
  IF p_plan_type = 'foundation' THEN
    v_max_users := 5; v_max_storage := 1024;
  ELSIF p_plan_type = 'growth' THEN
    v_max_users := 25; v_max_storage := 10240;
    v_module_clm := true;
  ELSIF p_plan_type = 'commercial' THEN
    v_max_users := 100; v_max_storage := 102400;
    v_module_clm := true; v_module_erp := true;
  ELSIF p_plan_type = 'enterprise' THEN
    v_max_users := 999999; v_max_storage := 512000;
    v_module_clm := true; v_module_erp := true;
  END IF;

  -- Update organization_subscriptions
  UPDATE public.organization_subscriptions SET
    plan_type = p_plan_type,
    status = 'active',
    is_trial = false,
    razorpay_subscription_id = p_razorpay_sub_id,
    razorpay_plan_id = p_razorpay_plan_id,
    subscription_start_date = now(),
    subscription_end_date = now() + interval '30 days',
    cancelled_at = NULL,
    cancel_reason = NULL,
    module_crm = v_module_crm,
    module_cpq = v_module_cpq,
    module_clm = v_module_clm,
    module_erp = v_module_erp,
    module_documents = v_module_docs,
    updated_at = now()
  WHERE organization_id = p_org_id
  RETURNING * INTO v_sub;

  -- If no row existed, insert
  IF NOT FOUND THEN
    INSERT INTO public.organization_subscriptions (
      organization_id, plan_type, status, is_trial,
      razorpay_subscription_id, razorpay_plan_id,
      subscription_start_date, subscription_end_date,
      module_crm, module_cpq, module_clm, module_erp, module_documents
    ) VALUES (
      p_org_id, p_plan_type, 'active', false,
      p_razorpay_sub_id, p_razorpay_plan_id,
      now(), now() + interval '30 days',
      v_module_crm, v_module_cpq, v_module_clm, v_module_erp, v_module_docs
    ) RETURNING * INTO v_sub;
  END IF;

  -- Update organizations table
  UPDATE public.organizations SET
    plan_type = p_plan_type,
    status = 'active',
    max_users = v_max_users,
    max_storage_mb = v_max_storage,
    updated_at = now()
  WHERE id = p_org_id;

  -- Reseed plan limits
  PERFORM public.seed_plan_limits_for_organization(p_org_id, p_plan_type);

  -- Log activation event
  INSERT INTO public.subscription_events (
    organization_id,
    event_type,
    plan_type,
    razorpay_subscription_id,
    metadata
  ) VALUES (
    p_org_id,
    'subscription_created',
    p_plan_type,
    p_razorpay_sub_id,
    jsonb_build_object(
      'razorpay_plan_id', p_razorpay_plan_id,
      'activated_at', now()
    )
  );

  RETURN json_build_object(
    'success', true,
    'plan_type', p_plan_type,
    'status', 'active',
    'subscription_id', v_sub.id
  );
END;
$$;

-- ============================================================================
-- 6. RPC: cancel_subscription
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cancel_subscription(
  p_org_id uuid,
  p_reason text DEFAULT ''
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_plan text;
BEGIN
  -- Get current plan before cancellation
  SELECT plan_type INTO v_old_plan
  FROM public.organization_subscriptions
  WHERE organization_id = p_org_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No subscription found for organization %', p_org_id;
  END IF;

  -- Update subscription: cancel and downgrade
  UPDATE public.organization_subscriptions SET
    status = 'cancelled',
    cancelled_at = now(),
    cancel_reason = p_reason,
    is_trial = false,
    updated_at = now()
  WHERE organization_id = p_org_id;

  -- Downgrade organization to foundation
  UPDATE public.organizations SET
    plan_type = 'foundation',
    status = 'active',
    max_users = 5,
    max_storage_mb = 1024,
    updated_at = now()
  WHERE id = p_org_id;

  -- Reseed plan limits to foundation
  PERFORM public.seed_plan_limits_for_organization(p_org_id, 'foundation');

  -- Log cancellation event
  INSERT INTO public.subscription_events (
    organization_id,
    event_type,
    plan_type,
    metadata
  ) VALUES (
    p_org_id,
    'subscription_cancelled',
    v_old_plan,
    jsonb_build_object(
      'reason', p_reason,
      'cancelled_at', now(),
      'downgraded_to', 'foundation'
    )
  );

  RETURN json_build_object(
    'success', true,
    'cancelled_plan', v_old_plan,
    'downgraded_to', 'foundation'
  );
END;
$$;

-- ============================================================================
-- 7. RPC: get_subscription_status
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_subscription_status(
  p_org_id uuid
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub record;
  v_billing record;
  v_trial_remaining integer;
BEGIN
  -- Get subscription
  SELECT * INTO v_sub
  FROM public.organization_subscriptions
  WHERE organization_id = p_org_id;

  -- Get billing customer
  SELECT razorpay_customer_id INTO v_billing
  FROM public.billing_customers
  WHERE organization_id = p_org_id;

  -- Calculate trial days remaining
  IF v_sub.is_trial AND v_sub.trial_end_date IS NOT NULL THEN
    v_trial_remaining := GREATEST(0,
      EXTRACT(DAY FROM (v_sub.trial_end_date - now()))::integer
    );
  ELSE
    v_trial_remaining := NULL;
  END IF;

  RETURN json_build_object(
    'plan_type', COALESCE(v_sub.plan_type, 'foundation'),
    'status', COALESCE(v_sub.status, 'trial'),
    'is_trial', COALESCE(v_sub.is_trial, true),
    'trial_start_date', v_sub.trial_start_date,
    'trial_end_date', v_sub.trial_end_date,
    'trial_days_remaining', v_trial_remaining,
    'razorpay_subscription_id', v_sub.razorpay_subscription_id,
    'subscription_start_date', v_sub.subscription_start_date,
    'subscription_end_date', v_sub.subscription_end_date,
    'cancelled_at', v_sub.cancelled_at,
    'cancel_reason', v_sub.cancel_reason,
    'billing_customer_id', v_billing.razorpay_customer_id
  );
END;
$$;

-- ============================================================================
-- 8. Update signup_organization to auto-start trial
-- ============================================================================

-- Patch the existing signup_and_create_organization function to call start_trial
-- This wraps the trial start into organization creation flow.
-- Note: The existing function in 014 inserts into organization_subscriptions.
-- We add a separate trigger/call instead of modifying that function,
-- so this works even if the signup RPC was already applied.

CREATE OR REPLACE FUNCTION public.auto_start_trial_on_subscription_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only auto-start trial for new subscriptions that don't already have trial dates
  IF NEW.trial_start_date IS NULL THEN
    NEW.is_trial := true;
    NEW.trial_start_date := now();
    NEW.trial_end_date := now() + interval '14 days';
    NEW.status := 'trial';
    NEW.subscription_start_date := now();

    -- Log trial started event
    INSERT INTO public.subscription_events (
      organization_id,
      event_type,
      plan_type,
      metadata
    ) VALUES (
      NEW.organization_id,
      'trial_started',
      NEW.plan_type,
      jsonb_build_object(
        'trial_start', now(),
        'trial_end', now() + interval '14 days',
        'trial_days', 14,
        'auto_started', true
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_start_trial ON public.organization_subscriptions;
CREATE TRIGGER trg_auto_start_trial
  BEFORE INSERT ON public.organization_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_start_trial_on_subscription_insert();

-- ============================================================================
-- 9. Grant permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.start_trial(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.activate_subscription(uuid, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_subscription(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_subscription_status(uuid) TO authenticated, service_role;
