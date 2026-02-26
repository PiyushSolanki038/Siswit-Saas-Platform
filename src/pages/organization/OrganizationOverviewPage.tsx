import { Loader2 } from "lucide-react";
import { OrganizationStatCard } from "@/components/organization/OrganizationStatCard";
import { OrganizationAnalyticsCard } from "@/components/organization/OrganizationAnalyticsCard";
import { OrganizationActivityCard } from "@/components/organization/OrganizationActivityCard";
import { OrganizationProgressCard } from "@/components/organization/OrganizationProgressCard";
import { OrganizationAlertsPanel } from "@/components/organization/OrganizationAlertsPanel";
import { useOrganizationOwnerData } from "@/hooks/useOrganizationOwnerData";

function formatInviteDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return date.toLocaleString();
}

export default function OrganizationOverviewPage() {
  const {
    organization,
    loading,
    stats,
    memberships,
    pendingClients,
    employeeInvites,
    clientInvites,
    inviteApprovalTrend,
    alerts,
    dismissAlert,
    refresh,
  } = useOrganizationOwnerData();

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

  const recentInvites = employeeInvites
    .concat(clientInvites)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5)
    .map((invite) => ({
      id: invite.id,
      title: invite.invited_email,
      subtitle: `${invite.role ?? "client"} | ${formatInviteDate(invite.created_at)}`,
      state: invite.status,
    }));

  const teamRows = memberships.slice(0, 5);
  const approvedClients = memberships.filter(
    (member) => member.role === "client" && member.account_state === "active" && member.is_active,
  ).length;
  const clientTotal = approvedClients + pendingClients.length;
  const completion = clientTotal === 0 ? 0 : (approvedClients / clientTotal) * 100;

  const displayTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <div className="space-y-5">
      <section className="org-animate-in">
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Plan, prioritize, and manage access for {organization.name}.
        </p>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="org-animate-in" style={{ animationDelay: "40ms" }}>
          <OrganizationStatCard
            title="Total Members"
            value={stats.totalMembers}
            subtitle="Organization memberships"
            emphasis
          />
        </div>
        <div className="org-animate-in" style={{ animationDelay: "80ms" }}>
          <OrganizationStatCard title="Active Members" value={stats.activeMembers} subtitle="Currently active access" />
        </div>
        <div className="org-animate-in" style={{ animationDelay: "120ms" }}>
          <OrganizationStatCard
            title="Pending Approvals"
            value={stats.pendingApprovals}
            subtitle="Client requests awaiting review"
          />
        </div>
        <div className="org-animate-in" style={{ animationDelay: "160ms" }}>
          <OrganizationStatCard title="Open Invitations" value={stats.openInvites} subtitle="Invites not accepted yet" />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-12">
        <div className="org-animate-in xl:col-span-5" style={{ animationDelay: "200ms" }}>
          <OrganizationAnalyticsCard data={inviteApprovalTrend} />
        </div>
        <div className="org-animate-in xl:col-span-4" style={{ animationDelay: "240ms" }}>
          <OrganizationActivityCard title="Recent Invitations" items={recentInvites} />
        </div>
        <div className="org-animate-in xl:col-span-3" style={{ animationDelay: "280ms" }}>
          <OrganizationAlertsPanel alerts={alerts} onDismiss={dismissAlert} />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-12">
        <div className="org-panel org-animate-in xl:col-span-6" style={{ animationDelay: "320ms" }}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold">Team Collaboration</h3>
            <button type="button" className="org-chip" onClick={() => void refresh()}>
              Refresh
            </button>
          </div>
          {teamRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No members available yet.</p>
          ) : (
            <div className="space-y-2.5">
              {teamRows.map((member) => (
                <article
                  key={member.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/80 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{member.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {member.role} | {member.account_state}
                    </p>
                  </div>
                  <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-medium capitalize text-muted-foreground">
                    {member.is_active ? "Active" : "Disabled"}
                  </span>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="org-animate-in xl:col-span-3" style={{ animationDelay: "360ms" }}>
          <OrganizationProgressCard
            value={completion}
            label="Client Approval Progress"
            caption="Approved clients vs pending client requests"
          />
        </div>

        <div className="org-panel org-animate-in xl:col-span-3" style={{ animationDelay: "400ms" }}>
          <h3 className="text-base font-semibold">Control Utility</h3>
          <p className="mt-1 text-xs text-muted-foreground">Live workspace timer and quick launch controls.</p>
          <div className="mt-6 rounded-2xl border border-border/70 bg-muted/30 p-4">
            <p className="text-xs text-muted-foreground">Session Time</p>
            <p className="mt-2 font-mono text-3xl font-semibold leading-none">{displayTime}</p>
            <button type="button" disabled className="org-sidebar-download-btn mt-4 w-full justify-center">
              Start Focus Mode (Soon)
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

