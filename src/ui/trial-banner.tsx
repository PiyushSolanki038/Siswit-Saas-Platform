// src/ui/trial-banner.tsx
// Color-coded trial banner that appears at the top of every page during trial period.

import { useState, useCallback } from "react";
import { X, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/ui/shadcn/button";
import { cn } from "@/core/utils/utils";
import { useSubscription } from "@/core/hooks/useSubscription";
import { PlanSelectionModal } from "@/ui/plan-selection-modal";

const DISMISS_KEY = "siswit_trial_banner_dismissed";

export function TrialBanner() {
  const { isTrial, trialDaysRemaining, isExpired, subscription, isLoading } =
    useSubscription();

  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === "true";
    } catch {
      return false;
    }
  });

  const [showPlanModal, setShowPlanModal] = useState(false);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "true");
    } catch {
      /* noop */
    }
  }, []);

  // Don't show if loading, dismissed, not on trial, or subscription is active
  if (isLoading || dismissed || (!isTrial && !isExpired)) return null;

  // Determine color scheme based on days remaining
  const days = trialDaysRemaining ?? 0;
  const isUrgent = days <= 3;
  const isWarning = days <= 7 && days > 3;
  // const isHealthy = days > 7;

  let bannerClasses: string;
  let iconClasses: string;
  let textClasses: string;
  let buttonClasses: string;

  if (isExpired) {
    bannerClasses = "bg-gradient-to-r from-red-950/90 via-red-900/80 to-red-950/90 border-red-500/30";
    iconClasses = "text-red-400";
    textClasses = "text-red-100";
    buttonClasses = "bg-red-500 hover:bg-red-600 text-white border-0";
  } else if (isUrgent) {
    bannerClasses = "bg-gradient-to-r from-red-950/80 via-red-900/60 to-red-950/80 border-red-500/20";
    iconClasses = "text-red-400 animate-pulse";
    textClasses = "text-red-100";
    buttonClasses = "bg-red-500 hover:bg-red-600 text-white border-0";
  } else if (isWarning) {
    bannerClasses = "bg-gradient-to-r from-amber-950/80 via-amber-900/60 to-amber-950/80 border-amber-500/20";
    iconClasses = "text-amber-400";
    textClasses = "text-amber-100";
    buttonClasses = "bg-amber-500 hover:bg-amber-600 text-black border-0";
  } else {
    bannerClasses = "bg-gradient-to-r from-emerald-950/80 via-emerald-900/60 to-emerald-950/80 border-emerald-500/20";
    iconClasses = "text-emerald-400";
    textClasses = "text-emerald-100";
    buttonClasses = "bg-emerald-500 hover:bg-emerald-600 text-white border-0";
  }

  const getMessage = () => {
    if (isExpired) {
      return "Your free trial has expired. Upgrade now to continue using all features.";
    }
    if (days === 0) {
      return "Your free trial ends today! Upgrade now to avoid service interruption.";
    }
    if (days === 1) {
      return "Your free trial ends tomorrow. Upgrade now to keep all your data.";
    }
    return `You are on a 14-day free trial. ${days} days remaining.`;
  };

  return (
    <>
      <div
        className={cn(
          "relative w-full border-b px-4 py-2.5 flex items-center justify-center gap-3",
          "animate-in slide-in-from-top-2 duration-500",
          bannerClasses,
        )}
      >
        {/* Glow effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent pointer-events-none" />

        <Sparkles className={cn("h-4 w-4 shrink-0", iconClasses)} />

        <p className={cn("text-xs sm:text-sm font-medium", textClasses)}>
          {getMessage()}
        </p>

        <Button
          size="sm"
          className={cn(
            "h-7 px-3 text-[11px] font-bold uppercase tracking-wider rounded-full shrink-0",
            buttonClasses,
          )}
          onClick={() => setShowPlanModal(true)}
        >
          Upgrade Now
          <ArrowRight className="ml-1.5 h-3 w-3" />
        </Button>

        <button
          onClick={handleDismiss}
          className={cn(
            "absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full transition-colors",
            "hover:bg-white/10",
            textClasses,
          )}
          aria-label="Dismiss trial banner"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <PlanSelectionModal
        open={showPlanModal}
        onOpenChange={setShowPlanModal}
        currentPlan={subscription?.plan_type ?? "foundation"}
      />
    </>
  );
}
