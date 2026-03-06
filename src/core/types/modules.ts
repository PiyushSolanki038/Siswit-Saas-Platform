/**
 * Shared module type definitions
 *
 * Single source of truth for ModuleType used across both
 * the Organization and Tenant type systems.
 */

export type ModuleType = "crm" | "clm" | "cpq" | "erp" | "documents";

export const ALL_MODULES: ModuleType[] = ["crm", "clm", "cpq", "erp", "documents"];
