# SISWIT — Remaining Implementation Guide

```
Author: Sunny
Date: 2026-03-24
Status: PHASED IMPLEMENTATION
```

This document outlines the remaining implementation tasks organized in phases, with detailed code changes and file modifications required.

---

## Table of Contents

1. [Phase 1: Database Seed (Critical)](#phase-1-database-seed-critical)
2. [Phase 2: Add-on Purchasing](#phase-2-add-on-purchasing)
3. [Phase 3: Billing Integration](#phase-3-billing-integration)

---

## Phase 1: Database Seed (Critical) ✅ PRIORITY HIGH

### Overview
Seed plan limits for existing organizations in the database.

### Step 1.1: Execute SQL

Run the following SQL in Supabase SQL Editor:

```sql
-- Seed limits for all existing organizations
SELECT seed_plan_limits_for_organization(id, COALESCE(plan_type, 'foundation')) 
FROM organizations;
```

### Verification

```sql
-- Check if limits were seeded
SELECT organization_id, resource_type, max_allowed 
FROM plan_limits 
ORDER BY organization_id, resource_type 
LIMIT 20;
```

---

## Phase 2: Add-on Purchasing

### Overview
Implement add-on purchasing to allow organizations to purchase additional resources beyond their plan limits.

### Step 2.1: Create Database Migration

**File:** `supabase/migrations/047_addon_purchasing.sql`

```sql
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
    UNIQUE(organization_id, addon_key)
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
BEGIN
    -- Get addon details
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
    
    -- Update plan_limits based on addon
    -- This would add to the max_allowed for the resource
    -- Implementation depends on ADD_ONS config in frontend
    
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
```

### Step 2.2: Create Frontend API Function

**File:** `src/core/api/addons.ts`

```typescript
import { supabase } from "@/core/api/client";

export interface AddonPurchase {
  id: string;
  organization_id: string;
  addon_key: string;
  quantity: number;
  purchase_date: string;
  expiry_date: string | null;
  status: string;
}

export async function purchaseAddon(
  organizationId: string,
  addonKey: string,
  quantity: number = 1
): Promise<{ success: boolean; purchase?: AddonPurchase; error?: string }> {
  const { data, error } = await supabase.rpc("purchase_addon", {
    p_organization_id: organizationId,
    p_addon_key: addonKey,
    p_quantity: quantity,
  });

  if (error) {
    console.error("Failed to purchase addon:", error);
    return { success: false, error: error.message };
  }

  return { success: true, purchase: data?.purchase };
}

export async function getOrganizationAddons(
  organizationId: string
): Promise<AddonPurchase[]> {
  const { data, error } = await supabase
    .from("addon_purchases")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("status", "active");

  if (error) {
    console.error("Failed to fetch addons:", error);
    return [];
  }

  return data || [];
}
```

### Step 2.3: Update usePlanLimits Hook

**File:** `src/core/hooks/usePlanLimits.ts`

Add method to check addon-augmented limits:

```typescript
// Add to UsePlanLimitsReturn interface:
interface UsePlanLimitsReturn {
  // ... existing members
  /** Get effective limit including addons for a resource */
  getEffectiveLimit: (resource: ResourceType) => number;
}

// Add implementation:
const getEffectiveLimit = useCallback(
  (resource: ResourceType): number => {
    const baseLimit = usage[resource]?.max_allowed ?? 0;
    // Add addon calculations here based on addon purchases
    return baseLimit;
  },
  [usage]
);

// Return in hook:
return {
  // ... existing returns
  getEffectiveLimit,
};
```

---

## Phase 3: Billing Integration

### Overview
Integrate with payment provider (Razorpay) for billing management.

### Step 3.1: Create Payment Integration RPCs

**File:** `supabase/migrations/048_billing_integration.sql`

```sql
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
    UNIQUE(organization_id)
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
```

### Step 3.2: Create Billing Hook

**File:** `src/workspaces/organization/hooks/useBilling.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/core/api/client";
import { useOrganization } from "@/workspaces/organization/hooks/useOrganization";
import { toast } from "sonner";

interface BillingInfo {
  customer_id: string | null;
  billing_email: string | null;
  billing_contact_name: string | null;
  plan_type: string | null;
  status: string | null;
  subscription_start_date: string | null;
  subscription_end_date: string | null;
}

export function useBillingInfo() {
  const { organization } = useOrganization();
  const organizationId = organization?.id;

  return useQuery({
    queryKey: ["billing_info", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      if (!organizationId) return null;

      const { data, error } = await supabase.rpc("get_billing_info", {
        p_organization_id: organizationId,
      });

      if (error) {
        console.error("Failed to fetch billing info:", error);
        throw error;
      }

      return data as BillingInfo;
    },
  });
}

export function useCreateBillingCustomer() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async ({ email, name }: { email: string; name: string }) => {
      if (!organization?.id) throw new Error("No organization");

      const { data, error } = await supabase.rpc("create_billing_customer", {
        p_organization_id: organization.id,
        p_email: email,
        p_name: name,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing_info"] });
      toast.success("Billing account created successfully");
    },
    onError: (error) => {
      toast.error("Failed to create billing account");
      console.error(error);
    },
  });
}
```

### Step 3.3: Create Billing Page

**File:** `src/workspaces/organization/pages/OrganizationBillingPage.tsx`

```tsx
import { useState } from "react";
import { useBillingInfo, useCreateBillingCustomer } from "@/workspaces/organization/hooks/useBilling";
import { Button } from "@/ui/shadcn/button";
import { Input } from "@/ui/shadcn/input";
import { Label } from "@/ui/shadcn/label";
import { Loader2, CreditCard } from "lucide-react";
import { toast } from "sonner";

export default function OrganizationBillingPage() {
  const { data: billingInfo, isLoading } = useBillingInfo();
  const createCustomer = useCreateBillingCustomer();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  const handleSetupBilling = async () => {
    if (!email || !name) {
      toast.error("Please fill in all fields");
      return;
    }
    await createCustomer.mutateAsync({ email, name });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="text-muted-foreground">Manage your subscription and billing</p>
      </div>

      {/* Current Plan */}
      <div className="rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">Current Plan</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold capitalize">{billingInfo?.plan_type || "Free"}</p>
            <p className="text-muted-foreground">{billingInfo?.status || "N/A"}</p>
          </div>
          <Button variant="outline">Change Plan</Button>
        </div>
      </div>

      {/* Billing Details */}
      <div className="rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">Billing Details</h2>
        
        {billingInfo?.customer_id ? (
          <div className="space-y-2">
            <p><strong>Customer ID:</strong> {billingInfo.customer_id}</p>
            <p><strong>Email:</strong> {billingInfo.billing_email}</p>
            <p><strong>Contact:</strong> {billingInfo.billing_contact_name}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label htmlFor="email">Billing Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="billing@company.com"
              />
            </div>
            <div>
              <Label htmlFor="name">Billing Contact Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value.value)}
                placeholder="John Doe"
              />
            </div>
            <Button 
              onClick={handleSetupBilling}
              disabled={createCustomer.isPending}
            >
              {createCustomer.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <CreditCard className="mr-2 h-4 w-4" />
              Setup Billing
            </Button>
          </div>
        )}
      </div>

      {/* Subscription Dates */}
      <div className="rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">Subscription Period</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Start Date</p>
            <p>{billingInfo?.subscription_start_date || "N/A"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">End Date</p>
            <p>{billingInfo?.subscription_end_date || "N/A"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Step 3.4: Add Billing Route

**File:** `src/app/App.tsx`

Add route:

```tsx
const Billing = lazy(() => import("@/workspaces/organization/pages/OrganizationBillingPage"));
```

Add route path:

```tsx
<Route path="/organization/billing" element={<Billing />} />
```

---

## Implementation Order

| Phase | Task | Priority | Est. Effort |
|-------|------|----------|--------------|
| 1 | Seed existing organizations | HIGH | 5 min |
| 2 | Add-on purchasing | MEDIUM | 2-4 hours |
| 3 | Billing integration | MEDIUM | 4-8 hours |

---

## Files Summary

### New Files to Create

| Phase | File Path | Purpose |
|-------|-----------|---------|
| 2 | `supabase/migrations/047_addon_purchasing.sql` | Add-on purchase table and RPC |
| 2 | `src/core/api/addons.ts` | Add-on API functions |
| 3 | `supabase/migrations/048_billing_integration.sql` | Billing customer table and RPCs |
| 3 | `src/workspaces/organization/hooks/useBilling.ts` | Billing React Query hooks |
| 3 | `src/workspaces/organization/pages/OrganizationBillingPage.tsx` | Billing management page |

### Existing Files to Modify

| File | Modification |
|------|--------------|
| `src/core/hooks/usePlanLimits.ts` | Add getEffectiveLimit method |
| `src/app/App.tsx` | Add billing route |

---

*Created: 2026-03-24*
*Author: Sunny*
