// src/core/utils/plan-limits.ts
// Plan limit types, constants, and helper functions for the SISWIT pricing model.
// Author: Solanki

export type PlanType = "foundation" | "growth" | "commercial" | "enterprise";

export type ResourceType =
  | "contacts"
  | "accounts"
  | "leads"
  | "opportunities"
  | "products"
  | "quotes"
  | "contracts"
  | "contract_templates"
  | "documents"
  | "document_templates"
  | "suppliers"
  | "purchase_orders"
  | "storage_mb"
  | "api_calls"
  | "esignatures";

export type LimitPeriod = "total" | "monthly" | "daily";

export interface PlanLimitEntry {
  max: number;
  period: LimitPeriod;
}

export interface UsageEntry {
  current_count: number;
  max_allowed: number;
  period: LimitPeriod;
  usage_percent: number;
}

export interface PlanLimitCheckResult {
  allowed: boolean;
  current_count: number;
  max_allowed: number;
  remaining: number;
}

export interface UsageIncrementResult {
  success: boolean;
  error?: string;
  current_count: number;
  max_allowed: number;
}

const UNLIMITED = 999999999;

export const PLAN_PRICES: Record<PlanType, number> = {
  foundation: 799,
  growth: 1399,
  commercial: 2299,
  enterprise: 3799,
};

export const PLAN_LIMITS: Record<PlanType, Partial<Record<ResourceType, PlanLimitEntry>>> = {
  foundation: {
    contacts: { max: 500, period: "total" },
    accounts: { max: 100, period: "total" },
    leads: { max: 200, period: "total" },
    opportunities: { max: 100, period: "total" },
    products: { max: 50, period: "total" },
    quotes: { max: 50, period: "monthly" },
    documents: { max: 100, period: "total" },
    document_templates: { max: 10, period: "total" },
    storage_mb: { max: 1024, period: "total" },
    api_calls: { max: 1000, period: "daily" },
    esignatures: { max: 10, period: "monthly" },
  },
  growth: {
    contacts: { max: 5000, period: "total" },
    accounts: { max: 1000, period: "total" },
    leads: { max: 2000, period: "total" },
    opportunities: { max: 1000, period: "total" },
    products: { max: 500, period: "total" },
    quotes: { max: 500, period: "monthly" },
    contracts: { max: 100, period: "total" },
    contract_templates: { max: 20, period: "total" },
    documents: { max: 1000, period: "total" },
    document_templates: { max: 100, period: "total" },
    storage_mb: { max: 10240, period: "total" },
    api_calls: { max: 10000, period: "daily" },
    esignatures: { max: 100, period: "monthly" },
  },
  commercial: {
    contacts: { max: 50000, period: "total" },
    accounts: { max: 10000, period: "total" },
    leads: { max: 20000, period: "total" },
    opportunities: { max: 10000, period: "total" },
    products: { max: 5000, period: "total" },
    quotes: { max: 5000, period: "monthly" },
    contracts: { max: 1000, period: "total" },
    contract_templates: { max: 200, period: "total" },
    documents: { max: 10000, period: "total" },
    document_templates: { max: 1000, period: "total" },
    suppliers: { max: 500, period: "total" },
    purchase_orders: { max: 1000, period: "total" },
    storage_mb: { max: 102400, period: "total" },
    api_calls: { max: 100000, period: "daily" },
    esignatures: { max: 1000, period: "monthly" },
  },
  enterprise: {
    contacts: { max: UNLIMITED, period: "total" },
    accounts: { max: UNLIMITED, period: "total" },
    leads: { max: UNLIMITED, period: "total" },
    opportunities: { max: UNLIMITED, period: "total" },
    products: { max: UNLIMITED, period: "total" },
    quotes: { max: UNLIMITED, period: "monthly" },
    contracts: { max: UNLIMITED, period: "total" },
    contract_templates: { max: UNLIMITED, period: "total" },
    documents: { max: UNLIMITED, period: "total" },
    document_templates: { max: UNLIMITED, period: "total" },
    suppliers: { max: UNLIMITED, period: "total" },
    purchase_orders: { max: UNLIMITED, period: "total" },
    storage_mb: { max: 512000, period: "total" },
    api_calls: { max: UNLIMITED, period: "daily" },
    esignatures: { max: UNLIMITED, period: "monthly" },
  },
};

export function getLimit(plan: PlanType, resource: ResourceType): PlanLimitEntry | null {
  return PLAN_LIMITS[plan]?.[resource] ?? null;
}

export function isUnlimited(max: number): boolean {
  return max >= UNLIMITED;
}

export function getUsagePercent(current: number, max: number): number {
  if (isUnlimited(max)) return 0;
  if (max <= 0) return 100;
  return Math.min(100, Math.round((current / max) * 100));
}

export function isNearLimit(current: number, max: number, thresholdPercent = 80): boolean {
  if (isUnlimited(max)) return false;
  return getUsagePercent(current, max) >= thresholdPercent;
}

export function isAtLimit(current: number, max: number): boolean {
  if (isUnlimited(max)) return false;
  return current >= max;
}

export function getUpgradePlanFor(currentPlan: PlanType): PlanType | null {
  switch (currentPlan) {
    case "foundation":
      return "growth";
    case "growth":
      return "commercial";
    case "commercial":
      return "enterprise";
    case "enterprise":
      return null;
  }
}

export function formatLimit(max: number): string {
  if (isUnlimited(max)) return "Unlimited";
  if (max >= 1000) return `${(max / 1000).toFixed(max % 1000 === 0 ? 0 : 1)}K`;
  return max.toString();
}

export function getResourceLabel(resource: ResourceType): string {
  const labels: Record<ResourceType, string> = {
    contacts: "Contacts",
    accounts: "Accounts",
    leads: "Leads",
    opportunities: "Opportunities",
    products: "Products",
    quotes: "Quotes",
    contracts: "Contracts",
    contract_templates: "Contract Templates",
    documents: "Documents",
    document_templates: "Document Templates",
    suppliers: "Suppliers",
    purchase_orders: "Purchase Orders",
    storage_mb: "Storage (MB)",
    api_calls: "API Calls",
    esignatures: "E-Signatures",
  };
  return labels[resource] ?? resource;
}

export const ADD_ONS = {
  extra_users_10: {
    name: "10 Extra Users",
    price: 499,
    description: "Add 10 more user seats to your organization",
    resource: "users" as const,
    amount: 10,
  },
  extra_storage_5gb: {
    name: "5 GB Extra Storage",
    price: 349,
    description: "Add 5 GB of additional file storage",
    resource: "storage_mb" as const,
    amount: 5120,
  },
  extra_esignatures_50: {
    name: "50 Extra E-Signatures",
    price: 699,
    description: "Add 50 more e-signature requests per month",
    resource: "esignatures" as const,
    amount: 50,
  },
} as const;

export type AddOnKey = keyof typeof ADD_ONS;
