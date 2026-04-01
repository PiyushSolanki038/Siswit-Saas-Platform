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
