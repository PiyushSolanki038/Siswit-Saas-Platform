"use client";

import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/core/api/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useAuth } from "@/core/auth/useAuth";
import { useImpersonation } from "@/core/hooks/useImpersonation";
import { OrganizationContext, type OrganizationContextType } from "@/core/hooks/organization-context";
import {
  isModuleEnabled,
  type ModuleType,
  type Organization,
  type OrganizationMembership,
  type OrganizationSubscription,
} from "@/core/types/organization";

function mapOrganization(row: Record<string, unknown>): Organization {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    slug: String(row.slug ?? ""),
    org_code: row.org_code ? String(row.org_code) : undefined,
    status: (row.status as Organization["status"]) ?? "active",
    plan_type: (row.plan_type as Organization["plan_type"]) ?? "starter",
    company_name: row.company_name ? String(row.company_name) : undefined,
    company_email: row.company_email ? String(row.company_email) : undefined,
    company_phone: row.company_phone ? String(row.company_phone) : undefined,
    company_address: row.company_address ? String(row.company_address) : undefined,
    company_website: row.company_website ? String(row.company_website) : undefined,
    logo_url: row.logo_url ? String(row.logo_url) : undefined,
    primary_color: row.primary_color ? String(row.primary_color) : undefined,
    max_users: Number(row.max_users ?? 0),
    max_storage_mb: Number(row.max_storage_mb ?? 0),
    created_at: String(row.created_at ?? new Date().toISOString()),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  };
}

function mapSubscription(row: Record<string, unknown> | null): OrganizationSubscription | null {
  if (!row) return null;

  return {
    id: String(row.id ?? ""),
    organization_id: String(row.organization_id ?? ""),
    plan_type: (row.plan_type as OrganizationSubscription["plan_type"]) ?? "starter",
    status: (row.status as OrganizationSubscription["status"]) ?? "active",
    module_crm: Boolean(row.module_crm),
    module_clm: Boolean(row.module_clm),
    module_cpq: Boolean(row.module_cpq),
    module_erp: Boolean(row.module_erp),
    module_documents: Boolean(row.module_documents),
    features: (row.features as Record<string, boolean>) ?? {},
    created_at: String(row.created_at ?? new Date().toISOString()),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  };
}

