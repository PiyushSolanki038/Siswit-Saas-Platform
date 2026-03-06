# Debug Report - SISWIT Unified Platform

**Date:** 2026-03-04  
**Environment:** Development (localhost:8080)  
**Status:** Issues Identified  

---

## Executive Summary

The SISWIT Unified Platform is a complex multi-tenant SaaS application built with React, TypeScript, Vite, Supabase, and Tailwind CSS. The application integrates multiple business modules (CRM, CLM, CPQ, ERP, Documents) with role-based access control. This report documents all identified issues, potential problems, and areas requiring attention.

**Note:** The application compiles successfully (`npm run dev` starts without errors), but there are several code quality and architectural issues that could cause runtime problems.

---

## 1. Lint Errors & Warnings

### 1.1 Critical: ESLint Parsing Error — ✅ FIXED

**File:** `src/core/api/types.ts`  
**Issue:** Parsing error - "File appears to be binary"  
**Severity:** Critical  
**Status:** ✅ **Fixed on 2026-03-06** — Converted file encoding from UTF-16LE to UTF-8 (no BOM).  
**Impact:** This file cannot be linted and may contain encoding issues. It's likely a generated Supabase types file that has become corrupted or contains non-text content.

```bash
1:0 error Parsing error: File appears to be binary
```

**Recommended Fix:**
1. Check file encoding - ensure it's UTF-8: `file --mime-encoding src/core/api/types.ts`
2. If corrupted, regenerate the types file: `npm run db:types`
3. Or manually recreate the file with proper TypeScript syntax
4. Add .eslintignore entry if file is auto-generated:
   ```json
   // .eslintignore
   "src/core/api/types.ts"
   ```

### 1.2 Warning: Unused ESLint Directive

**File:** `src/integrations/types.ts`  
**Issue:** Unused eslint-disable directive  
**Severity:** Low  
**Line:** 1:1

**Recommended Fix:**
Remove the unused eslint-disable comment at the top of the file:
```typescript
// REMOVE THIS LINE:
/* eslint-disable */

// Or if it's a different directive, fix or remove it
```

### 1.3 Warning: Unnecessary Dependency — ✅ FIXED

**File:** `src/app/providers/AuthProvider.tsx`  
**Issue:** React Hook useCallback has an unnecessary dependency: 'unsafeSupabase'  
**Severity:** Medium  
**Status:** ✅ **Fixed on 2026-03-06** — Removed `unsafeSupabase` from `signUpOrganization` dependency array.  
**Line:** 416:5

**Recommended Fix:**
Move the unsafeSupabase reference outside the useCallback or use the ref pattern:
```typescript
// OPTION 1: Remove from dependency array if not used inside
const someCallback = useCallback(async () => {
  // function body
}, []); // Remove unsafeSupabase from here

// OPTION 2: Use a ref to store the value
const supabaseRef = useRef(unsafeSupabase);
const someCallback = useCallback(async () => {
  // use supabaseRef.current
}, [supabaseRef]); // Add ref to dependencies
```

---

## 2. Type System Duplication & Conflicts

### 2.1 Duplicate ModuleType Definition — ✅ FIXED

**Status:** ✅ **Fixed on 2026-03-06** — Created `src/core/types/modules.ts` as single source of truth. Both `organization.ts` and `tenant.ts` now re-export from it.

**Issue:** `ModuleType` is defined in two locations with identical values:

1. `src/core/types/organization.ts` (line 4)
```typescript
export type ModuleType = "crm" | "clm" | "cpq" | "erp" | "documents";
```

2. `src/core/types/tenant.ts` (line 22)
```typescript
export type ModuleType = "crm" | "clm" | "cpq" | "erp" | "documents";
```

**Recommended Fix:**
1. Create a single shared types file:
   ```typescript
   // src/core/types/modules.ts
export type ModuleType = "crm" | "clm" | "cpq" | "erp" | "documents";
   export const ALL_MODULES: ModuleType[] = ["crm", "clm", "cpq", "erp", "documents"];
   ```

2. Update imports in both files to re-export from shared location:
   ```typescript
   // src/core/types/organization.ts
   export { ModuleType } from './modules';
   
   // src/core/types/tenant.ts  
   export { ModuleType } from './modules';
   ```

3. Update all imports throughout the codebase to use the shared type

### 2.2 Duplicate isModuleEnabled Function — ✅ PARTIALLY FIXED

**Status:** ✅ **Partially fixed on 2026-03-06** — Both functions now import `ModuleType` from the shared `modules.ts`, eliminating the type duplication. The functions remain separate since they accept different parameter types (`OrganizationSubscription` vs `TenantSubscription`).

**Issue:** `isModuleEnabled` function exists in both:

