// src/ui/plan-selection-modal.tsx
// Full-featured plan comparison modal with Razorpay checkout integration.

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/ui/shadcn/dialog";
import { Button } from "@/ui/shadcn/button";
import { Badge } from "@/ui/shadcn/badge";
import {
  Crown,
  ArrowRight,
  Loader2,
  Check,
  Zap,
  Building2,
  Rocket,
  Shield,
} from "lucide-react";
import type { PlanType } from "@/core/utils/plan-limits";
import {
  PLAN_PRICES,
  getUpgradePlanFor,
} from "@/core/utils/plan-limits";
import { useSubscription } from "@/core/hooks/useSubscription";
import { cn } from "@/core/utils/utils";

// ---------- types ----------

interface PlanSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlan: PlanType;
}

// ---------- plan data ----------

const PLAN_ORDER: PlanType[] = ["foundation", "growth", "commercial", "enterprise"];

const PLAN_META: Record<
  PlanType,
  {
    name: string;
    tagline: string;
    icon: typeof Zap;
    color: string;
    gradient: string;
    features: string[];
  }
> = {
  foundation: {
    name: "Foundation CRM",
    tagline: "For small teams getting started",
    icon: Zap,
    color: "text-blue-400",
    gradient: "from-blue-500/20 to-blue-600/5",
    features: [
      "Up to 5 users",
      "500 contacts",
      "CRM + CPQ + Documents",
      "1 GB storage",
      "10 e-signatures/mo",
      "Email support",
    ],
  },
  growth: {
    name: "Revenue Growth",
    tagline: "For growing sales teams",
    icon: Rocket,
    color: "text-violet-400",
    gradient: "from-violet-500/20 to-violet-600/5",
    features: [
      "Up to 25 users",
      "5,000 contacts",
      "+ Contract Management (CLM)",
      "10 GB storage",
      "100 e-signatures/mo",
      "Priority support",
    ],
  },
  commercial: {
    name: "Commercial Control",
    tagline: "For large organizations",
    icon: Building2,
    color: "text-amber-400",
    gradient: "from-amber-500/20 to-amber-600/5",
    features: [
      "Up to 100 users",
      "50,000 contacts",
      "+ ERP (All 5 modules)",
      "100 GB storage",
      "1,000 e-signatures/mo",
      "Dedicated support",
    ],
  },
  enterprise: {
    name: "Enterprise Governance",
    tagline: "For enterprises at scale",
    icon: Shield,
    color: "text-emerald-400",
    gradient: "from-emerald-500/20 to-emerald-600/5",
    features: [
      "Unlimited users",
      "Unlimited contacts",
      "All modules + governance",
      "500 GB storage",
      "Unlimited e-signatures",
      "24/7 dedicated support",
    ],
  },
};

// ---------- component ----------

export function PlanSelectionModal({
  open,
  onOpenChange,
  currentPlan,
}: PlanSelectionModalProps) {
  const { initiateCheckout, isCheckoutPending } = useSubscription();
  const [selectedPlan, setSelectedPlan] = useState<PlanType | null>(null);
  const recommendedPlan = getUpgradePlanFor(currentPlan);

  const handleSelectPlan = async (plan: PlanType) => {
    if (plan === currentPlan) return;
    setSelectedPlan(plan);
    try {
      await initiateCheckout(plan);
      onOpenChange(false);
    } catch {
      // Error toast is handled inside useSubscription
    } finally {
      setSelectedPlan(null);
    }
  };

  const currentPlanIndex = PLAN_ORDER.indexOf(currentPlan);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0 gap-0 border-border/40 bg-card/95 backdrop-blur-xl">
        {/* Header */}
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="text-2xl font-bold tracking-tight">
            Choose Your Plan
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Select the plan that best fits your team. Upgrade or downgrade anytime.
          </DialogDescription>
        </DialogHeader>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-6">
          {PLAN_ORDER.map((plan, index) => {
            const meta = PLAN_META[plan];
            const Icon = meta.icon;
            const isCurrent = plan === currentPlan;
            const isRecommended = plan === recommendedPlan;
            const isDowngrade = index < currentPlanIndex;
            const isPending = isCheckoutPending && selectedPlan === plan;

            return (
              <div
                key={plan}
                className={cn(
                  "relative flex flex-col rounded-2xl border-2 p-5 transition-all duration-300",
                  "hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5",
                  isRecommended
                    ? "border-primary/60 bg-gradient-to-b shadow-lg shadow-primary/10"
                    : isCurrent
                      ? "border-muted-foreground/30 bg-muted/20"
                      : "border-border/40 bg-card/40",
                  isRecommended && meta.gradient,
                )}
              >
                {/* Recommended badge */}
                {isRecommended && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] px-3 py-0.5 shadow-lg">
                    <Crown className="mr-1 h-3 w-3" /> Recommended
                  </Badge>
                )}

                {/* Plan icon + name */}
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className={cn(
                      "h-9 w-9 rounded-xl flex items-center justify-center",
                      "bg-white/5 border border-white/10",
                    )}
                  >
                    <Icon className={cn("h-4.5 w-4.5", meta.color)} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold leading-tight">
                      {meta.name}
                    </h3>
                    <p className="text-[10px] text-muted-foreground leading-tight">
                      {meta.tagline}
                    </p>
                  </div>
                </div>

                {/* Price */}
                <div className="mb-4">
                  <span className="text-3xl font-bold tracking-tight">
                    ₹{PLAN_PRICES[plan].toLocaleString("en-IN")}
                  </span>
                  <span className="text-xs text-muted-foreground ml-1">
                    /month
                  </span>
                </div>

                {/* Features */}
                <ul className="space-y-2 mb-5 flex-1">
                  {meta.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-xs text-muted-foreground"
                    >
                      <Check className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* Button */}
                {isCurrent ? (
                  <Button
                    variant="outline"
                    className="w-full rounded-xl"
                    disabled
                  >
                    Current Plan
                  </Button>
                ) : (
                  <Button
                    variant={isRecommended ? "default" : "outline"}
                    className={cn(
                      "w-full rounded-xl font-semibold",
                      isRecommended &&
                        "bg-primary hover:bg-primary/90 shadow-md",
                    )}
                    onClick={() => handleSelectPlan(plan)}
                    disabled={isCheckoutPending}
                  >
                    {isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    {isDowngrade ? "Downgrade" : "Select Plan"}
                    <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer note */}
        <div className="px-6 pb-6">
          <p className="text-[11px] text-muted-foreground text-center">
            All plans include a 14-day free trial. Cancel anytime.
            Prices are in INR and billed monthly via Razorpay.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
