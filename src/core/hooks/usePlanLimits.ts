// src/core/hooks/usePlanLimits.ts
// React hook for checking and enforcing plan limits.
// Author: Solanki

import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/core/api/client";
import { useOrganization } from "@/workspaces/organization/hooks/useOrganization";
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
  /** Refresh usage data */
  refreshUsage: () => void;
}

export function usePlanLimits(): UsePlanLimitsReturn {
  const { organization, subscription } = useOrganization();
  const queryClient = useQueryClient();

  const organizationId = organization?.id ?? null;
  const planType: PlanType = (subscription?.plan_type as PlanType) ?? (organization?.plan_type as PlanType) ?? "foundation";

  // Fetch all usage data for the organization
  const { data: usageData, isLoading } = useQuery({
    queryKey: ["organization_usage", organizationId],
    enabled: !!organizationId,
    staleTime: 30_000, // 30 seconds
    queryFn: async () => {
      if (!organizationId) return {};

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)("get_organization_usage", {
        p_organization_id: organizationId,
      });

      if (error) {
        console.error("Failed to fetch organization usage:", error);
        return {};
      }

      return (data as Record<string, UsageEntry>) ?? {};
    },
  });

  const usage = useMemo(() => usageData ?? {}, [usageData]);

  const checkLimit = useCallback(
    async (resource: ResourceType): Promise<PlanLimitCheckResult> => {
      if (!organizationId) {
        return { allowed: false, current_count: 0, max_allowed: 0, remaining: 0 };
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)("check_plan_limit", {
        p_organization_id: organizationId,
        p_resource_type: resource,
      });

      if (error) {
        console.error("Failed to check plan limit:", error);
        // Fail open — allow the operation if we can't check
        return { allowed: true, current_count: 0, max_allowed: 999999999, remaining: 999999999 };
      }

      return data as PlanLimitCheckResult;
    },
    [organizationId],
  );

  const incrementUsage = useCallback(
    async (resource: ResourceType, amount = 1): Promise<UsageIncrementResult> => {
      if (!organizationId) {
        return { success: false, error: "No organization", current_count: 0, max_allowed: 0 };
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)("increment_usage", {
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

      return data as UsageIncrementResult;
    },
    [organizationId, queryClient],
  );

  const decrementUsage = useCallback(
    async (resource: ResourceType, amount = 1): Promise<void> => {
      if (!organizationId) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.rpc as any)("decrement_usage", {
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
    refreshUsage,
  };
}
