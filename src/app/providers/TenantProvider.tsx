/**
 * TenantProvider — Adapter layer that maps OrganizationProvider data
 * to the TenantContext interface for backward compatibility.
 *
 * The original version queried `tenants`, `tenant_users`, `tenant_subscriptions`
 * tables that were dropped in migration 007. This adapter reads from
 * OrganizationProvider (which queries the correct `organizations` tables)
 * and maps the data to TenantContext shape.
 */

import { ReactNode, useCallback, useMemo } from "react";
import { useOrganization } from "@/workspaces/organization/hooks/useOrganization";
import { TenantContext, type TenantMembership } from "@/core/tenant/tenant-context";
import type { ModuleType, Tenant, TenantSubscription } from "@/core/types/tenant";

export function TenantProvider({ children }: { children: ReactNode }) {
  const {
    organization,
    organizationLoading,
    subscription: orgSubscription,
    memberships: orgMemberships,
    hasModule: orgHasModule,
    enabledModules: orgEnabledModules,
    switchOrganization,
    switchOrganizationBySlug,
    refreshOrganization,
  } = useOrganization();

  // Map Organization → Tenant (compatible shape)
  const tenant: Tenant | null = useMemo(() => {
    if (!organization) return null;
    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      status: organization.status,
      plan_type: organization.plan_type,
      logo_url: organization.logo_url,
      primary_color: organization.primary_color,
      max_users: organization.max_users,
      max_storage_mb: organization.max_storage_mb,
      created_at: organization.created_at,
      updated_at: organization.updated_at,
    } as Tenant;
  }, [organization]);

  // Map OrganizationSubscription → TenantSubscription
  const subscription: TenantSubscription | null = useMemo(() => {
    if (!orgSubscription) return null;
    return {
      id: orgSubscription.id,
      tenant_id: orgSubscription.organization_id,
      plan_type: orgSubscription.plan_type,
      status: orgSubscription.status,
      module_crm: orgSubscription.module_crm,
      module_clm: orgSubscription.module_clm,
      module_cpq: orgSubscription.module_cpq,
      module_erp: orgSubscription.module_erp,
      module_documents: orgSubscription.module_documents,
      features: orgSubscription.features,
      created_at: orgSubscription.created_at,
      updated_at: orgSubscription.updated_at,
    } as TenantSubscription;
  }, [orgSubscription]);

  // Map OrganizationMembership → TenantMembership
  const memberships: TenantMembership[] = useMemo(() => {
    return orgMemberships.map((m) => ({
      id: m.id,
      tenant_id: m.organization_id,
      user_id: m.user_id,
      role: m.role,
      department: m.department,
      is_active: m.is_active,
      is_approved: true,
      tenant: m.organization
        ? ({
            id: m.organization.id,
            name: m.organization.name,
            slug: m.organization.slug,
            status: m.organization.status,
          } as Tenant)
        : null,
    }));
  }, [orgMemberships]);

  const hasModule = useCallback(
    (module: ModuleType): boolean => orgHasModule(module),
    [orgHasModule],
  );

  const switchTenant = useCallback(
    async (tenantId: string) => switchOrganization(tenantId),
    [switchOrganization],
  );

  const switchTenantBySlug = useCallback(
    async (tenantSlug: string) => switchOrganizationBySlug(tenantSlug),
    [switchOrganizationBySlug],
  );

  const refreshTenant = useCallback(
    async () => refreshOrganization(),
    [refreshOrganization],
  );

  return (
    <TenantContext.Provider
      value={{
        tenant,
        tenantLoading: organizationLoading,
        activeTenantSlug: tenant?.slug ?? null,
        subscription,
        memberships,
        hasModule,
        enabledModules: orgEnabledModules as ModuleType[],
        switchTenant,
        switchTenantBySlug,
        refreshTenant,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}