1. `src/core/types/organization.ts` (line 52-72)
2. `src/core/types/tenant.ts` (line 171-191)

Both accept different parameter types (OrganizationSubscription vs TenantSubscription), but the function name is identical, causing potential confusion.

**Recommended Fix:**
1. Create a shared utility function with generic types:
   ```typescript
   // src/core/utils/module-utils.ts
   import type { ModuleType } from '../types/modules';
   
   interface Subscription {
     module_crm?: boolean;
     module_clm?: boolean;
     module_cpq?: boolean;
     module_erp?: boolean;
     module_documents?: boolean;
   }
   
   export function isModuleEnabled<T extends Subscription>(
     subscription: T | null | undefined,
     module: ModuleType
   ): boolean {
     if (!subscription) return false;
     const key = `module_${module}` as keyof T;
     return Boolean(subscription[key]);
   }
   ```

2. Or use more specific names to avoid confusion:
   ```typescript
   // Keep both but rename for clarity
export function isOrganizationModuleEnabled(
     subscription: OrganizationSubscription | null | undefined,
     module: ModuleType
   ): boolean;
   
export function isTenantModuleEnabled(
     subscription: TenantSubscription | null | undefined, 
     module: ModuleType
   ): boolean;
   ```

### 2.3 Duplicate Type Definitions (Organization vs Tenant)

The codebase maintains two parallel type systems:

| Concept | Organization System | Tenant System |
|---------|-------------------|---------------|
| Main Entity | Organization | Tenant |
| Subscription | OrganizationSubscription | TenantSubscription |
| Membership | OrganizationMembership | TenantUser |
| Module Check | isModuleEnabled (org) | isModuleEnabled (tenant) |

**Recommended Fix:**
1. **Long-term:** Consolidate to a single system (recommend Tenant-based approach)
2. **Short-term:** Add clear comments and documentation distinguishing when to use which
3. Create a unified provider that wraps both:
   ```typescript
   // src/app/providers/UnifiedWorkspaceProvider.tsx
   interface WorkspaceContext {
     // Unified interface
     currentWorkspace: Tenant | Organization | null;
     isTenantMode: boolean;
     // ...统一的方法
   }
   ```
4. Add runtime checks to prevent using wrong provider

---

## 3. React Hooks Rule Violations

### 3.1 Conditional useMemo Hook — ✅ ALREADY FIXED

**File:** `src/workspaces/organization_admin/layout/TenantAdminLayout.tsx`  
**Issue:** React Hook "useMemo" is called conditionally  
**Severity:** Critical (will cause runtime errors)  
**Status:** ✅ **Already fixed** — `useMemo` is at line 176 (unconditional, top of component), the `if (isTenantUserRole)` early return is at line 181 (after all hooks). No violation exists.  
**Line:** 180:21

**Recommended Fix:**
Move the useMemo call outside of any conditional blocks:
```typescript
// WRONG:
function Component() {
  if (someCondition) {
    const value = useMemo(() => expensiveCalculation(), []);
    return <div>{value}</div>;
  }
  return <div>No value</div>;
}

// CORRECT:
function Component() {
  const value = useMemo(() => expensiveCalculation(), []);
  
  if (someCondition) {
    return <div>{value}</div>;
  }
  return <div>No value</div>;
}

// ALTERNATIVE - Use conditional logic inside useMemo:
const value = useMemo(() => {
  if (!someCondition) return null;
  return expensiveCalculation();
}, [someCondition]);
```

---

## 4. Type Safety Issues (any Types)

### 4.1 Excessive any Usage — ✅ PARTIALLY FIXED

**Status:** ✅ **Partially fixed on 2026-03-06** — Added 7 typed interfaces (`DashboardKPIs`, `DashboardOpportunity`, `DashboardContract`, `DashboardActivity`, `DashboardLead`, `DashboardAuditLog`, `DashboardChartItem`) and exported `DashboardData` in `useOrganizationDashboard.ts`. Removed the unsafe `Record<string, unknown>` cast. The dashboard page already uses a local `DashboardItem` interface.

**Files with any type declarations:**

1. **src/workspaces/organization_admin/hooks/useOrganizationDashboard.ts** (line 67)
```typescript
{ data: Record<string, unknown>[] | null; count: number | null }[]
```

2. **src/workspaces/organization_admin/pages/OrganizationAdminDashboard.tsx**
   - Line 84: `dashboardData: any`
   - Line 95: `dashboardData.charts: any`
   - Line 113: `dashboardData.lists: any`
   - Line 354: `item: any`
   - Line 384: `item: any`
   - Line 414: `item: any`
   - Line 465: `item: any`
   - Line 502: `item: any`

