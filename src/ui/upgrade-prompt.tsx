// src/ui/upgrade-prompt.tsx
// Modal dialog showing plan comparison and upgrade options.

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/ui/shadcn/dialog";
import { Button } from "@/ui/shadcn/button";
import { Badge } from "@/ui/shadcn/badge";
import { X, Crown, ArrowRight, Loader2 } from "lucide-react";
import type { PlanType, ResourceType } from "@/core/utils/plan-limits";
import {
  PLAN_LIMITS,
  PLAN_PRICES,
  formatLimit,
  getResourceLabel,
  getUpgradePlanFor,
  ADD_ONS,
} from "@/core/utils/plan-limits";
import { useSubscription } from "@/core/hooks/useSubscription";
import { toast } from "sonner";

interface UpgradePromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlan: PlanType;
  triggeredByResource?: ResourceType;
}

const ALL_RESOURCES: ResourceType[] = [
  "contacts",
  "accounts",
  "leads",
  "opportunities",
  "products",
  "quotes",
  "contracts",
  "contract_templates",
  "documents",
  "document_templates",
  "suppliers",
  "purchase_orders",
  "storage_mb",
  "api_calls",
  "esignatures",
];

const PLAN_NAMES: Record<PlanType, string> = {
  foundation: "Foundation CRM",
  growth: "Revenue Growth",
  commercial: "Commercial Control",
  enterprise: "Enterprise Governance",
};

const PLAN_DESCRIPTIONS: Record<PlanType, string> = {
  foundation: "For small teams getting started with CRM and basic sales tools",
  growth: "For growing teams that need contract management and more capacity",
  commercial: "For large organizations needing full ERP and advanced control",
  enterprise: "For enterprises needing unlimited resources and governance",
};

const PLAN_ORDER: PlanType[] = ["foundation", "growth", "commercial", "enterprise"];

