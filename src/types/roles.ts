/**
 * Organization-native role system with legacy compatibility mappings.
 */

export enum PlatformRole {
  PLATFORM_SUPER_ADMIN = "platform_super_admin",
}

export enum OrganizationRole {
  OWNER = "owner",
  ADMIN = "admin",
  MANAGER = "manager",
  EMPLOYEE = "employee",
  CLIENT = "client",
}

export type LegacyRole = "platform_admin" | "user" | "pending_approval" | "rejected" | "platform_super_admin";
export type CanonicalRole = PlatformRole | OrganizationRole;
export type AppRole = CanonicalRole | LegacyRole;
export type WorkspaceRole =
  | PlatformRole.PLATFORM_SUPER_ADMIN
  | OrganizationRole.OWNER
  | OrganizationRole.ADMIN
  | OrganizationRole.MANAGER
  | OrganizationRole.EMPLOYEE;

export type OwnerScopedRole = OrganizationRole.EMPLOYEE | OrganizationRole.CLIENT;

export const AppRole = {
  PLATFORM_SUPER_ADMIN: PlatformRole.PLATFORM_SUPER_ADMIN as AppRole,

  OWNER: OrganizationRole.OWNER as AppRole,
  ADMIN: OrganizationRole.ADMIN as AppRole,
  MANAGER: OrganizationRole.MANAGER as AppRole,
  EMPLOYEE: OrganizationRole.EMPLOYEE as AppRole,
  CLIENT: OrganizationRole.CLIENT as AppRole,

  // Legacy aliases
  PLATFORM_ADMIN: "platform_admin" as AppRole,
  USER: "user" as AppRole,
  PENDING_APPROVAL: "pending_approval" as AppRole,
  REJECTED: "rejected" as AppRole,
};

export const RoleHierarchy = {
  platform_super_admin: { level: 100, label: "Platform Super Admin", type: "platform" },
  platform_admin: { level: 100, label: "Platform Super Admin", type: "platform" },
  owner: { level: 80, label: "Organization Owner", type: "organization" },
  admin: { level: 70, label: "Organization Admin", type: "organization" },
  manager: { level: 60, label: "Manager", type: "organization" },
  employee: { level: 50, label: "Employee", type: "organization" },
  user: { level: 50, label: "Employee", type: "organization" },
  client: { level: 20, label: "Client", type: "client" },
  pending_approval: { level: 10, label: "Pending Approval", type: "state" },
  rejected: { level: 0, label: "Rejected", type: "state" },
} as const;

export function normalizeRole(role: string | null | undefined): AppRole | null {
  if (!role) return null;

  const value = role.toLowerCase();

  switch (value) {
    case "platform_super_admin":
    case "platform_admin":
      return PlatformRole.PLATFORM_SUPER_ADMIN;
    case "owner":
      return OrganizationRole.OWNER;
    case "admin":
    case "tenant_admin":
    case "legacy_admin":
      return OrganizationRole.ADMIN;
    case "manager":
    case "tenant_manager":
      return OrganizationRole.MANAGER;
    case "employee":
    case "user":
    case "tenant_user":
      return OrganizationRole.EMPLOYEE;
    case "client":
    case "client_user":
      return OrganizationRole.CLIENT;
    case "pending_approval":
      return "pending_approval";
    case "rejected":
      return "rejected";
    default:
      return null;
  }
}

export const isPlatformRole = (role: AppRole | null | undefined): boolean => {
  return role === "platform_super_admin" || role === "platform_admin";
};

export const isOrganizationRole = (role: AppRole | null | undefined): boolean => {
  return (
    role === "owner" ||
    role === "admin" ||
    role === "manager" ||
    role === "employee" ||
    role === "user" ||
    role === "client"
  );
};

export const isClientRole = (role: AppRole | null | undefined): boolean => {
  return role === "client";
};

export const isOwnerRole = (role: AppRole | null | undefined): boolean => {
  return role === "owner";
};

export const isTenantAdminRole = (role: AppRole | null | undefined): boolean => {
  return role === "admin" || role === "owner";
};

export const isManagerRole = (role: AppRole | null | undefined): boolean => {
  return role === "manager";
};

export const isTenantUserRole = (role: AppRole | null | undefined): boolean => {
  return role === "employee" || role === "user";
};

export const isPendingApproval = (role: AppRole | null | undefined): boolean => {
  return role === "pending_approval";
};

export const isRejected = (role: AppRole | null | undefined): boolean => {
  return role === "rejected";
};

export const canReadAllTenantRows = (role: AppRole | null | undefined): boolean => {
  return (
    role === "platform_super_admin" ||
    role === "platform_admin" ||
    role === "owner" ||
    role === "admin" ||
    role === "manager"
  );
};

export const isOwnerScopedRole = (role: AppRole | null | undefined): role is OwnerScopedRole => {
  return role === "employee" || role === "user" || role === "client";
};

export const canAccessTenantWorkspace = (role: AppRole | null | undefined): role is WorkspaceRole | "platform_admin" => {
  return (
    role === "platform_super_admin" ||
    role === "platform_admin" ||
    role === "owner" ||
    role === "admin" ||
    role === "manager" ||
    role === "employee" ||
    role === "user"
  );
};

export const canAccessClientPortal = (role: AppRole | null | undefined): boolean => {
  return (
    role === "platform_super_admin" ||
    role === "platform_admin" ||
    role === "owner" ||
    role === "admin" ||
    role === "client"
  );
};

export const getRoleLabel = (role: AppRole | null | undefined): string => {
  if (!role) return "Unknown";
  return RoleHierarchy[role as keyof typeof RoleHierarchy]?.label ?? "Unknown";
};