**Recommended Fix:**
Define proper TypeScript interfaces:
```typescript
// Define interfaces for dashboard data
interface DashboardKPIs {
  leads: number;
  contracts: number;
  quotes: number;
  orders: number;
}

interface DashboardLists {
  opportunities: Opportunity[];
  contracts: Contract[];
  activities: Activity[];
  leads: Lead[];
  auditLogs: AuditLog[];
}

interface DashboardCharts {
  leads: Lead[];
  contracts: Contract[];
  quotes: Quote[];
}

interface DashboardData {
  kpis: DashboardKPIs;
  lists: DashboardLists;
  charts: DashboardCharts;
}

// Then use in component:
const { data: dashboardData } = useQuery<DashboardData>({
  queryKey: ['organization-dashboard', tenantId],
  queryFn: fetchDashboardData
});
```

For the hooks file, use proper typing:
```typescript
// Instead of:
{ data: Record<string, unknown>[] | null; count: number | null }[]

// Use:
type SupabaseCountResponse = { data: Lead[] | null; count: number | null };
```

### 4.2 Missing useMemo Dependencies

**File:** `src/workspaces/organization_admin/pages/OrganizationAdminDashboard.tsx`  
**Issue:** React Hook useMemo has a missing dependency: 'dashboardData.charts'  
**Severity:** Medium  
**Line:** 135

**Recommended Fix:**
Add the missing dependency or restructure the code:
```typescript
// OPTION 1: Add dependency
const chartData = useMemo(() => {
  // Transform dashboardData.charts
  return dashboardData?.charts?.leads?.map(...) ?? [];
}, [dashboardData?.charts]); // Add dependency

// OPTION 2: Use useMemo for all dependent values
const chartData = useMemo(() => {
  if (!dashboardData?.charts) return defaultData;
  return transformData(dashboardData.charts);
}, [dashboardData]); // Add the entire object

// OPTION 3: Disable eslint rule with explanation (not recommended)
const chartData = useMemo(() => {
  return dashboardData?.charts?.leads?.map(...) ?? [];
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []); // Only if you intentionally want stale data
```

---

## 5. Architecture Issues

### 5.1 Dual Provider System

The application has two parallel provider systems that manage similar data:

**OrganizationProvider** (`src/app/providers/OrganizationProvider.tsx`):
- Manages `Organization` (via `organizations` table)
- Uses `organization_memberships` table
- Uses `organization_subscriptions` table

**TenantProvider** (`src/app/providers/TenantProvider.tsx`):
- Manages `Tenant` (via `tenants` table)
- Uses `tenant_users` table
- Uses `tenant_subscriptions` table

**Recommended Fix:**

**Option A (Recommended): Consolidate to Single System**
1. Choose Tenant as the primary model (more common in SaaS)
2. Deprecate OrganizationProvider and remove from App.tsx
3. Migrate all organization_* references to tenant_*
4. Update the database schema to use tenants consistently

**Option B: Keep Both with Clear Boundaries**
1. Rename OrganizationProvider to PlatformProvider (for platform-level operations)
2. Keep TenantProvider for tenant-specific operations
3. Add a unified hook that delegates to the correct provider:
```typescript
// src/core/hooks/useWorkspace.ts
import { useTenant } from './useTenant';
import { useOrganization } from './useOrganization';

export function useWorkspace() {
  const tenant = useTenant();
  const organization = useOrganization();
  
  // Return based on which is active
  return {
    current: tenant.tenant ?? organization.organization,
    isUsingTenant: !!tenant.tenant,
    // ...
  };
}
```

**Option C: Sequential Loading**
1. Load only one provider at a time based on user role
2. Use a loading state to prevent race conditions

### 5.2 Role System Complexity

**Issue:** The role system has multiple layers of complexity:

1. **Legacy Roles:** `platform_admin`, `user`, `pending_approval`, `rejected`
2. **Platform Roles:** `platform_super_admin`
3. **Organization Roles:** `owner`, `admin`, `manager`, `employee`, `client`

**Recommended Fix:**

1. **Simplify to single role source** (recommended):
```typescript
// src/core/types/roles.ts - Simplified enum
export enum AppRole {
  PLATFORM_SUPER_ADMIN = 'platform_super_admin',
  OWNER = 'owner',
  ADMIN = 'admin',
  MANAGER = 'manager',
  EMPLOYEE = 'employee',
  CLIENT = 'client',
  PENDING_APPROVAL = 'pending_approval',
  REJECTED = 'rejected'
}
```

2. **Remove legacy role mappings** - Delete normalizeRole() function after migration

3. **Add strict type checking**:
```typescript
// Enforce only valid roles
export type ValidRole = `${AppRole}`;
```

