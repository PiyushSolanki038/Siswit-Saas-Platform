// src/core/hooks/useSubscription.ts
// Comprehensive subscription management hook with Razorpay checkout integration.

import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/core/api/client";
import { useOrganization } from "@/workspaces/organization/hooks/useOrganization";
import { useBillingInfo, useCreateBillingCustomer } from "@/workspaces/organization/hooks/useBilling";
import { toast } from "sonner";
import type { PlanType } from "@/core/utils/plan-limits";

// ---------- types ----------

export interface SubscriptionStatus {
  plan_type: PlanType;
  status: string;
  is_trial: boolean;
  trial_start_date: string | null;
  trial_end_date: string | null;
  trial_days_remaining: number | null;
  razorpay_subscription_id: string | null;
  subscription_start_date: string | null;
  subscription_end_date: string | null;
  cancelled_at: string | null;
  cancel_reason?: string | null;
  billing_customer_id: string | null;
}

export interface SubscriptionEvent {
  id: string;
  organization_id: string;
  event_type: string;
  plan_type: string | null;
  amount: number | null;
  razorpay_payment_id: string | null;
  razorpay_subscription_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface UseSubscriptionReturn {
  /** Full subscription status */
  subscription: SubscriptionStatus | null;
  /** Whether data is loading */
  isLoading: boolean;
  /** Whether user is on a trial plan */
  isTrial: boolean;
  /** Days remaining in trial (null if not on trial) */
  trialDaysRemaining: number | null;
  /** Whether trial/subscription has expired */
  isExpired: boolean;
  /** Whether the subscription is active (paid) */
  isActive: boolean;
  /** Initiate Razorpay checkout for a plan */
  initiateCheckout: (planType: PlanType) => Promise<void>;
  /** Cancel the current subscription */
  cancelSubscription: (reason: string) => Promise<void>;
  /** Whether a checkout is in progress */
  isCheckoutPending: boolean;
  /** Whether a cancel is in progress */
  isCancelPending: boolean;
  /** Subscription event history */
  events: SubscriptionEvent[];
  /** Whether events are loading */
  eventsLoading: boolean;
  /** Refresh subscription data */
  refresh: () => void;
}

// ---------- Razorpay script loader ----------

let razorpayScriptLoaded = false;
let razorpayScriptLoading: Promise<void> | null = null;

function loadRazorpayScript(): Promise<void> {
  if (razorpayScriptLoaded) return Promise.resolve();
  if (razorpayScriptLoading) return razorpayScriptLoading;

  razorpayScriptLoading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => {
      razorpayScriptLoaded = true;
      resolve();
    };
    script.onerror = () => {
      razorpayScriptLoading = null;
      reject(new Error("Failed to load Razorpay checkout script"));
    };
    document.head.appendChild(script);
  });

  return razorpayScriptLoading;
}

// ---------- Razorpay window type ----------

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

interface RazorpayOptions {
  key: string;
  subscription_id: string;
  name: string;
  description: string;
  handler: (response: RazorpayResponse) => void;
  modal?: {
    ondismiss?: () => void;
  };
  prefill?: {
    name?: string;
    email?: string;
  };
  theme?: {
    color?: string;
  };
  notes?: Record<string, string>;
}

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open: () => void;
  close: () => void;
}

// ---------- constants ----------

const PLAN_DISPLAY_NAMES: Record<PlanType, string> = {
  foundation: "Foundation CRM",
  growth: "Revenue Growth",
  commercial: "Commercial Control",
  enterprise: "Enterprise Governance",
};

// ---------- hook ----------

