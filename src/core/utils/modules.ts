import { ALL_MODULES, type ModuleType } from "@/core/types/modules";

export type ModulePlanType = "foundation" | "growth" | "enterprise" | "commercial";

type ModuleFlagKey = `module_${ModuleType}`;
type ModuleFlags = Partial<Record<ModuleFlagKey, boolean>> | null | undefined;

export const PLAN_MODULES: Record<ModulePlanType, ModuleType[]> = {
  foundation: ["crm", "cpq", "documents"],
  growth: ["crm", "cpq", "clm", "documents"],
  commercial: ["crm", "cpq", "clm", "erp", "documents"],
  enterprise: ["crm", "cpq", "clm", "erp", "documents"],
};

export function isModuleInPlan(module: ModuleType, plan: ModulePlanType): boolean {
  return PLAN_MODULES[plan].includes(module);
}

export function isModuleEnabled(subscription: ModuleFlags, module: ModuleType): boolean {
  if (!subscription) return false;
  const key = `module_${module}` as ModuleFlagKey;
  return Boolean(subscription[key]);
}

export function getEnabledModules(subscription: ModuleFlags): ModuleType[] {
  if (!subscription) return [];
  return ALL_MODULES.filter((module) => isModuleEnabled(subscription, module));
}