4. **Create migration script** for existing data:
```sql
-- Migrate legacy roles to new system
UPDATE users 
SET role = CASE 
  WHEN role = 'tenant_admin' THEN 'admin'
  WHEN role = 'tenant_manager' THEN 'manager'
  WHEN role = 'tenant_user' THEN 'employee'
  WHEN role = 'client_user' THEN 'client'
  ELSE role
END;
```

### 5.3 Duplicate Context Hooks

**Issue:** Two hooks provide similar functionality:

1. `useOrganization()` - from `src/core/hooks/organization-context.ts`
2. `useTenant()` - from `src/core/tenant/useTenant.ts`

Both provide:
- Organization/Tenant object
- Subscription data
- Module access checks (hasModule)
- Memberships

**Recommended Fix:**

**Option A: Create unified hook (recommended)**
```typescript
// src/core/hooks/useWorkspace.tsx
import { createContext, useContext } from 'react';
import { useTenant } from '@/core/tenant/useTenant';
import { useOrganization } from '@/workspaces/organization/hooks/useOrganization';

export function useWorkspace() {
  const tenantContext = useTenant();
  const orgContext = useOrganization();
  
  // Prefer tenant if available, fallback to organization
  return {
    workspace: tenantContext.tenant ?? orgContext.organization,
    subscription: tenantContext.subscription ?? orgContext.subscription,
    hasModule: tenantContext.hasModule ?? orgContext.hasModule,
    memberships: tenantContext.memberships ?? orgContext.memberships,
    loading: tenantContext.tenantLoading ?? orgContext.organizationLoading,
    // ...
  };
}
```

**Option B: Deprecate one hook**
- Mark useOrganization() as @deprecated
- Update all imports to use useTenant()
- Eventually remove useOrganization()

---

## 6. Module Scope Issues

### 6.1 Potential Module Access Failures

The following hooks use `requireOrganizationScope` which may fail:

- `src/modules/crm/hooks/useCRM.ts`
- `src/modules/cpq/hooks/useCPQ.ts`
- `src/modules/clm/hooks/useCLM.ts`
- `src/modules/erp/hooks/useERP.ts`
- `src/modules/documents/hooks/useDocuments.ts`

**Recommended Fix:**

1. **Update module hooks to use unified workspace context**:
```typescript
// In each module hook, change from:
import { useOrganization } from "@/workspaces/organization/hooks/useOrganization";

// To:
import { useWorkspace } from "@/core/hooks/useWorkspace";

// Then use:
const { workspace, hasModule } = useWorkspace();
const moduleReady = hasModule('crm') && workspace !== null;
```

2. **Or make module scope more resilient**:
```typescript
// src/core/utils/module-scope.ts
export function requireWorkspaceScope(context: ModuleScopeContext) {
  if (!isModuleScopeReady(context)) {
    throw new Error('Workspace not ready - please wait for authentication');
  }
  return context;
}

// Add null checks and fallback
function getOrganizationOrTenant() {
  try {
    return useOrganization();
  } catch {
    try {
      return useTenant();
    } catch {
      return null;
    }
  }
}
```

3. **Add loading states** to prevent access before providers are ready:
```typescript
const { workspace, loading } = useWorkspace();

if (loading) return <Skeleton />;
if (!workspace) return <NoAccess />;
```

---

## 7. Potential Runtime Issues

### 7.1 Missing Environment Variables — ✅ FIXED

**Status:** ✅ **Fixed on 2026-03-06** — Added runtime validation in `client.ts` that throws a clear error if variables are missing.

**Critical:** The Supabase client is initialized with environment variables that may not be set:

```typescript
// src/core/api/client.ts
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
```

**Recommended Fix:**

1. **Create .env.example file** with all required variables:
```bash
# .env.example
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
```

2. **Add validation on app startup**:
```typescript
// src/core/api/client.ts
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing required environment variables: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY'
  );
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {...});
```

3. **Update package.json scripts** to validate env vars:
```json
{
  "scripts": {
    "predev": "node scripts/check-env.js",
    "prebuild": "node scripts/check-env.js"
  }
}
```

### 7.2 Organization vs Tenant Slug Navigation

**File:** `src/app/App.tsx` (line 166-167)

**Recommended Fix:**

1. **Use unified workspace slug**:
```typescript
function RootRedirect() {
  const { tenant, tenantLoading } = useTenant();
  const { organization, organizationLoading } = useOrganization();
  const loading = tenantLoading || organizationLoading;

  if (loading) return <RouteLoader />;

  // Prefer tenant, fallback to organization
  const workspaceSlug = tenant?.slug ?? organization?.slug;
  
  if (workspaceSlug) {
    return <Navigate to={`/${workspaceSlug}/app/dashboard`} replace />;
  }
  
  return <Navigate to="/auth/sign-in" replace />;
}
```