export function useSubscription(): UseSubscriptionReturn {
  const { organization } = useOrganization();
  const queryClient = useQueryClient();
  const { data: billingInfo } = useBillingInfo();
  const createCustomer = useCreateBillingCustomer();

  const organizationId = organization?.id ?? null;

  // Fetch subscription status via RPC
  const { data: subscription, isLoading } = useQuery({
    queryKey: ["subscription_status", organizationId],
    enabled: !!organizationId,
    staleTime: 15_000,
    queryFn: async (): Promise<SubscriptionStatus | null> => {
      if (!organizationId) return null;

      const { data, error } = await (supabase.rpc as any)("get_subscription_status", {
        p_org_id: organizationId,
      });

      if (error) {
        console.error("Failed to fetch subscription status:", error);
        return null;
      }

      return (data as unknown as SubscriptionStatus) ?? null;
    },
  });

  // Fetch subscription events
  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ["subscription_events", organizationId],
    enabled: !!organizationId,
    staleTime: 30_000,
    queryFn: async (): Promise<SubscriptionEvent[]> => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from("subscription_events")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Failed to fetch subscription events:", error);
        return [];
      }

      return (data as unknown as SubscriptionEvent[]) ?? [];
    },
  });

  // Computed values
  const isTrial = subscription?.is_trial ?? true;
  const trialDaysRemaining = subscription?.trial_days_remaining ?? null;
  const isActive = subscription?.status === "active" && !subscription.is_trial;

  const isExpired = useMemo(() => {
    if (!subscription) return false;
    if (subscription.status === "cancelled") return true;
    if (subscription.is_trial && subscription.trial_end_date) {
      return new Date(subscription.trial_end_date) < new Date();
    }
    if (subscription.subscription_end_date) {
      return new Date(subscription.subscription_end_date) < new Date();
    }
    return false;
  }, [subscription]);

  // Refresh helper
  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["subscription_status", organizationId] });
    void queryClient.invalidateQueries({ queryKey: ["subscription_events", organizationId] });
    void queryClient.invalidateQueries({ queryKey: ["billing_info"] });
    void queryClient.invalidateQueries({ queryKey: ["organization"] });
  }, [organizationId, queryClient]);

  // Checkout mutation
  const checkoutMutation = useMutation({
    mutationFn: async (planType: PlanType) => {
      if (!organizationId) throw new Error("No organization context");

      // 1. Ensure billing customer exists
      let customerId = billingInfo?.customer_id;
      if (!customerId) {
        const billingEmail = organization?.company_email ?? "";
        const billingName = organization?.name ?? "";
        if (!billingEmail) {
          throw new Error("Please set a company email in organization settings first");
        }
        const result = await createCustomer.mutateAsync({
          email: billingEmail,
          name: billingName,
        });
        customerId = (result as any)?.customer_id;
      }

      if (!customerId) {
        throw new Error("Failed to create billing customer");
      }

      // 2. Call edge function to create Razorpay subscription
      const { data: fnData, error: fnError } = await supabase.functions.invoke(
        "create-razorpay-subscription",
        {
          body: {
            organization_id: organizationId,
            plan_type: planType,
            customer_id: customerId,
          },
        },
      );

      if (fnError) {
        throw new Error(
          fnError.message ?? "Failed to create subscription",
        );
      }

      const subData = fnData as {
        subscription_id: string;
        short_url: string;
      };

      // 3. Load Razorpay checkout
      await loadRazorpayScript();

      // 4. Open Razorpay modal
      return new Promise<void>((resolve, reject) => {
        const razorpayKeyId = import.meta.env.VITE_RAZORPAY_KEY_ID;
        if (!razorpayKeyId) {
          reject(new Error("Razorpay key not configured"));
          return;
        }

        const options: RazorpayOptions = {
          key: razorpayKeyId,
          subscription_id: subData.subscription_id,
          name: "SISWIT",
          description: `${PLAN_DISPLAY_NAMES[planType]} — Monthly Subscription`,
          handler: (_response: RazorpayResponse) => {
            // Payment successful — webhook will handle activation
            toast.success(
              "Payment successful! Your plan will be activated shortly.",
            );
            // Poll subscription status for a few seconds to pick up webhook
            setTimeout(() => refresh(), 2000);
            setTimeout(() => refresh(), 5000);
            setTimeout(() => refresh(), 10000);
            resolve();
          },
          modal: {
            ondismiss: () => {
              toast.info("Payment cancelled.");
              reject(new Error("Payment cancelled by user"));
            },
          },
          prefill: {
            name: organization?.name,
            email: organization?.company_email ?? undefined,
          },
          theme: {
            color: "#7c3aed",
          },
          notes: {
            organization_id: organizationId,
            plan_type: planType,
          },
        };

        try {
          const rzp = new window.Razorpay(options);
          rzp.open();
        } catch (err) {
          reject(
            new Error(
              `Failed to open Razorpay checkout: ${err instanceof Error ? err.message : String(err)}`,
            ),
          );
        }
      });
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg !== "Payment cancelled by user") {
        toast.error(`Checkout failed: ${msg}`);
      }
    },
  });

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: async (reason: string) => {
      if (!organizationId) throw new Error("No organization context");

      const { error } = await (supabase.rpc as any)("cancel_subscription", {
        p_org_id: organizationId,
        p_reason: reason,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Subscription cancelled. You have been downgraded to the Foundation plan.");
      refresh();
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to cancel: ${msg}`);
    },
  });

  const initiateCheckout = useCallback(
    async (planType: PlanType) => {
      await checkoutMutation.mutateAsync(planType);
    },
    [checkoutMutation],
  );

  const cancelSubscription = useCallback(
    async (reason: string) => {
      await cancelMutation.mutateAsync(reason);
    },
    [cancelMutation],
  );

  return {
    subscription,
    isLoading,
    isTrial,
    trialDaysRemaining,
    isExpired,
    isActive,
    initiateCheckout,
    cancelSubscription,
    isCheckoutPending: checkoutMutation.isPending,
    isCancelPending: cancelMutation.isPending,
    events,
    eventsLoading,
    refresh,
  };
}
