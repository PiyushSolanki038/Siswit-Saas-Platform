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
COMMENT ON COLUMN public.plan_limits.resource_type IS 'Resource identifier: contacts, accounts, leads, opportunities, products, quotes, etc.';
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
-- 4. RLS POLICIES — plan_limits
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
-- 5. RLS POLICIES — usage_tracking
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
