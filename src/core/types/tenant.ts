/**
 * Multi-Tenant Types
 * 
 * These types correspond to the new database tables created for multi-tenancy
 */

import { AppRole } from "./roles";
import type { ModuleType } from "./modules";

// Re-export for consumers that import from this file
export type { ModuleType } from "./modules";

/**
 * Tenant status
 */
export type TenantStatus = "active" | "suspended" | "cancelled" | "trial";

/**
 * Subscription plan types
 */
export type PlanType = "starter" | "professional" | "enterprise";

/**
 * Tenant subscription - tracks which modules are enabled for a tenant
 */
export interface TenantSubscription {
  id: string;
  tenant_id: string;
  module_crm: boolean;
  module_clm: boolean;
  module_cpq: boolean;
  module_erp: boolean;
  module_documents: boolean;
  features: Record<string, boolean>;
  status: "active" | "suspended" | "cancelled";
  billing_email?: string;
  billing_contact?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Tenant - represents a customer organization
 */
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  plan_type: PlanType;

  // Company details
  company_name?: string;
  company_email?: string;
  company_phone?: string;
  company_address?: string;
  company_website?: string;

  // Branding
  logo_url?: string;
  primary_color?: string;

  // Subscription
  subscription_start_date?: string;
  subscription_end_date?: string;
  max_users: number;
  max_storage_mb: number;

  // Timestamps
  created_at: string;
  updated_at: string;
}

/**
 * Tenant user - links a user to a tenant with a specific role
 */
export interface TenantUser {
  id: string;
  tenant_id: string;
  user_id: string;
  role: AppRole;
  department?: string;
  is_active: boolean;
  is_approved: boolean;
  created_at: string;
  updated_at: string;

  // Populated relations
  tenant?: Tenant;
}

/**
 * Tenant invitation - for inviting users to a tenant
 */
export interface TenantInvitation {
  id: string;
  tenant_id: string;
  email: string;
  role: AppRole;
  department?: string;
  invited_by: string;
  invitation_token: string;
  status: "pending" | "accepted" | "expired" | "cancelled";
  expires_at: string;
  created_at: string;
}

/**
 * Tenant client - external customers of a tenant
 */
export interface TenantClient {
  id: string;
  tenant_id: string;
  user_id?: string;
  company_name: string;
  company_email?: string;
  company_phone?: string;
  contact_name?: string;
  contact_email?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * User's authentication context including tenant information
 */
export interface AuthUser {
  // Supabase auth user
  id: string;
  email: string;
  email_confirmed_at?: string;
  created_at: string;

  // Platform-level role (for SaaS owner)
  platform_role?: AppRole;

  // Tenant-level role
  tenant_id?: string;
  tenant_role?: AppRole;
  tenant?: Tenant;
  tenant_subscription?: TenantSubscription;

  // Approval status
  is_approved: boolean;

  // All tenant memberships (user might belong to multiple tenants)
  tenant_memberships?: TenantUser[];
}

/**
 * Plan configuration - defines what modules are available in each plan
 */
export const PLAN_MODULES: Record<PlanType, ModuleType[]> = {
  starter: ["crm", "cpq", "documents"],
  professional: ["crm", "cpq", "clm", "documents"],
  enterprise: ["crm", "cpq", "clm", "erp", "documents"],
};

/**
 * Check if a module is available in a plan
 */
export const isModuleInPlan = (module: ModuleType, plan: PlanType): boolean => {
  return PLAN_MODULES[plan].includes(module);
};

/**
 * Check if a module is enabled for a tenant
 */
export const isModuleEnabled = (
  subscription: TenantSubscription | null | undefined,
  module: ModuleType
): boolean => {
  if (!subscription) return false;

  switch (module) {
    case "crm":
      return subscription.module_crm;
    case "clm":
      return subscription.module_clm;
    case "cpq":
      return subscription.module_cpq;
    case "erp":
      return subscription.module_erp;
    case "documents":
      return subscription.module_documents;
    default:
      return false;
  }
};

/**
 * Get all enabled modules for a tenant
 */
export const getEnabledModules = (
  subscription: TenantSubscription | undefined
): ModuleType[] => {
  if (!subscription) return [];

  const modules: ModuleType[] = [];
  if (subscription.module_crm) modules.push("crm");
  if (subscription.module_clm) modules.push("clm");
  if (subscription.module_cpq) modules.push("cpq");
  if (subscription.module_erp) modules.push("erp");
  if (subscription.module_documents) modules.push("documents");

  return modules;
};
