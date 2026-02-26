import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useOrganization } from "@/hooks/useOrganization";
import { Loader2 } from "lucide-react";
import { organizationDashboardPath, organizationPortalPath, platformPath } from "@/lib/routes";
import {
  canAccessClientPortal,
  canAccessTenantWorkspace,
  isPendingApproval,
  isPlatformRole,
  isTenantAdminRole,
} from "@/types/roles";

function RouteLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}

/**
 * Platform Admin Route - Only for SaaS owner
 */
export function PlatformAdminRoute({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth();
  
  if (loading) {
    return <RouteLoader />;
  }
  
  if (!user || !isPlatformRole(role ?? "pending_approval")) {
    return <Navigate to="/unauthorized" replace />;
  }
  
  return <>{children}</>;
}

/**
 * Pending Approval Route - For users waiting for admin approval
 */
export function PendingApprovalRoute({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth();
  const { tenant } = useTenant();
  const { organization } = useOrganization();
  
  if (loading) {
    return <RouteLoader />;
  }
  
  if (!user) {
    return <Navigate to="/auth/sign-in" replace />;
  }
  
  // Allow access if role is pending_approval
  if (isPendingApproval(role ?? "pending_approval")) {
    return <>{children}</>;
  }
  
  // If already approved, redirect to appropriate dashboard
  if (isPlatformRole(role ?? "pending_approval")) {
    return <Navigate to={platformPath()} replace />;
  }
  if (canAccessTenantWorkspace(role)) {
    const workspaceSlug = organization?.slug ?? tenant?.slug;
    if (!workspaceSlug) return <Navigate to="/unauthorized" replace />;
    return <Navigate to={organizationDashboardPath(workspaceSlug)} replace />;
  }
  if (role === "client") {
    const workspaceSlug = organization?.slug ?? tenant?.slug;
    if (!workspaceSlug) return <Navigate to="/unauthorized" replace />;
    return <Navigate to={organizationPortalPath(workspaceSlug)} replace />;
  }
  
  return <Navigate to="/auth/sign-in" replace />;
}

/**
 * Tenant Admin Route - For tenant admins and users
 */
export function TenantAdminRoute({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth();
  
  if (loading) {
    return <RouteLoader />;
  }
  
  if (!user) {
    return <Navigate to="/auth/sign-in" replace />;
  }
  
  // Platform admin can also access
  if (isPlatformRole(role ?? "pending_approval")) {
    return <>{children}</>;
  }

  if (canAccessTenantWorkspace(role)) {
    return <>{children}</>;
  }

  if (isPendingApproval(role ?? "pending_approval")) {
    return <Navigate to="/pending-approval" replace />;
  }
  
  return <Navigate to="/unauthorized" replace />;
}

/**
 * Client/User Route - For external customers (portal access)
 */
export function ClientRoute({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth();
  
  if (loading) {
    return <RouteLoader />;
  }
  
  if (!user) {
    return <Navigate to="/auth/sign-in" replace />;
  }
  
  if (role === "client") {
    return <>{children}</>;
  }

  if (isPendingApproval(role ?? "pending_approval")) {
    return <Navigate to="/pending-approval" replace />;
  }

  if (canAccessClientPortal(role)) {
    return <>{children}</>;
  }
  
  return <Navigate to="/unauthorized" replace />;
}

/**
 * Organization Owner Route - owner/admin controls
 */
export function OrganizationOwnerRoute({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth();

  if (loading) {
    return <RouteLoader />;
  }

  if (!user) {
    return <Navigate to="/auth/sign-in" replace />;
  }

  if (isPlatformRole(role ?? null)) {
    return <Navigate to={platformPath()} replace />;
  }

  if (role === "owner" || role === "admin") {
    return <>{children}</>;
  }

  if (canAccessTenantWorkspace(role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (role === "client") {
    return <Navigate to="/unauthorized" replace />;
  }

  if (isPendingApproval(role ?? null)) {
    return <Navigate to="/pending-approval" replace />;
  }

  return <Navigate to="/unauthorized" replace />;
}

/**
 * Legacy compatibility - maps old EmployeeRoute to TenantUser
 */
export function EmployeeRoute({ children }: { children: React.ReactNode }) {
  return <TenantAdminRoute>{children}</TenantAdminRoute>;
}

/**
 * Legacy compatibility - maps old CustomerRoute to ClientRoute
 */
export function CustomerRoute({ children }: { children: React.ReactNode }) {
  return <ClientRoute>{children}</ClientRoute>;
}

/**
 * Admin Route - Either platform admin or tenant admin
 */
export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth();
  
  if (loading) {
    return <RouteLoader />;
  }
  
  if (!user) {
    return <Navigate to="/auth/sign-in" replace />;
  }
  
  if (isPlatformRole(role ?? "pending_approval") || isTenantAdminRole(role)) {
    return <>{children}</>;
  }

  if (isPendingApproval(role ?? "pending_approval")) {
    return <Navigate to="/pending-approval" replace />;
  }
  
  return <Navigate to="/unauthorized" replace />;
}