2. **Or consolidate to single slug**:
```typescript
// Get unified workspace identifier
function getWorkspaceSlug(): string | null {
  // This should use the unified workspace hook
  return tenant?.slug ?? organization?.slug ?? null;
}
```

### 7.3 Root Redirect Logic

**File:** `src/app/App.tsx` (line 156-171)

**Recommended Fix:**

Improve the redirect logic to handle edge cases:
```typescript
function RootRedirect() {
  const { role, loading } = useAuth();
  const { tenant, tenantLoading } = useTenant();
  const { organization, organizationLoading } = useOrganization();

  if (loading || tenantLoading || organizationLoading) {
    return <RouteLoader />;
  }

  // Platform admin goes to platform
  if (isPlatformRole(role)) {
    return <Navigate to="/platform" replace />;
  }

  // Try tenant first, then organization
  const workspaceSlug = tenant?.slug ?? organization?.slug;
  
  if (workspaceSlug) {
    // Redirect based on role
    if (role === 'client') {
      return <Navigate to={`/${workspaceSlug}/app/portal`} replace />;
    }
    return <Navigate to={`/${workspaceSlug}/app/dashboard`} replace />;
  }

  // No workspace - check if they have pending approval
  if (role === 'pending_approval') {
    return <Navigate to="/pending-approval" replace />;
  }

  // No workspace and not pending - redirect to signup
  return <Navigate to="/auth/sign-up" replace />;
}
```

---

## 8. Code Quality Issues

### 8.1 Duplicate Code in Layouts

**Issue:** Header and Footer components are duplicated:

- `src/workspaces/employee/layout/Header.tsx`
- `src/workspaces/employee/layout/Footer.tsx`
- `src/workspaces/website/components/layout/Header.tsx`
- `src/workspaces/website/components/layout/Footer.tsx`

**Recommended Fix:**

1. **Create shared components**:
```typescript
// src/components/layout/Header.tsx
export function Header({ variant = 'default' }) {
  // Use variant prop for styling differences
  return <header className={variant === 'website' ? 'website-header' : 'app-header'}>
    {/* ... */}
  </header>;
}
```

2. **Update imports**:
```typescript
// Replace duplicates with:
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
```

3. **Remove duplicate files** after migration

### 8.2 Large File Sizes

Several files are excessively large, making them difficult to maintain:

| File | Size | Lines |
|------|------|-------|
| `src/core/api/types.ts` | 224KB | ~5000+ |
| `src/integrations/types.ts` | 128KB | ~3000+ |
| `src/app/providers/AuthProvider.tsx` | 35KB | ~1000+ |
| `src/modules/crm/hooks/useCRM.ts` | 56KB | ~1500+ |
| `src/modules/erp/hooks/useERP.ts` | 43KB | ~1200+ |

**Recommended Fix:**

1. **Split large hook files** by functionality:
```typescript
// src/modules/crm/hooks/useCRM/leads.ts
// src/modules/crm/hooks/useCRM/contacts.ts
// src/modules/crm/hooks/useCRM/accounts.ts
// src/modules/crm/hooks/useCRM/opportunities.ts

export { useLeads } from './leads';
export { useContacts } from './contacts';
export { useAccounts } from './accounts';
export { useOpportunities } from './opportunities';
```

2. **Create barrel exports** for clean imports:
```typescript
// src/modules/crm/hooks/useCRM/index.ts
export * from './useCRM/leads';
export * from './useCRM/contacts';
// ...
```

3. **Split AuthProvider** into smaller concerns:
```typescript
// src/app/providers/auth/AuthProvider.tsx (main)
// src/app/providers/auth/useAuth.ts (hook)
// src/app/providers/auth/authState.ts (state logic)
// src/app/providers/auth/authQueries.ts (queries)
```

4. **Regenerate types** if too large (should only include database types)

### 8.3 Hardcoded Values

**File:** `src/modules/cpq/components/QuotePDFTemplate.tsx` (line 87)
```typescript
const VAT_RATE = 0.15;  // Hardcoded 15% VAT
```

**Recommended Fix:**

1. **Add to tenant/organization settings**:
```typescript
// Get from subscription or settings
const VAT_RATE = organization?.settings?.vatRate 
  ?? tenant?.settings?.vatRate 
  ?? 0.15;
```

2. **Create configuration service**:
```typescript
// src/core/config/organizationConfig.ts
export function getTaxRate(organization: Organization): number {
  return organization.taxConfig?.vatRate 
    ?? Number(process.env.DEFAULT_VAT_RATE || '0.15');
}
```

3. **Add to database schema**:
```sql
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(5,4) DEFAULT 0.15;
```

