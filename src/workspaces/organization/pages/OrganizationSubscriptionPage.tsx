import { useState } from "react";
import { Loader2, ArrowUpRight, ShoppingBag, CreditCard, Receipt, Activity, User, Info, ShieldCheck, AlertTriangle, XCircle, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/ui/shadcn/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/shadcn/tabs";
import { useOrganization } from "@/workspaces/organization/hooks/useOrganization";
import { useOrganizationStats } from "@/workspaces/organization/hooks/useOrganizationStats";
import { usePlanLimits } from "@/core/hooks/usePlanLimits";
import { useBillingInfo, useCreateBillingCustomer } from "@/workspaces/organization/hooks/useBilling";
import { useSubscription } from "@/core/hooks/useSubscription";
import { PlanSelectionModal } from "@/ui/plan-selection-modal";
import { Input } from "@/ui/shadcn/input";
import { Label } from "@/ui/shadcn/label";
import { Skeleton } from "@/ui/shadcn/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/ui/shadcn/dialog";
import { toast } from "sonner";
import { cn } from "@/core/utils/utils";
import {
  getResourceLabel,
  formatLimit,
  isUnlimited,
  ADD_ONS,
  type PlanType,
  type ResourceType
} from "@/core/utils/plan-limits";

const PLAN_NAMES: Record<PlanType, string> = {
  foundation: "Foundation CRM",
  growth: "Revenue Growth",
  commercial: "Commercial Control",
  enterprise: "Enterprise Governance",
};

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

function statusBadgeClass(status: string): string {
  switch (status) {
    case "active":
      return "bg-success/10 text-success border-success/20";
    case "trial":
      return "bg-info/10 text-info border-info/20";
    case "past_due":
      return "bg-warning/10 text-warning border-warning/20";
    case "cancelled":
    case "suspended":
      return "bg-destructive/10 text-destructive border-destructive/20";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function getBarColor(percent: number): string {
  if (percent >= 90) return "bg-destructive";
  if (percent >= 75) return "bg-warning";
  return "bg-primary";
}

function getEventIcon(eventType: string) {
  switch (eventType) {
    case "payment_success":
      return <CheckCircle2 className="h-4 w-4 text-success" />;
    case "payment_failed":
      return <XCircle className="h-4 w-4 text-destructive" />;
    case "subscription_cancelled":
      return <AlertTriangle className="h-4 w-4 text-warning" />;
    case "subscription_created":
      return <CheckCircle2 className="h-4 w-4 text-primary" />;
    case "trial_started":
      return <Clock className="h-4 w-4 text-info" />;
    case "plan_upgraded":
      return <ArrowUpRight className="h-4 w-4 text-primary" />;
    default:
      return <Activity className="h-4 w-4 text-muted-foreground" />;
  }
}

function formatEventType(eventType: string): string {
  return eventType
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "N/A";
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export default function OrganizationSubscriptionPage() {
  const {
    organization,
    organizationLoading,
    subscription
  } = useOrganization();
  const { data: stats, isLoading: statsLoading } = useOrganizationStats(organization?.id);
  const { usage, planType, isLoading: usageLoading } = usePlanLimits();
  const { data: billingInfo, isLoading: billingLoading } = useBillingInfo();
  const createCustomer = useCreateBillingCustomer();
  const {
    subscription: subStatus,
    isTrial,
    trialDaysRemaining,
    isExpired,
    isActive,
    cancelSubscription,
    isCancelPending,
    events,
    eventsLoading,
  } = useSubscription();

  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [billingEmail, setBillingEmail] = useState("");
  const [billingName, setBillingName] = useState("");
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const modules = [
    { name: "CRM", enabled: Boolean(subscription?.module_crm) },
    { name: "CPQ", enabled: Boolean(subscription?.module_cpq) },
    { name: "CLM", enabled: Boolean(subscription?.module_clm) },
    { name: "ERP", enabled: Boolean(subscription?.module_erp) },
    { name: "Documents", enabled: Boolean(subscription?.module_documents) },
  ];

  const status = subscription?.status ?? organization?.status ?? "unknown";
  const plan = planType;
  const planDisplayName = PLAN_NAMES[plan] ?? plan;

  const handleSetupBilling = async () => {
    if (!billingEmail || !billingName) {
      toast.error("Please fill in all fields");
      return;
    }
    try {
      await createCustomer.mutateAsync({ email: billingEmail, name: billingName });
      toast.success("Billing profile created successfully");
    } catch {
      toast.error("Failed to create billing profile");
    }
  };

  const handleCancelSubscription = async () => {
    try {
      await cancelSubscription(cancelReason || "User requested cancellation");
      setCancelDialogOpen(false);
      setCancelReason("");
    } catch {
      // handled in hook
    }
  };

  if (organizationLoading) {
    return (
      <div className="flex flex-col gap-6 p-6 animate-in fade-in duration-500">
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-8 w-full max-w-xs" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-[300px] w-full" />
          <Skeleton className="h-[300px] w-full" />
        </div>
        <Skeleton className="h-[300px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Subscription & Billing</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your plan, resource usage, and payment settings.</p>
        </div>
        <div className="flex items-center gap-2">
          {organizationLoading ? (
            <Skeleton className="h-6 w-20 rounded-full" />
          ) : (
            <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border", statusBadgeClass(status))}>
              {status.replace("_", " ")}
            </span>
          )}
          {organizationLoading ? (
            <Skeleton className="h-6 w-32 rounded-full" />
          ) : (
            <span className="text-sm font-semibold px-3 py-1 bg-primary/10 text-primary rounded-full border border-primary/20">
              {planDisplayName}
            </span>
          )}
        </div>
      </header>

      {/* Trial Status Alert */}
      {isTrial && (
        <div className={cn(
          "rounded-xl border p-4 flex items-center justify-between gap-4",
          isExpired
            ? "bg-destructive/5 border-destructive/20"
            : trialDaysRemaining != null && trialDaysRemaining <= 3
              ? "bg-red-500/5 border-red-500/20"
              : trialDaysRemaining != null && trialDaysRemaining <= 7
                ? "bg-amber-500/5 border-amber-500/20"
                : "bg-emerald-500/5 border-emerald-500/20"
        )}>
          <div className="flex items-center gap-3">
            <Clock className={cn(
              "h-5 w-5",
              isExpired ? "text-destructive" : "text-primary"
            )} />
            <div>
              <p className="text-sm font-medium">
                {isExpired
                  ? "Your free trial has expired"
                  : `You are on a 14-day free trial — ${trialDaysRemaining ?? 0} days remaining`
                }
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isExpired
                  ? "Upgrade now to regain access to all features."
                  : "Upgrade to a paid plan to unlock full access after your trial ends."
                }
              </p>
            </div>
          </div>
          <Button size="sm" onClick={() => setPlanModalOpen(true)}>
            <ArrowUpRight className="mr-1.5 h-3.5 w-3.5" />
            Upgrade Now
          </Button>
        </div>
      )}

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="flex gap-2 bg-muted/30 border border-border/40 rounded-2xl p-1.5 w-fit shadow-inner mb-10">
          {(["overview", "billing", "history"] as const).map((tab) => (
            <TabsTrigger
              key={tab}
              value={tab}
              className="px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all duration-300 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:border-border/20 data-[state=active]:shadow-md data-[state=active]:scale-105"
            >
              {tab === "overview" && <Activity className="mr-2 h-4 w-4" />}
              {tab === "billing" && <CreditCard className="mr-2 h-4 w-4" />}
              {tab === "history" && <Receipt className="mr-2 h-4 w-4" />}
              <span className="hidden sm:inline capitalize">{tab}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {!organization && !organizationLoading ? (
          <section className="org-panel">
            <h2 className="text-lg font-semibold">No organization found</h2>
            <p className="mt-1 text-sm text-muted-foreground">Sign in with an organization owner account.</p>
          </section>
        ) : (
          <>
            <TabsContent value="overview" className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Plan Summary Card */}
                <article className="p-6 rounded-3xl border border-border/40 bg-card/40 backdrop-blur-md shadow-xl flex flex-col justify-between">
                  <div>
                    <h2 className="text-xl font-bold tracking-tight mb-8">Current Plan</h2>
                    <div className="space-y-6">
                      <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                        <p className="text-sm font-medium mb-4">Plan Capacity</p>
                        <div className="space-y-4">
                          {statsLoading || organizationLoading ? (
                            Array.from({ length: 2 }).map((_, i) => (
                              <div key={i} className="space-y-2">
                                <div className="flex justify-between"><Skeleton className="h-4 w-20" /><Skeleton className="h-4 w-12" /></div>
                                <Skeleton className="h-1.5 w-full rounded-full" />
                              </div>
                            ))
                          ) : (
                            <>
                              <UsageMeterRow
                                label="Users"
                                used={stats?.totalMembers ?? 1}
                                max={organization?.max_users ?? 1}
                              />
                              <UsageMeterRow
                                label="Storage"
                                used={0}
                                max={organization?.max_storage_mb ?? 1024}
                                unit="MB"
                              />
                            </>
                          )}
                        </div>
                      </div>

                      {/* Subscription dates */}
                      {subStatus && (
                        <div className="p-4 rounded-xl bg-muted/20 border border-border/30 space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Start Date</span>
                            <span className="font-medium">{formatDate(subStatus.subscription_start_date)}</span>
                          </div>
                          {subStatus.subscription_end_date && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Next Billing</span>
                              <span className="font-medium">{formatDate(subStatus.subscription_end_date)}</span>
                            </div>
                          )}
                          {subStatus.is_trial && subStatus.trial_end_date && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Trial Ends</span>
                              <span className="font-medium">{formatDate(subStatus.trial_end_date)}</span>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row gap-3">
                        <Button onClick={() => setPlanModalOpen(true)} className="flex-1" disabled={organizationLoading}>
                          <ArrowUpRight className="mr-2 h-4 w-4" />
                          Change Plan
                        </Button>
                        {isActive && (
                          <Button variant="outline" onClick={() => setCancelDialogOpen(true)} className="flex-1 text-destructive hover:text-destructive" disabled={organizationLoading}>
                            Cancel Subscription
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </article>

                {/* Modules Card */}
                <article className="p-6 rounded-3xl border border-border/40 bg-card/40 backdrop-blur-md shadow-xl">
                  <div className="flex items-center gap-3 mb-4">
                    <ShieldCheck className="h-6 w-6 text-primary" />
                    <h2 className="text-xl font-bold tracking-tight">Platform Modules</h2>
                  </div>
                  <p className="text-sm text-muted-foreground font-medium mb-6 leading-relaxed">Included features for your current organization profile.</p>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {organizationLoading ? (
                      Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-14 w-full rounded-xl" />
                      ))
                    ) : (
                      modules.map((module) => (
                        <div
                          key={module.name}
                          className={cn(
                            "flex items-center justify-between p-4 rounded-xl border transition-colors",
                            module.enabled ? "bg-background border-border" : "bg-muted/10 border-dashed border-border/50 opacity-60"
                          )}
                        >
                          <span className="text-sm font-medium">{module.name}</span>
                          <span
                            className={cn(
                              "text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full",
                              module.enabled ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                            )}
                          >
                            {module.enabled ? "Active" : "Locked"}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </article>
              </div>

              {/* Detailed Usage */}
              <section className="p-6 rounded-3xl border border-border/40 bg-card/40 backdrop-blur-md shadow-xl">
                <h2 className="text-xl font-bold tracking-tight mb-2">Resource Usage</h2>
                <p className="text-sm text-muted-foreground font-medium mb-6">Real-time consumption snapshot across your organization.</p>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {usageLoading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <Skeleton key={i} className="h-24 w-full rounded-xl" />
                    ))
                  ) : (
                    TRACKED_RESOURCES.map((resource) => {
                      const entry = usage[resource];
                      if (!entry) return null;

                      return (
                        <div key={resource} className="p-4 rounded-xl border bg-card/30">
                          <UsageMeterRow
                            label={getResourceLabel(resource)}
                            used={entry.current_count}
                            max={entry.max_allowed}
                            period={entry.period}
                          />
                        </div>
                      );
                    })
                  )}
                </div>
              </section>

              {/* Add-ons */}
              <section className="org-panel">
                <div className="flex items-center gap-2 mb-6">
                  <ShoppingBag className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-semibold">Plan Expansion</h2>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.values(ADD_ONS).map((addon) => (
                    <div key={addon.name} className="flex flex-col justify-between p-5 rounded-xl border border-border/70 bg-card/10 hover:bg-card/20 transition-colors group">
                      <div>
                        <h3 className="font-semibold group-hover:text-primary transition-colors">{addon.name}</h3>
                        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{addon.description}</p>
                        <div className="mt-4 flex items-baseline gap-1">
                          <span className="text-2xl font-bold">₹{addon.price}</span>
                          <span className="text-[10px] text-muted-foreground uppercase">/mo</span>
                        </div>
                      </div>
                      <Button size="sm" variant="outline" className="mt-6 w-full" disabled>
                        Coming Soon
                      </Button>
                    </div>
                  ))}
                </div>
              </section>
            </TabsContent>

            <TabsContent value="billing" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="grid gap-8 md:grid-cols-2">
                {/* Billing Profile */}
                <article className="p-6 rounded-3xl border border-border/40 bg-card/40 backdrop-blur-md shadow-xl">
                  <div className="flex items-center gap-3 mb-6">
                    <User className="h-6 w-6 text-primary" />
                    <h2 className="text-xl font-bold tracking-tight">Billing Details</h2>
                  </div>

                  {billingLoading ? (
                    <div className="space-y-4">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : billingInfo?.customer_id ? (
                    <div className="space-y-6">
                      <div className="grid gap-4">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Customer ID</Label>
                          <p className="font-mono text-sm bg-muted/50 p-2 rounded border">{billingInfo.customer_id}</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Billing Email</Label>
                          <p className="text-sm p-2 bg-muted/30 rounded">{billingInfo.billing_email}</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Contact Name</Label>
                          <p className="text-sm p-2 bg-muted/30 rounded">{billingInfo.billing_contact_name}</p>
                        </div>
                      </div>
                      <Button variant="outline" className="w-full" onClick={() => toast.info("Contact support to update billing details.")}>
                        Request Update
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground mb-4">Set up your billing profile to receive invoices and manage payments.</p>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="email">Billing Email</Label>
                          <Input
                            id="email"
                            type="email"
                            value={billingEmail}
                            onChange={(e) => setBillingEmail(e.target.value)}
                            placeholder="finance@company.com"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="name">Billing Contact Name</Label>
                          <Input
                            id="name"
                            value={billingName}
                            onChange={(e) => setBillingName(e.target.value)}
                            placeholder="Full Name"
                          />
                        </div>
                        <Button
                          className="w-full"
                          onClick={handleSetupBilling}
                          disabled={createCustomer.isPending}
                        >
                          {createCustomer.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          <CreditCard className="mr-2 h-4 w-4" />
                          Complete Setup
                        </Button>
                      </div>
                    </div>
                  )}
                </article>

                {/* Subscription Status */}
                <div className="space-y-6">
                  <article className="org-panel">
                    <div className="flex items-center gap-2 mb-4">
                      <Info className="h-5 w-5 text-primary" />
                      <h2 className="text-lg font-semibold">Subscription Insights</h2>
                    </div>
                    <div className="space-y-4">
                      {billingLoading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                          <div key={i} className="flex justify-between py-2 border-b border-border/50">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-4 w-20" />
                          </div>
                        ))
                      ) : (
                        <>
                          <div className="flex justify-between items-center py-2 border-b border-border/50">
                            <span className="text-sm text-muted-foreground">Status</span>
                            <span className={cn("text-xs font-bold uppercase px-2 py-0.5 rounded-full border", statusBadgeClass(subStatus?.status ?? "trial"))}>
                              {subStatus?.status ?? "trial"}
                            </span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-border/50">
                            <span className="text-sm text-muted-foreground">Billing Cycle</span>
                            <span className="text-sm font-medium">Monthly</span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-border/50">
                            <span className="text-sm text-muted-foreground">Period Start</span>
                            <span className="text-sm font-medium">{formatDate(subStatus?.subscription_start_date)}</span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-border/50">
                            <span className="text-sm text-muted-foreground">Next Billing</span>
                            <span className="text-sm font-medium">{formatDate(subStatus?.subscription_end_date)}</span>
                          </div>
                          {subStatus?.razorpay_subscription_id && (
                            <div className="flex justify-between items-center py-2">
                              <span className="text-sm text-muted-foreground">Razorpay ID</span>
                              <span className="text-xs font-mono bg-muted/50 px-2 py-0.5 rounded">{subStatus.razorpay_subscription_id}</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </article>

                  <article className="p-4 rounded-xl border border-primary/20 bg-primary/5">
                    <p className="text-xs font-medium text-primary mb-1 uppercase tracking-wider">Payment Method</p>
                    <p className="text-sm text-muted-foreground">
                      {subStatus?.razorpay_subscription_id
                        ? "Managed via Razorpay. Payments are automatically charged monthly."
                        : "No payment method added yet. Subscribe to a paid plan to set up billing."
                      }
                    </p>
                  </article>

                  {/* Cancel Subscription Button */}
                  {isActive && (
                    <Button
                      variant="outline"
                      className="w-full text-destructive border-destructive/30 hover:bg-destructive/5"
                      onClick={() => setCancelDialogOpen(true)}
                    >
                      Cancel Subscription
                    </Button>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="history" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              {eventsLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-xl" />
                  ))}
                </div>
              ) : events.length === 0 ? (
                <div className="org-panel flex flex-col items-center justify-center py-20 text-center">
                  <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                    <Receipt className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                  <h2 className="text-xl font-semibold">No Activity Yet</h2>
                  <p className="mt-2 text-sm text-muted-foreground max-w-xs">
                    Subscription events and payment history will appear here once your billing begins.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <h2 className="text-lg font-semibold mb-4">Subscription History</h2>
                  {events.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center gap-4 p-4 rounded-xl border border-border/40 bg-card/30 hover:bg-card/50 transition-colors"
                    >
                      <div className="shrink-0">
                        {getEventIcon(event.event_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">
                          {formatEventType(event.event_type)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {event.plan_type && (
                            <span className="capitalize">{PLAN_NAMES[event.plan_type as PlanType] ?? event.plan_type}</span>
                          )}
                          {event.amount != null && event.amount > 0 && (
                            <span> · ₹{(event.amount / 100).toLocaleString("en-IN")}</span>
                          )}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground">
                          {formatDate(event.created_at)}
                        </p>
                        {event.razorpay_payment_id && (
                          <p className="text-[10px] font-mono text-muted-foreground/60 mt-0.5">
                            {event.razorpay_payment_id}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </>
        )}
      </Tabs>

      {/* Plan Selection Modal */}
      <PlanSelectionModal
        open={planModalOpen}
        onOpenChange={setPlanModalOpen}
        currentPlan={plan}
      />

      {/* Cancel Subscription Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel Subscription</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel? Your plan will be downgraded to Foundation CRM at the end of the current billing period.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
              <p className="text-xs text-destructive font-medium">You will lose access to:</p>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                <li>• Advanced modules (CLM, ERP)</li>
                <li>• Higher resource limits</li>
                <li>• Priority support</li>
              </ul>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cancel-reason" className="text-sm">Why are you cancelling? (optional)</Label>
              <Input
                id="cancel-reason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Help us improve..."
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              Keep Subscription
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelSubscription}
              disabled={isCancelPending}
            >
              {isCancelPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yes, Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
          <span className="font-medium">{label}</span>
          <span className="font-mono text-xs text-muted-foreground">
            {used} / ∞ {unit}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary/20" style={{ width: "10%" }} />
        </div>
      </div>
    );
  }

  const safeMax = Math.max(1, max);
  const percent = Math.min(100, Math.round((used / safeMax) * 100));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">
          {label}
          {period && period !== "total" && (
            <span className="ml-1 text-[10px] text-muted-foreground uppercase">
              ({period === "monthly" ? "mo" : "day"})
            </span>
          )}
        </span>
        <span className="font-mono text-xs text-muted-foreground">
          {used} / {formatLimit(max)} {unit}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all duration-500", getBarColor(percent))}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
