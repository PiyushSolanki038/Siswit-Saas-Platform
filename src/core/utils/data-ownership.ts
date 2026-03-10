export interface OwnershipContext {
  organizationId?: string | null;
  // Compatibility alias while migrating callers.
  tenantId?: string | null;
  userId?: string | null;
  isPlatformAdmin?: boolean;
}

function getContextOrganizationId(context: OwnershipContext): string | null {
  return context.organizationId ?? context.tenantId ?? null;
}

interface EqScopedQuery<TQuery> {
  eq: (column: string, value: string) => TQuery;
}

/**
 * Core ownership rule:
 * - Platform admins may access all organizations.
 * - Non-platform users must be organization-scoped.
 * - Mutations should stamp organization_id/tenant_id and created_by/owner_id where applicable.
 */
export function applyOrganizationOwnershipScope<TQuery extends EqScopedQuery<TQuery>>(
  query: TQuery,
  context: OwnershipContext,
): TQuery {
  if (context.isPlatformAdmin) return query;
  const organizationId = getContextOrganizationId(context);
  if (!organizationId) return query;
  return query.eq("organization_id", organizationId);
}

export function applyTenantOwnershipScope<TQuery extends EqScopedQuery<TQuery>>(
  query: TQuery,
  context: OwnershipContext,
): TQuery {
  return applyOrganizationOwnershipScope(query, context);
}

export function withOrganizationOwnershipCreate<T extends Record<string, unknown>>(
  payload: T,
  context: OwnershipContext,
): T & { organization_id?: string; tenant_id?: string; created_by?: string; owner_id?: string } {
  const next: T & { organization_id?: string; tenant_id?: string; created_by?: string; owner_id?: string } = {
    ...payload,
  };

  const organizationId = getContextOrganizationId(context);
  if (!context.isPlatformAdmin && organizationId) {
    next.organization_id = organizationId;
    next.tenant_id = organizationId;
  }
  if (context.userId) {
    if (!("created_by" in next)) next.created_by = context.userId;
    if (!("owner_id" in next)) next.owner_id = context.userId;
  }
  return next;
}

export function withOwnershipCreate<T extends Record<string, unknown>>(
  payload: T,
  context: OwnershipContext,
) {
  return withOrganizationOwnershipCreate(payload, context);
}