---

## 9. Security Considerations

### 9.1 Public Environment Variables

**Issue:** Client-side code exposes Supabase URL and key:

```typescript
// These are visible in browser developer tools
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
```

**Recommended Fix:**

1. **Use VITE_ prefix (already done)** - This is correct for client-side exposure
2. **Ensure Supabase RLS is enabled**:
```sql
-- Enable RLS on all tables
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
-- etc.
```

3. **Create RLS policies**:
```sql
-- Example: Users can only see their organization's data
CREATE POLICY "Users can view own organization data" ON leads
  FOR SELECT
  USING (organization_id IN (
    SELECT organization_id 
    FROM organization_memberships 
    WHERE user_id = auth.uid()
  ));
```

4. **Use service role only on server** - Never expose service role key in client
5. **Add additional security headers** in vite.config.ts:
```typescript
export default defineConfig({
  server: {
    headers: {
      'Content-Security-Policy': 'default-src \'self\'; script-src \'self\' \'unsafe-inline\'; connect-src https://*.supabase.co',
    },
  },
});
```

### 9.2 Role-Based Access Control Complexity

The RBAC system in `src/core/rbac/usePermissions.ts` has complex permission checks that may have gaps:

- Multiple role types (legacy, platform, organization) create potential bypass opportunities
- Permission checks may not cover all edge cases

**Recommended Fix:**

1. **Simplify role system** (see Section 5.2)
2. **Create explicit permission checks**:
```typescript
// src/core/rbac/permissions.ts
export const Permissions = {
  // Define all possible actions
  VIEW_DASHBOARD: 'dashboard:view',
  MANAGE_USERS: 'users:manage',
  VIEW_LEADS: 'leads:view',
  CREATE_LEADS: 'leads:create',
  // ... more actions
} as const;

// Create role-permission mapping
export const RolePermissions: Record<string, string[]> = {
  platform_super_admin: Object.values(Permissions),
  owner: [Permissions.VIEW_DASHBOARD, Permissions.MANAGE_USERS, ...],
  admin: [Permissions.VIEW_DASHBOARD, Permissions.MANAGE_USERS, Permissions.VIEW_LEADS, ...],
  manager: [Permissions.VIEW_DASHBOARD, Permissions.VIEW_LEADS, Permissions.CREATE_LEADS],
  employee: [Permissions.VIEW_DASHBOARD, Permissions.VIEW_LEADS],
  client: [Permissions.VIEW_PORTAL],
};

// Check permission function
export function hasPermission(role: AppRole, permission: string): boolean {
  const permissions = RolePermissions[role];
  return permissions?.includes(permission) ?? false;
}
```

3. **Add audit logging for permission denied events**

---

## 10. Performance Concerns

### 10.1 Redundant Data Fetching

Both OrganizationProvider and TenantProvider fetch membership data on app load:

```typescript
// OrganizationProvider - line 122-126
const membershipsResult = await unsafeSupabase
  .from("organization_memberships")
  .select(...)
  .eq("user_id", userId)

// TenantProvider - line 79-83
const membershipsResult = await supabase
  .from("tenant_users")
  .select(...)
  .eq("user_id", userId)
```

**Recommended Fix:**

1. **Consolidate to single provider** (see Section 5.1)
2. **Implement deduplication** if keeping both:
```typescript
// Cache membership data
const cache = new Map<string, Membership[]>();

async function fetchMemberships(userId: string) {
  const cacheKey = `memberships:${userId}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)!;
  }
  
  // Fetch and cache for 5 minutes
  const data = await fetchFromAPI(userId);
  cache.set(cacheKey, data);
  setTimeout(() => cache.delete(cacheKey), 5 * 60 * 1000);
  return data;
}
```
3. **Use React Query's deduplication**:
```typescript
// Both providers can share the same query key
const { data } = useQuery({
  queryKey: ['user-memberships', userId],
  queryFn: () => fetchMemberships(userId),
  // This ensures only one request is made
});
```

### 10.2 Large Bundle Size

The application imports from multiple large modules:
- `recharts` (charting library)
- `date-fns` (date utilities)
- Multiple Radix UI components

**Recommended Fix:**

1. **Use dynamic imports for heavy components**:
```typescript
// Lazy load charts
const ChartComponent = lazy(() => import('./components/ChartComponent'));

// Or use React.lazy
const Dashboard = lazy(() => import('./pages/Dashboard'));
```

2. **Use tree-shaking friendly imports**:
```typescript
// Instead of:
import { format, parseISO, addDays } from 'date-fns';

// Use:
import format from 'date-fns/format';
import parseISO from 'date-fns/parseISO';
import addDays from 'date-fns/addDays';