function mapMembership(row: Record<string, unknown>): OrganizationMembership {
  const relatedOrg = row.organization as Record<string, unknown> | null;

  return {
    id: String(row.id ?? ""),
    organization_id: String(row.organization_id ?? ""),
    user_id: String(row.user_id ?? ""),
    role: String(row.role ?? "employee"),
    department: row.department ? String(row.department) : null,
    account_state: String(row.account_state ?? "active"),
    is_active: Boolean(row.is_active),
    organization: relatedOrg ? mapOrganization(relatedOrg) : null,
  };
}

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const unsafeSupabase = supabase as unknown as SupabaseClient;
  const { user, role, loading: authLoading } = useAuth();
  const { state: impersonation } = useImpersonation();

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [subscription, setSubscription] = useState<OrganizationSubscription | null>(null);
  const [memberships, setMemberships] = useState<OrganizationMembership[]>([]);
  const [organizationLoading, setOrganizationLoading] = useState(true);
  const fetchCount = useRef(0);

  const fetchSubscriptionByOrganization = useCallback(
    async (organizationId: string) => {
      const result = await unsafeSupabase
        .from("organization_subscriptions")
        .select("*")
        .eq("organization_id", organizationId)
        .maybeSingle();

      if (result.error) return null;
      return mapSubscription((result.data as Record<string, unknown> | null) ?? null);
    },
    [unsafeSupabase],
  );

  const fetchOrganizationData = useCallback(
    async (userId: string) => {
      const currentFetch = ++fetchCount.current;
      try {
        if (role === "platform_super_admin" && impersonation.active && impersonation.tenantSlug) {
          const orgResult = await unsafeSupabase
            .from("organizations")
            .select("*")
            .eq("slug", impersonation.tenantSlug)
            .maybeSingle();

          if (currentFetch !== fetchCount.current) return;

          if (orgResult.data) {
            const nextOrg = mapOrganization(orgResult.data as Record<string, unknown>);
            setOrganization(nextOrg);
            setMemberships([]);
            setSubscription(await fetchSubscriptionByOrganization(nextOrg.id));
            return;
          }
        }

        if (currentFetch !== fetchCount.current) return;

        const membershipsResult = await unsafeSupabase
          .from("organization_memberships")
          .select("id, organization_id, user_id, role, department, account_state, is_active, organization:organizations(*)")
          .eq("user_id", userId)
          .eq("is_active", true);

        if (currentFetch !== fetchCount.current) return;

        if (membershipsResult.error) {
          setMemberships([]);
          setOrganization(null);
          setSubscription(null);
          return;
        }

        const rows = ((membershipsResult.data ?? []) as Record<string, unknown>[]).map(mapMembership);
        setMemberships(rows);

        if (rows.length === 0) {
          setOrganization(null);
          setSubscription(null);
          return;
        }

        const primary = rows[0]?.organization;
        if (!primary) {
          setOrganization(null);
          setSubscription(null);
          return;
        }

        setOrganization(primary);
        setSubscription(await fetchSubscriptionByOrganization(primary.id));
      } catch {
        if (currentFetch !== fetchCount.current) return;
        setMemberships([]);
        setOrganization(null);
        setSubscription(null);
      } finally {
        if (currentFetch === fetchCount.current) {
          setOrganizationLoading(false);
        }
      }
    },
    [fetchSubscriptionByOrganization, impersonation.active, impersonation.tenantSlug, role, unsafeSupabase],
  );

  useEffect(() => {
    if (!authLoading && user) {
      setOrganizationLoading(true);
      void fetchOrganizationData(user.id);
      return;
    }

    if (!authLoading && !user) {
      setOrganization(null);
      setSubscription(null);
      setMemberships([]);
      setOrganizationLoading(false);
    }
  }, [authLoading, fetchOrganizationData, user]);

  const switchOrganization = useCallback(
    async (organizationId: string) => {
      const membership = memberships.find((item) => item.organization_id === organizationId);
      if (!membership || !membership.organization) {
        throw new Error("You do not have access to this organization");
      }

      setOrganization(membership.organization);
      setSubscription(await fetchSubscriptionByOrganization(organizationId));
    },
    [fetchSubscriptionByOrganization, memberships],
  );

  const switchOrganizationBySlug = useCallback(
    async (organizationSlug: string) => {
      const membership = memberships.find((item) => item.organization?.slug === organizationSlug);
      if (membership?.organization_id) {
        await switchOrganization(membership.organization_id);
        return;
      }

      if (role === "platform_super_admin") {
        const orgResult = await unsafeSupabase
          .from("organizations")
          .select("*")
          .eq("slug", organizationSlug)
          .maybeSingle();

        if (!orgResult.data) {
          throw new Error("Organization not found");
        }

        const nextOrg = mapOrganization(orgResult.data as Record<string, unknown>);
        setOrganization(nextOrg);
        setSubscription(await fetchSubscriptionByOrganization(nextOrg.id));
        return;
      }

      throw new Error("You do not have access to this organization");
    },
    [fetchSubscriptionByOrganization, memberships, role, switchOrganization, unsafeSupabase],
  );

  const hasModule = useCallback(
    (module: ModuleType): boolean => {
      return isModuleEnabled(subscription, module);
    },
    [subscription],
  );

  const enabledModules: ModuleType[] = useMemo(() => {
    if (!subscription) {
      return [];
    }

    return [
      ...(subscription.module_crm ? (["crm"] as const) : []),
      ...(subscription.module_clm ? (["clm"] as const) : []),
      ...(subscription.module_cpq ? (["cpq"] as const) : []),
      ...(subscription.module_erp ? (["erp"] as const) : []),
      ...(subscription.module_documents ? (["documents"] as const) : []),
    ];
  }, [subscription]);

  const refreshOrganization = useCallback(async () => {
    if (!user?.id) return;
    setOrganizationLoading(true);
    await fetchOrganizationData(user.id);
  }, [fetchOrganizationData, user?.id]);

  const value: OrganizationContextType = {
    organization,
    organizationLoading,
    activeOrganizationSlug: organization?.slug ?? null,
    subscription,
    memberships,
    hasModule,
    enabledModules,
    switchOrganization,
    switchOrganizationBySlug,
    refreshOrganization,
  };

  return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>;
}
