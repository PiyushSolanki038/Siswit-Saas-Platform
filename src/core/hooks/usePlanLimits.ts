// src/core/hooks/usePlanLimits.ts
// React hook for checking and enforcing plan limits.

import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/core/api/client";
import { useOrganization } from "@/workspaces/organization/hooks/useOrganization";
import { useCreateNotification } from "@/core/hooks/useCreateNotification";
import type {
  PlanType,
  ResourceType,
  UsageEntry,
  PlanLimitCheckResult,
  UsageIncrementResult,
} from "@/core/utils/plan-limits";
import {
  isNearLimit,
  isAtLimit,
  PLAN_LIMITS,
} from "@/core/utils/plan-limits";

interface UsePlanLimitsReturn {
  /** Whether the usage data is still loading */
  isLoading: boolean;
  /** Current plan type for the organization */
  planType: PlanType;
  /** All usage data keyed by resource type */
  usage: Record<string, UsageEntry>;
  /** Check if a resource can be created (does not mutate) */
  checkLimit: (resource: ResourceType) => Promise<PlanLimitCheckResult>;
  /** Increment usage for a resource (call after successful creation) */
  incrementUsage: (resource: ResourceType, amount?: number) => Promise<UsageIncrementResult>;
  /** Decrement usage for a resource (call after successful deletion) */
  decrementUsage: (resource: ResourceType, amount?: number) => Promise<void>;
  /** Get current usage info for a resource (from cache) */
  getUsageForResource: (resource: ResourceType) => UsageEntry | null;
  /** Check if a resource is near its limit (>=80%) */
  isResourceNearLimit: (resource: ResourceType) => boolean;
  /** Check if a resource is at its limit */
  isResourceAtLimit: (resource: ResourceType) => boolean;
  /** Get effective limit including addons for a resource */
  getEffectiveLimit: (resource: ResourceType) => number;
  /** Refresh usage data */
  refreshUsage: () => void;
}

// Legacy plan type mapping: old values -> new values
function mapLegacyPlanType(planType: string | null | undefined): PlanType {
  if (!planType) return "foundation";
  
  // Map legacy plan types to new ones
  switch (planType.toLowerCase()) {
    case "starter":
      return "foundation";
    case "professional":
      return "growth";
    case "enterprise":
      return "enterprise";
    case "foundation":
    case "growth":
    case "commercial":
      return planType as PlanType;
    default:
      return "foundation";
  }
}

