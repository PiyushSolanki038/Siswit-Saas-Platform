// src/workspaces/organization/pages/OrganizationPlansPage.tsx
// Plans & usage page with resource meters and upgrade prompt.

import { useState } from "react";
import { Loader2, ArrowUpRight, ShoppingBag } from "lucide-react";
import { Button } from "@/ui/shadcn/button";
import { useOrganizationOwnerData } from "@/workspaces/organization/hooks/useOrganizationOwnerData";
import { usePlanLimits } from "@/core/hooks/usePlanLimits";
import { UpgradePrompt } from "@/ui/upgrade-prompt";
import type { PlanType, ResourceType } from "@/core/utils/plan-limits";
import {
  getResourceLabel,
  formatLimit,
  isUnlimited,
  ADD_ONS,
} from "@/core/utils/plan-limits";
import { toast } from "sonner";

const PLAN_NAMES: Record<PlanType, string> = {
  foundation: "Foundation CRM",
  growth: "Revenue Growth",
  commercial: "Commercial Control",
  enterprise: "Enterprise Governance",
};

function statusBadgeClass(status: string): string {
  switch (status) {
    case "active":
      return "bg-success/15 text-success";
    case "trial":
      return "bg-info/15 text-info";
    case "past_due":
      return "bg-warning/15 text-warning";
    case "cancelled":
    case "suspended":
      return "bg-destructive/15 text-destructive";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function getBarColor(percent: number): string {
  if (percent >= 80) return "bg-destructive";
  if (percent >= 60) return "bg-warning";
  return "bg-primary";
}

const TRACKED_RESOURCES: ResourceType[] = [
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

export default function OrganizationPlansPage() {
  const { organization, subscription, loading, stats } = useOrganizationOwnerData();
  const { usage, planType, isLoading: usageLoading } = usePlanLimits();
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  if (loading && !organization) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  if (!organization) {
    return (
      <section className="org-panel">
        <h2 className="text-lg font-semibold">No organization found</h2>
        <p className="mt-1 text-sm text-muted-foreground">Sign in with an organization owner or admin account.</p>
      </section>
    );
  }

  const modules = [
    { name: "CRM", enabled: Boolean(subscription?.module_crm) },
    { name: "CPQ", enabled: Boolean(subscription?.module_cpq) },
    { name: "CLM", enabled: Boolean(subscription?.module_clm) },
    { name: "ERP", enabled: Boolean(subscription?.module_erp) },
    { name: "Documents", enabled: Boolean(subscription?.module_documents) },
  ];

  const status = subscription?.status ?? organization.status ?? "unknown";
  const plan = planType;
  const planDisplayName = PLAN_NAMES[plan] ?? plan;

  return (
    <div className="space-y-5">
      <section>
        <h1 className="text-3xl font-semibold tracking-tight">Plans and Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">Review plan status, enabled modules, and usage limits.</p>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {/* Plan Card */}
        <article className="org-panel space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Current Plan</p>
              <h2 className="mt-2 text-2xl font-semibold capitalize">{planDisplayName}</h2>
            </div>
            <span className={`rounded-full px-2 py-1 text-xs font-medium capitalize ${statusBadgeClass(status)}`}>
              {status.replace("_", " ")}
            </span>
          </div>

          <div className="space-y-3 rounded-2xl border border-border/70 bg-background/70 p-4">
            {/* User usage from stats */}
            <UsageMeterRow
              label="Users"
              used={stats.totalMembers}
              max={organization?.max_users ?? 1}
            />
            {/* Storage from org */}
            <UsageMeterRow
              label="Storage"
              used={0}
              max={organization?.max_storage_mb ?? 1024}
              unit="MB"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => setUpgradeOpen(true)}>
              <ArrowUpRight className="mr-1 h-4 w-4" />
              Change Plan
            </Button>
            <Button type="button" variant="outline" onClick={() => toast.info("Redirecting to Razorpay payment portal...")}>
              Manage Billing
            </Button>
          </div>
        </article>

        {/* Enabled Modules */}
        <article className="org-panel">
          <h2 className="text-lg font-semibold">Enabled Modules</h2>
          <p className="mt-1 text-xs text-muted-foreground">Module control is read-only for this release.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {modules.map((module) => (
              <div
                key={module.name}
                className="flex items-center justify-between rounded-xl border border-border/70 bg-background/70 px-3.5 py-3"
              >
                <span className="text-sm font-medium">{module.name}</span>
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${module.enabled ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                    }`}
                >
                  {module.enabled ? "Enabled" : "Disabled"}
                </span>
              </div>
            ))}
          </div>
        </article>
      </section>

      {/* Resource Usage Meters */}
      <section className="org-panel">
        <h2 className="text-lg font-semibold">Resource Usage</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Current usage across all tracked resources on your plan.
        </p>

        {usageLoading ? (
          <div className="mt-4 flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {TRACKED_RESOURCES.map((resource) => {
              const entry = usage[resource];
              if (!entry) return null;

              return (
                <UsageMeterRow
                  key={resource}
                  label={getResourceLabel(resource)}
                  used={entry.current_count}
                  max={entry.max_allowed}
                  period={entry.period}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* Add-ons */}
      <section className="org-panel">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Available Add-Ons</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Extend your plan with additional capacity.</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {Object.values(ADD_ONS).map((addon) => (
            <div key={addon.name} className="rounded-xl border border-border/70 bg-background/70 p-4">
              <p className="font-medium text-sm">{addon.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{addon.description}</p>
              <p className="mt-2 text-lg font-bold">
                ₹{addon.price}
                <span className="text-xs font-normal text-muted-foreground">/month</span>
              </p>
              <Button size="sm" variant="outline" className="mt-2 w-full" disabled>
                Coming Soon
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* Upgrade Prompt Modal */}
      <UpgradePrompt
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        currentPlan={plan}
      />
    </div>
  );
}

interface UsageMeterRowProps {
  label: string;
  used: number;
  max: number;
  unit?: string;
  period?: string;
}

function UsageMeterRow({ label, used, max, unit = "", period }: UsageMeterRowProps) {
  if (isUnlimited(max)) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span>{label}</span>
          <span className="font-mono text-xs text-muted-foreground">
            {used} / Unlimited {unit}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary/30" style={{ width: "5%" }} />
        </div>
      </div>
    );
  }

  const safeMax = Math.max(1, max);
  const percent = Math.min(100, Math.round((used / safeMax) * 100));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span>
          {label}
          {period && period !== "total" && (
            <span className="ml-1 text-xs text-muted-foreground">
              (/{period === "monthly" ? "mo" : "day"})
            </span>
          )}
        </span>
        <span className="font-mono text-xs text-muted-foreground">
          {used} / {formatLimit(max)} {unit}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${getBarColor(percent)}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
