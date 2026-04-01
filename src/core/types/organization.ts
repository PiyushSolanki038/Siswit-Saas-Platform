import type { ModuleType } from "./modules";
import { isModuleEnabled as isModuleEnabledUtil } from "@/core/utils/modules";

export type OrganizationStatus = "active" | "suspended" | "cancelled" | "trial";
export type OrganizationPlan = "foundation" | "growth" | "commercial" | "enterprise";

// Re-export for consumers that import ModuleType from this file
export type { ModuleType } from "./modules";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  owner_user_id?: string | null;
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
  is_trial?: boolean;
  trial_start_date?: string | null;
  trial_end_date?: string | null;
  razorpay_subscription_id?: string | null;
  razorpay_plan_id?: string | null;
  subscription_start_date?: string | null;
  subscription_end_date?: string | null;
  cancelled_at?: string | null;
  cancel_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMembership {
  id: string;
  organization_id: string;
  user_id: string;
  email?: string | null;
  role: string;
  department?: string | null;
  account_state: string;
  is_active: boolean;
  contact_id?: string | null;
  account_id?: string | null;
  organization?: Organization | null;
  created_at?: string | null;
}

export const isModuleEnabled = (
  subscription: OrganizationSubscription | null | undefined,
  module: ModuleType,
): boolean => isModuleEnabledUtil(subscription, module);