export function UpgradePrompt({
  open,
  onOpenChange,
  currentPlan,
  triggeredByResource,
}: UpgradePromptProps) {
  const recommendedPlan = getUpgradePlanFor(currentPlan);
  const { initiateCheckout, isCheckoutPending } = useSubscription();

  const handleUpgrade = async (plan: PlanType) => {
    if (plan === "enterprise") {
      toast.success("Our sales team will contact you shortly.");
      onOpenChange(false);
      return;
    }

    try {
      await initiateCheckout(plan);
      onOpenChange(false);
    } catch {
      // Error toast is handled inside useSubscription
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            Upgrade Your Plan
          </DialogTitle>
          <DialogDescription>
            {triggeredByResource
              ? `You've reached your ${getResourceLabel(triggeredByResource).toLowerCase()} limit. Upgrade to get more.`
              : "Compare plans and choose the right one for your team."}
          </DialogDescription>
        </DialogHeader>

        {/* Plan Cards */}
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          {PLAN_ORDER.map((plan) => {
            const isCurrent = plan === currentPlan;
            const isRecommended = plan === recommendedPlan;

            return (
              <div
                key={plan}
                className={`relative rounded-xl border-2 p-5 transition-all ${isRecommended
                    ? "border-primary bg-primary/5 shadow-lg"
                    : isCurrent
                      ? "border-muted-foreground/30 bg-muted/30"
                      : "border-border"
                  }`}
              >
                {isRecommended && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                    <Crown className="mr-1 h-3 w-3" /> Recommended
                  </Badge>
                )}

                <h3 className="text-lg font-semibold capitalize">
                  {PLAN_NAMES[plan]}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {PLAN_DESCRIPTIONS[plan]}
                </p>

                <div className="mt-4">
                  <span className="text-3xl font-bold">
                    ₹{PLAN_PRICES[plan]}
                  </span>
                  <span className="text-sm text-muted-foreground">/month</span>
                </div>

                <div className="mt-4">
                  {isCurrent ? (
                    <Button variant="outline" className="w-full" disabled>
                      Current Plan
                    </Button>
                  ) : (
                    <Button
                      className={`w-full ${isRecommended ? "" : "variant-outline"}`}
                      variant={isRecommended ? "default" : "outline"}
                      onClick={() => handleUpgrade(plan)}
                      disabled={isCheckoutPending}
                    >
                      {isCheckoutPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      {plan === "enterprise" ? "Contact Sales" : "Upgrade"}
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Comparison Table */}
        <div className="mt-8">
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Detailed Comparison
          </h4>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Feature</th>
                  {PLAN_ORDER.map((plan) => (
                    <th
                      key={plan}
                      className={`px-4 py-3 text-center font-medium capitalize ${plan === currentPlan ? "bg-primary/5" : ""
                        }`}
                    >
                      {PLAN_NAMES[plan]}
                      {plan === currentPlan && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          (current)
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ALL_RESOURCES.map((resource) => {
                  const isTriggered = resource === triggeredByResource;
                  return (
                    <tr
                      key={resource}
                      className={`border-b ${isTriggered ? "bg-warning/5" : ""}`}
                    >
                      <td className="px-4 py-2.5 font-medium">
                        {getResourceLabel(resource)}
                        {isTriggered && (
                          <Badge variant="outline" className="ml-2 text-[10px] border-warning text-warning">
                            Limit hit
                          </Badge>
                        )}
                      </td>
                      {PLAN_ORDER.map((plan) => {
                        const limit = PLAN_LIMITS[plan]?.[resource];
                        return (
                          <td
                            key={plan}
                            className={`px-4 py-2.5 text-center ${plan === currentPlan ? "bg-primary/5" : ""
                              }`}
                          >
                            {limit ? (
                              <span className="font-mono text-xs">
                                {formatLimit(limit.max)}
                                {limit.period !== "total" && (
                                  <span className="text-muted-foreground">
                                    /{limit.period === "monthly" ? "mo" : "day"}
                                  </span>
                                )}
                              </span>
                            ) : (
                              <X className="mx-auto h-4 w-4 text-muted-foreground/40" />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {/* Modules row */}
                <tr className="border-b bg-muted/30">
                  <td className="px-4 py-2.5 font-medium">Modules</td>
                  <td className="px-4 py-2.5 text-center text-xs">CRM, CPQ, Docs</td>
                  <td className="px-4 py-2.5 text-center text-xs">+ CLM</td>
                  <td className="px-4 py-2.5 text-center text-xs">+ ERP (All 5)</td>
                  <td className="px-4 py-2.5 text-center text-xs">All 5 + Governance</td>
                </tr>
                <tr className="border-b">
                  <td className="px-4 py-2.5 font-medium">Users</td>
                  <td className="px-4 py-2.5 text-center font-mono text-xs">5</td>
                  <td className="px-4 py-2.5 text-center font-mono text-xs">25</td>
                  <td className="px-4 py-2.5 text-center font-mono text-xs">100</td>
                  <td className="px-4 py-2.5 text-center font-mono text-xs">Unlimited</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-medium">Audit Log Retention</td>
                  <td className="px-4 py-2.5 text-center text-xs">30 days</td>
                  <td className="px-4 py-2.5 text-center text-xs">90 days</td>
                  <td className="px-4 py-2.5 text-center text-xs">365 days</td>
                  <td className="px-4 py-2.5 text-center text-xs">365 days</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Add-ons */}
        <div className="mt-6">
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Add-Ons (Available on any plan)
          </h4>
          <div className="grid gap-3 sm:grid-cols-3">
            {Object.values(ADD_ONS).map((addon) => (
              <div
                key={addon.name}
                className="rounded-lg border p-4"
              >
                <p className="font-medium">{addon.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {addon.description}
                </p>
                <p className="mt-2 text-lg font-bold">
                  ₹{addon.price}
                  <span className="text-xs font-normal text-muted-foreground">
                    /month
                  </span>
                </p>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