// Or use date-fns-tz for lighter bundle
```

3. **Use lighter alternatives**:
```typescript
// Replace recharts with lighter alternative:
// - Chart.js (smaller)
// - visx (most modular)
// - Custom SVG charts for simple needs
```

4. **Configure Vite for better tree-shaking**:
```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
          'vendor-charts': ['recharts'],
        },
      },
    },
  },
});
```

---

## 11. Migration/Compatibility Issues

### 11.1 Legacy Route Support

The app maintains legacy route redirects:

```typescript
// src/app/App.tsx - line 332-335
<Route path="/admin/*" element={<LegacyAdminRedirect />} />
<Route path="/dashboard/*" element={<LegacyDashboardRedirect />} />
<Route path="/portal/*" element={<LegacyPortalRedirect />} />
```

**Recommended Fix:**

1. **Phase out legacy routes** - Set a deprecation timeline
2. **Add deprecation warnings**:
```typescript
function LegacyDashboardRedirect() {
  console.warn(
    'DEPRECATED: /dashboard/* routes are deprecated. ' +
    'Please update your bookmarks to /{tenantSlug}/app/*'
  );
  // ... existing logic
}
```

3. **Track usage** - Add analytics to see which legacy routes are being used
4. **Create migration guide** for existing users
5. **Set sunset date** - Remove after certain version or date

### 11.2 Multiple Sign-Up Flows

The application has multiple signup flows:
- Organization signup
- Client self-signup
- Employee invitation acceptance
- Client invitation acceptance

**Recommended Fix:**

1. **Consolidate signup flows** into a single wizard:
```typescript
// SignUpWizard.tsx
enum SignUpStep {
  USER_INFO = 'user_info',
  ORGANIZATION = 'organization',  // or SELECT_ORGANIZATION for clients
  VERIFICATION = 'verification',
}
```

2. **Unify invitation handling**:
```typescript
// Use token type to determine flow
interface InvitationToken {
  type: 'employee' | 'client' | 'organization';
  expiresAt: string;
  // ...
}
```

3. **Create reusable components** for common signup steps

---

## 12. Testing & Documentation

### 12.1 Missing Tests

No test files were found in the project structure. Critical components should have unit tests:
- AuthProvider
- TenantProvider / OrganizationProvider
- Role normalization functions
- Protected route components

**Recommended Fix:**

1. **Set up testing framework**:
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

2. **Configure Vitest** in vite.config.ts:
```typescript
/// <reference types="vitest" />
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
```

3. **Create test files**:
```typescript
// src/app/providers/__tests__/TenantProvider.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { TenantProvider } from '../TenantProvider';

describe('TenantProvider', () => {
  it('provides tenant context to children', async () => {
    // Test implementation
  });
});

// src/core/types/__tests__/roles.test.ts
import { describe, it, expect } from 'vitest';
import { normalizeRole, isPlatformRole } from '../roles';

