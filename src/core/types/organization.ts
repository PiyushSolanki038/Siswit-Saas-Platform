import type { ModuleType } from "./modules";

export type OrganizationStatus = "active" | "suspended" | "cancelled" | "trial";
export type OrganizationPlan = "starter" | "professional" | "enterprise";

// Re-export for consumers that import ModuleType from this file
export type { ModuleType } from "./modules";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  org_code?: string;
  status: OrganizationStatus;
  plan_type: OrganizationPlan;
  company_name?: string;
  company_email?: string;
  company_phone?: string;
  company_address?: string;
  company_website?: string;
  logo_url?: string;
  primary_color?: string;
  max_users: number;
  max_storage_mb: number;
  created_at: string;
  updated_at: string;
}

export interface OrganizationSubscription {
  id: string;
  organization_id: string;
  plan_type: OrganizationPlan;
  status: "trial" | "active" | "suspended" | "cancelled" | "past_due";
  module_crm: boolean;
  module_clm: boolean;
  module_cpq: boolean;
  module_erp: boolean;
  module_documents: boolean;
  features: Record<string, boolean>;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMembership {
  id: string;
  organization_id: string;
  user_id: string;
  role: string;
  department?: string | null;
  account_state: string;
  is_active: boolean;
  organization?: Organization | null;
}

export const isModuleEnabled = (
  subscription: OrganizationSubscription | null | undefined,
  module: ModuleType,
): boolean => {
  if (!subscription) return false;

  switch (module) {
    case "crm":
      return Boolean(subscription.module_crm);
    case "clm":
      return Boolean(subscription.module_clm);
    case "cpq":
      return Boolean(subscription.module_cpq);
    case "erp":
      return Boolean(subscription.module_erp);
    case "documents":
      return Boolean(subscription.module_documents);
    default:
      return false;
  }
};
