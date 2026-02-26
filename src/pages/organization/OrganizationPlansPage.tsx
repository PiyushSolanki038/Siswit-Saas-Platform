import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOrganizationOwnerData } from "@/hooks/useOrganizationOwnerData";

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

interface UsageRowProps {
  label: string;
  used: number;
  limit: number;
  unit?: string;
}

function UsageRow({ label, used, limit, unit = "" }: UsageRowProps) {
  const safeLimit = Math.max(1, limit);
  const ratio = Math.min(100, Math.round((used / safeLimit) * 100));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="font-mono text-xs text-muted-foreground">
          {used} / {limit} {unit}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${ratio}%` }} />
      </div>
    </div>
  );
}

export default function OrganizationPlansPage() {
  const { organization, subscription, loading, stats } = useOrganizationOwnerData();

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
  const plan = subscription?.plan_type ?? organization.plan_type ?? "starter";

  return (
    <div className="space-y-5">
      <section>
        <h1 className="text-3xl font-semibold tracking-tight">Plans and Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">Review plan status, enabled modules, and usage limits.</p>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="org-panel space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Current Plan</p>
              <h2 className="mt-2 text-2xl font-semibold capitalize">{plan}</h2>
            </div>
            <span className={`rounded-full px-2 py-1 text-xs font-medium capitalize ${statusBadgeClass(status)}`}>
              {status.replace("_", " ")}
            </span>
          </div>

          <div className="space-y-3 rounded-2xl border border-border/70 bg-background/70 p-4">
            <UsageRow label="Users" used={stats.totalMembers} limit={organization?.max_users ?? 1} />
            <UsageRow label="Storage" used={0} limit={organization?.max_storage_mb ?? 1024} unit="MB" />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled>
              Change Plan (Soon)
            </Button>
            <Button type="button" variant="outline" disabled>
              Manage Billing (Soon)
            </Button>
          </div>
        </article>

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
                  className={`rounded-full px-2 py-1 text-xs font-medium ${
                    module.enabled ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {module.enabled ? "Enabled" : "Disabled"}
                </span>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
