import { Loader2 } from "lucide-react";
import { OrganizationAlertsPanel } from "@/components/organization/OrganizationAlertsPanel";
import { useOrganizationOwnerData } from "@/hooks/useOrganizationOwnerData";

export default function OrganizationAlertsPage() {
  const { organization, loading, alerts, dismissAlert } = useOrganizationOwnerData();

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

  return (
    <div className="space-y-5">
      <section>
        <h1 className="text-3xl font-semibold tracking-tight">Alerts</h1>
        <p className="mt-1 text-sm text-muted-foreground">Operational alerts derived from approvals, invitations, and billing state.</p>
      </section>
      <section>
        <OrganizationAlertsPanel alerts={alerts} onDismiss={dismissAlert} title="Organization Alerts" />
      </section>
    </div>
  );
}
