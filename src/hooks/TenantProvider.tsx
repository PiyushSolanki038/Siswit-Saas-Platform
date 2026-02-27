"use client";

import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { useImpersonation } from "@/hooks/useImpersonation";
import { TenantContext, type TenantMembership } from "@/hooks/tenant-context";
import { isModuleEnabled, type ModuleType, type Tenant, type TenantSubscription } from "@/types/tenant";
import { isPlatformRole } from "@/types/roles";

type TenantRow = Database["public"]["Tables"]["tenants"]["Row"];
type TenantSubscriptionRow = Database["public"]["Tables"]["tenant_subscriptions"]["Row"];
type TenantMembershipRow = Database["public"]["Tables"]["tenant_users"]["Row"];
type TenantMembershipWithTenant = TenantMembershipRow & { tenant: TenantRow | null };

function mapTenant(row: TenantRow): Tenant {
  return row as unknown as Tenant;
}

function mapSubscription(row: TenantSubscriptionRow | null): TenantSubscription | null {
  if (!row) return null;
  return row as unknown as TenantSubscription;
}

function mapMembership(row: TenantMembershipWithTenant): TenantMembership {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    user_id: row.user_id,
    role: row.role,
    department: row.department,
    is_active: Boolean(row.is_active),
    is_approved: Boolean(row.is_approved),
    tenant: row.tenant ? mapTenant(row.tenant) : null,
  };
}

export function TenantProvider({ children }: { children: ReactNode }) {
  const { user, role, loading: authLoading } = useAuth();
  const { state: impersonation } = useImpersonation();

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [subscription, setSubscription] = useState<TenantSubscription | null>(null);
  const [memberships, setMemberships] = useState<TenantMembership[]>([]);
  const [tenantLoading, setTenantLoading] = useState(true);
  const fetchCount = useRef(0);

  const fetchSubscriptionByTenant = useCallback(async (tenantId: string) => {
    const result = await supabase.from("tenant_subscriptions").select("*").eq("tenant_id", tenantId).maybeSingle();
    if (result.error) return null;
    return mapSubscription(result.data as TenantSubscriptionRow | null);
  }, []);

  const fetchTenantData = useCallback(
    async (userId: string) => {
      const currentFetch = ++fetchCount.current;
      try {
        if (isPlatformRole(role) && impersonation.active && impersonation.tenantSlug) {
          const tenantResult = await supabase
            .from("tenants")
            .select("*")
            .eq("slug", impersonation.tenantSlug)
            .maybeSingle();

          if (currentFetch !== fetchCount.current) return;

          if (tenantResult.data) {
            const nextTenant = mapTenant(tenantResult.data as TenantRow);
            setTenant(nextTenant);
            setMemberships([]);
            setSubscription(await fetchSubscriptionByTenant(nextTenant.id));
            return;
          }
        }

        if (currentFetch !== fetchCount.current) return;

        const membershipsResult = await supabase
          .from("tenant_users")
          .select("id, tenant_id, user_id, role, department, is_active, is_approved, tenant:tenants(*)")
          .eq("user_id", userId)
          .eq("is_active", true);

        if (currentFetch !== fetchCount.current) return;

        if (membershipsResult.error) {
          setMemberships([]);
          setTenant(null);
          setSubscription(null);
          return;
        }

        const rawMemberships = (membershipsResult.data ?? []) as unknown as TenantMembershipWithTenant[];
        const mappedMemberships = rawMemberships.map(mapMembership);
        setMemberships(mappedMemberships);

        if (mappedMemberships.length === 0) {
          setTenant(null);
          setSubscription(null);
          return;
        }

        const firstTenant = mappedMemberships[0].tenant;
        if (!firstTenant) {
          setTenant(null);
          setSubscription(null);
          return;
        }

        setTenant(firstTenant);
        setSubscription(await fetchSubscriptionByTenant(firstTenant.id));
      } catch {
        if (currentFetch !== fetchCount.current) return;
        setMemberships([]);
        setTenant(null);
        setSubscription(null);
      } finally {
        if (currentFetch === fetchCount.current) {
          setTenantLoading(false);
        }
      }
    },
    [fetchSubscriptionByTenant, impersonation.active, impersonation.tenantSlug, role],
  );

  useEffect(() => {
    if (!authLoading && user) {
      setTenantLoading(true);
      void fetchTenantData(user.id);
      return;
    }

    if (!authLoading && !user) {
      setTenant(null);
      setSubscription(null);
      setMemberships([]);
      setTenantLoading(false);
    }
  }, [authLoading, fetchTenantData, user]);

  const switchTenant = useCallback(
    async (tenantId: string) => {
      const membership = memberships.find((item) => item.tenant_id === tenantId);
      if (!membership || !membership.tenant) {
        throw new Error("You don't have access to this tenant");
      }

      setTenant(membership.tenant);
      setSubscription(await fetchSubscriptionByTenant(tenantId));
    },
    [fetchSubscriptionByTenant, memberships],
  );

  const switchTenantBySlug = useCallback(
    async (tenantSlug: string) => {
      const membership = memberships.find((item) => item.tenant?.slug === tenantSlug);
      if (membership?.tenant_id) {
        await switchTenant(membership.tenant_id);
        return;
      }

      if (isPlatformRole(role)) {
        const tenantResult = await supabase.from("tenants").select("*").eq("slug", tenantSlug).maybeSingle();
        if (!tenantResult.data) {
          throw new Error("Tenant not found");
        }
        const nextTenant = mapTenant(tenantResult.data as TenantRow);
        setTenant(nextTenant);
        setSubscription(await fetchSubscriptionByTenant(nextTenant.id));
        return;
      }

      throw new Error("You don't have access to this tenant");
    },
    [fetchSubscriptionByTenant, memberships, role, switchTenant],
  );

  const hasModule = useCallback(
    (module: ModuleType): boolean => {
      return isModuleEnabled(subscription, module);
    },
    [subscription],
  );

  const enabledModules: ModuleType[] = useMemo(() => {
    if (!subscription) {
      return ["crm", "clm", "cpq", "erp", "documents"];
    }

    return [
      ...(subscription.module_crm ? (["crm"] as const) : []),
      ...(subscription.module_clm ? (["clm"] as const) : []),
      ...(subscription.module_cpq ? (["cpq"] as const) : []),
      ...(subscription.module_erp ? (["erp"] as const) : []),
      ...(subscription.module_documents ? (["documents"] as const) : []),
    ];
  }, [subscription]);

  const refreshTenant = useCallback(async () => {
    if (!user?.id) return;
    setTenantLoading(true);
    await fetchTenantData(user.id);
  }, [fetchTenantData, user?.id]);

  return (
    <TenantContext.Provider
      value={{
        tenant,
        tenantLoading,
        activeTenantSlug: tenant?.slug ?? null,
        subscription,
        memberships,
        hasModule,
        enabledModules,
        switchTenant,
        switchTenantBySlug,
        refreshTenant,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}