describe('normalizeRole', () => {
  it('normalizes legacy roles', () => {
    expect(normalizeRole('tenant_admin')).toBe('admin');
  });
});
```

4. **Add CI check** for test coverage:
```json
// package.json
{
  "scripts": {
    "test": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

### 12.2 Documentation

- PRD_SISWIT.html exists but may be outdated
- docs/ folder contains planning documents but not API documentation

**Recommended Fix:**

1. **Create API documentation** using TypeDoc:
```bash
npm install -D typedoc
```

2. **Generate documentation**:
```json
// package.json
{
  "scripts": {
    "docs": "typedoc --out docs/api src/"
  }
}
```

3. **Create component documentation**:
```typescript
/**
 * OrganizationProvider manages the current organization's state
 * and provides subscription/module access information.
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { organization, hasModule } = useOrganization();
 *   
 *   if (hasModule('crm')) {
 *     return <CRMDashboard />;
 *   }
 * }
 * ```
 */
export function OrganizationProvider({ children }) { ... }
```

4. **Update docs/README.md** with contribution guidelines
5. **Create architecture decision records (ADRs)** in docs/ folder

---

## 13. Summary of Issues by Severity

### Critical (Requires Immediate Attention)
1. ~~ESLint parsing error in `src/core/api/types.ts`~~ — ✅ FIXED
2. ~~Conditional useMemo hook in TenantAdminLayout.tsx~~ — ✅ ALREADY FIXED
3. ~~Missing environment variables (will cause runtime failure)~~ — ✅ FIXED
4. Dual provider system creating potential race conditions

### High (Should Be Addressed)
1. ~~Type duplication (ModuleType, isModuleEnabled)~~ — ✅ FIXED
2. ~~Excessive use of `any` types~~ — ✅ PARTIALLY FIXED (dashboard hook typed)
3. Role system complexity leading to potential auth issues
4. Module scope may fail due to provider conflicts

### Medium (Recommended Fixes)
1. Unnecessary dependencies in useCallback
2. Missing useMemo dependencies
3. Duplicate Header/Footer components
4. Hardcoded values (VAT rate)

### Low (Nice to Have)
1. Unused eslint-disable directive
2. Large file sizes
3. Missing test coverage
4. Legacy route complexity

---

## 14. Detailed Recommendations with Implementation Steps

### Priority 1: Fix Critical Issues (Week 1-2)

#### 1.1 Fix ESLint Parsing Error in types.ts
- **Action:** Regenerate `src/core/api/types.ts` using: `npm run db:types`
- **Alternative:** Manually recreate the file with proper UTF-8 encoding
- **Verification:** Run `npm run lint` to confirm the error is resolved

#### 1.2 Fix Conditional useMemo in TenantAdminLayout.tsx
- **Action:** Move useMemo outside conditional blocks
- **File:** `src/workspaces/organization_admin/layout/TenantAdminLayout.tsx:180`
- **Test:** Verify component renders correctly in all states

#### 1.3 Add Required Environment Variables
- **Action:** Create/update `.env` file with:
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
```
- **Verify:** Check that Supabase client initializes without errors

#### 1.4 Consolidate Provider System
- **Short-term:** Add loading states to prevent race conditions
- **Long-term:** Choose either Organization or Tenant as primary model
- **Recommended:** Use Tenant as it's more common in SaaS

---

### Priority 2: Address Architecture (Week 2-4)

#### 2.1 Eliminate Type Duplication
- Create `src/core/types/modules.ts` with single ModuleType definition
- Update imports in `organization.ts` and `tenant.ts` to re-export
- Run find/replace across codebase to use single source

#### 2.2 Simplify Role System
- Remove legacy role mappings after data migration
- Consolidate to single role enum in `src/core/types/roles.ts`
- Create database migration to update legacy roles

#### 2.3 Fix Module Scope Hooks
- Update all module hooks to use unified workspace context
- Add proper loading/error states
- Test each module (CRM, CPQ, CLM, ERP, Documents)

---

### Priority 3: Improve Code Quality (Week 3-6)

#### 3.1 Replace any Types
- Add proper interfaces for DashboardData
- Update OrganizationAdminDashboard.tsx with typed responses
- Use React Query's generic types for better inference

#### 3.2 Fix Missing Dependencies
- Add dashboardData.charts to useMemo dependencies array
- Or restructure to use useEffect for side effects

#### 3.3 Extract Shared Components
- Create `src/components/layout/Header.tsx`
- Create `src/components/layout/Footer.tsx`
- Update imports across all workspaces

#### 3.4 Add Configuration Service
- Move hardcoded values (VAT_RATE, etc.) to config
- Store in database or environment variables

---

### Priority 4: Performance & Maintenance (Week 4-8)

#### 4.1 Implement Code Splitting
- Use React.lazy for route components
- Dynamic imports for charts and heavy components
- Configure Vite manual chunks

#### 4.2 Set Up Testing
- Install Vitest and Testing Library
- Write tests for critical paths (auth, providers)
- Add CI check for test coverage

#### 4.3 Remove Legacy Support
- Phase out legacy routes with deprecation warnings
- Track usage and set sunset date
- Update documentation

#### 4.4 Add Documentation
- Set up TypeDoc for API documentation
- Create component documentation
- Update docs/ with architecture decisions

---

## Appendix: File Locations

### Key Source Files
- **App Entry:** `src/app/App.tsx`
- **Auth:** `src/app/providers/AuthProvider.tsx`
- **Tenancy:** `src/app/providers/TenantProvider.tsx`
- **Organization:** `src/app/providers/OrganizationProvider.tsx`
- **Routing:** `src/core/auth/components/ProtectedRoute.tsx`
- **Roles:** `src/core/types/roles.ts`
- **Types:** `src/core/types/*.ts`

### Module Hooks
- CRM: `src/modules/crm/hooks/useCRM.ts`
- CPQ: `src/modules/cpq/hooks/useCPQ.ts`
- CLM: `src/modules/clm/hooks/useCLM.ts`
- ERP: `src/modules/erp/hooks/useERP.ts`
- Documents: `src/modules/documents/hooks/useDocuments.ts`

### Workspaces
- Auth: `src/workspaces/auth/`
- Website: `src/workspaces/website/`
- Employee: `src/workspaces/employee/`
- Organization Admin: `src/workspaces/organization_admin/`
- Organization Owner: `src/workspaces/organization/`
- Platform Admin: `src/workspaces/platform/`
- Portal: `src/workspaces/portal/`

---

*End of Debug Report*