export function usePlanLimits(): UsePlanLimitsReturn {
  const { organization, subscription } = useOrganization();
  const queryClient = useQueryClient();
  const { notify } = useCreateNotification();

  const organizationId = organization?.id ?? null;
  const planType: PlanType = mapLegacyPlanType(subscription?.plan_type) ?? mapLegacyPlanType(organization?.plan_type) ?? "foundation";

  // Fetch all usage data for the organization
  const { data: usageData, isLoading } = useQuery({
    queryKey: ["organization_usage", organizationId],
    enabled: !!organizationId,
    staleTime: 30_000, // 30 seconds
    queryFn: async () => {
      if (!organizationId) return {};

      const { data, error } = await supabase.rpc("get_organization_usage", {
        p_organization_id: organizationId,
      });

      if (error) {
        console.error("Failed to fetch organization usage:", error);
        return {};
      }

      return (data as unknown as Record<string, UsageEntry>) ?? {};
    },
  });

  const usage = useMemo(() => usageData ?? {}, [usageData]);

  const checkLimit = useCallback(
    async (resource: ResourceType): Promise<PlanLimitCheckResult> => {
      if (!organizationId) {
        return { allowed: false, current_count: 0, max_allowed: 0, remaining: 0 };
      }

      const { data, error } = await supabase.rpc("check_plan_limit", {
        p_organization_id: organizationId,
        p_resource_type: resource,
      });

      if (error) {
        console.error("Failed to check plan limit:", error);
        // Fail open — allow the operation if we can't check
        return { allowed: true, current_count: 0, max_allowed: 999999999, remaining: 999999999 };
      }

      const result = data as unknown as PlanLimitCheckResult;

      // Notify if usage > 80%
      if (result.max_allowed > 0) {
        const percent = (result.current_count / result.max_allowed) * 100;
        if (percent >= 80 && organizationId && (organization as any)?.owner_id) {
          notify({
            userId: (organization as any).owner_id,
            organizationId: organizationId,
            type: percent >= 100 ? "plan_limit_reached" : "plan_limit_warning",
            title: percent >= 100 ? "Plan Limit Reached" : "Plan Limit Warning",
            message: `You are at ${percent.toFixed(0)}% of your ${resource} limit`,
            link: "/organization/plans",
          });
        }
      }

      return result;
    },
    [organizationId, organization?.owner_id, notify],
  );

  const incrementUsage = useCallback(
    async (resource: ResourceType, amount = 1): Promise<UsageIncrementResult> => {
      if (!organizationId) {
        return { success: false, error: "No organization", current_count: 0, max_allowed: 0 };
      }

      const { data, error } = await supabase.rpc("increment_usage", {
        p_organization_id: organizationId,
        p_resource_type: resource,
        p_amount: amount,
      });

      if (error) {
        console.error("Failed to increment usage:", error);
        return { success: false, error: error.message, current_count: 0, max_allowed: 0 };
      }

      // Invalidate cache so UI updates
      void queryClient.invalidateQueries({ queryKey: ["organization_usage", organizationId] });

      return data as unknown as UsageIncrementResult;
    },
    [organizationId, queryClient],
  );

  const decrementUsage = useCallback(
    async (resource: ResourceType, amount = 1): Promise<void> => {
      if (!organizationId) return;

      const { error } = await supabase.rpc("decrement_usage", {
        p_organization_id: organizationId,
        p_resource_type: resource,
        p_amount: amount,
      });

      if (error) {
        console.error("Failed to decrement usage:", error);
      }

      // Invalidate cache so UI updates
      void queryClient.invalidateQueries({ queryKey: ["organization_usage", organizationId] });
    },
    [organizationId, queryClient],
  );

  const getUsageForResource = useCallback(
    (resource: ResourceType): UsageEntry | null => {
      const entry = usage[resource];
      if (!entry) {
        // Fall back to plan defaults
        const planLimit = PLAN_LIMITS[planType]?.[resource];
        if (planLimit) {
          return {
            current_count: 0,
            max_allowed: planLimit.max,
            period: planLimit.period,
            usage_percent: 0,
          };
        }
        return null;
      }
      return entry;
    },
    [usage, planType],
  );

  const isResourceNearLimit = useCallback(
    (resource: ResourceType): boolean => {
      const entry = getUsageForResource(resource);
      if (!entry) return false;
      return isNearLimit(entry.current_count, entry.max_allowed);
    },
    [getUsageForResource],
  );

  const isResourceAtLimit = useCallback(
    (resource: ResourceType): boolean => {
      const entry = getUsageForResource(resource);
      if (!entry) return false;
      return isAtLimit(entry.current_count, entry.max_allowed);
    },
    [getUsageForResource],
  );

  const refreshUsage = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["organization_usage", organizationId] });
  }, [organizationId, queryClient]);

  const getEffectiveLimit = useCallback(
    (resource: ResourceType): number => {
      const baseLimit = usage[resource]?.max_allowed ?? 0;
      return baseLimit;
    },
    [usage]
  );

  return {
    isLoading,
    planType,
    usage,
    checkLimit,
    incrementUsage,
    decrementUsage,
    getUsageForResource,
    isResourceNearLimit,
    isResourceAtLimit,
    getEffectiveLimit,
    refreshUsage,
  };
}

export function useUpgradePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ organizationId, newPlan }: { organizationId: string; newPlan: PlanType }) => {
      const { data, error } = await (supabase.rpc as any)("upgrade_organization_plan", {
        p_organization_id: organizationId,
        p_new_plan: newPlan,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data: unknown, variables: { organizationId: string; newPlan: PlanType }) => {
      queryClient.invalidateQueries({ queryKey: ["organization"] });
      queryClient.invalidateQueries({ queryKey: ["plan-limits"] });
      queryClient.invalidateQueries({ queryKey: ["organization_usage", variables.organizationId] });
    },
  });
}

