import { useState, useEffect } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { OrganizationStatCard } from "@/workspaces/organization/components/OrganizationStatCard";
import { OrganizationAnalyticsCard } from "@/workspaces/organization/components/OrganizationAnalyticsCard";
import { OrganizationActivityCard } from "@/workspaces/organization/components/OrganizationActivityCard";
import { OrganizationProgressCard } from "@/workspaces/organization/components/OrganizationProgressCard";
import { OrganizationAlertsPanel } from "@/workspaces/organization/components/OrganizationAlertsPanel";
import { useOrganizationOwnerData } from "@/workspaces/organization/hooks/useOrganizationOwnerData";
import { cn } from "@/core/utils/utils";

function formatInviteDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return date.toLocaleString();
}

function useLiveClock() {
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  );
  useEffect(() => {
    const id = setInterval(() => {
      setTime(
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    }, 1000);
    return () => clearInterval(id);
  }, []);
  return time;
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

  const [refreshing, setRefreshing] = useState(false);
  const clock = useLiveClock();

  async function handleRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  if (loading && !organization) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="rounded-2xl border border-border/70 bg-card/60 p-6">
        <h2 className="text-lg font-semibold">No organization found</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in with an organization owner or admin account.
        </p>
      </div>
    );
  }

  /* ── Derived data ── */
  const recentInvites = employeeInvites
    .concat(clientInvites)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5)
    .map((invite) => ({
      id: invite.id,
      title: invite.invited_email,
      subtitle: `${invite.role ?? "client"} · ${formatInviteDate(invite.created_at)}`,
      state: invite.status,
    }));

  const teamRows = memberships.slice(0, 5);

  const approvedClients = memberships.filter(
    (m) => m.role === "client" && m.account_state === "active" && m.is_active
  ).length;
  const clientTotal = approvedClients + pendingClients.length;
  const completion = clientTotal === 0 ? 0 : (approvedClients / clientTotal) * 100;

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-8">

      {/* ── Page header ── */}
      <section className="org-animate-in flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            {organization.name}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">{today}</p>
        </div>

        {/* Live clock + refresh — top-right, no separate panel needed */}
        <div className="flex shrink-0 items-center gap-3">
          <div className="hidden rounded-xl border border-border/60 bg-card/60 px-4 py-2 text-right sm:block">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Session</p>
            <p className="font-mono text-lg font-semibold leading-none tracking-tight">{clock}</p>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            className="org-chip"
            title="Refresh data"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </section>

      {/* ── Stat cards ── */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            title: "Total Members",
            value: stats.totalMembers,
            subtitle: "Organization memberships",
            emphasis: true,
            delay: "0ms",
          },
          {
            title: "Active Members",
            value: stats.activeMembers,
            subtitle: "Currently active access",
            delay: "40ms",
          },
          {
            title: "Pending Approvals",
            value: stats.pendingApprovals,
            subtitle: "Client requests awaiting review",
            delay: "80ms",
          },
          {
            title: "Open Invitations",
            value: stats.openInvites,
            subtitle: "Invites not yet accepted",
            delay: "120ms",
          },
        ].map((card) => (
          <div
            key={card.title}
            className="org-animate-in"
            style={{ animationDelay: card.delay }}
          >
            <OrganizationStatCard
              title={card.title}
              value={card.value}
              subtitle={card.subtitle}
              emphasis={card.emphasis}
            />
          </div>
        ))}
      </section>

      {/* ── Main content: primary column + sidebar column ── */}
      <section className="grid gap-6 xl:grid-cols-12">

        {/* PRIMARY column — analytics + team */}
        <div className="space-y-6 xl:col-span-7">

          {/* Analytics chart */}
          <div className="org-animate-in" style={{ animationDelay: "160ms" }}>
            <OrganizationAnalyticsCard data={inviteApprovalTrend} />
          </div>

          {/* Team Collaboration */}
          <div
            className="org-panel org-animate-in"
            style={{ animationDelay: "200ms" }}
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">Team Collaboration</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Most recent workspace members
                </p>
              </div>
            </div>

            {teamRows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/60 bg-background/30 px-4 py-8 text-center">
                <p className="text-sm text-muted-foreground">No members available yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {teamRows.map((member) => (
                  <article
                    key={member.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/70 px-4 py-3"
                  >
                    {/* Avatar */}
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                      {(member.email ?? "?").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{member.email}</p>
                      <p className="text-xs capitalize text-muted-foreground">
                        {member.role} · {member.account_state}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-[11px]",
                        member.is_active
                          ? "border-green-200 bg-green-50 text-green-800 dark:border-green-900/40 dark:bg-green-950/30 dark:text-green-300"
                          : "border-border/60 bg-muted text-muted-foreground"
                      )}
                    >
                      {member.is_active ? "Active" : "Disabled"}
                    </span>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* SIDEBAR column — activity + alerts + progress */}
        <div className="space-y-6 xl:col-span-5">

          {/* Recent invitations activity */}
          <div className="org-animate-in" style={{ animationDelay: "240ms" }}>
            <OrganizationActivityCard title="Recent Invitations" items={recentInvites} />
          </div>

          {/* Alerts */}
          <div className="org-animate-in" style={{ animationDelay: "280ms" }}>
            <OrganizationAlertsPanel alerts={alerts} onDismiss={dismissAlert} />
          </div>

          {/* Progress + Focus mode — stacked in one panel */}
          <div
            className="org-panel org-animate-in space-y-5"
            style={{ animationDelay: "320ms" }}
          >
            <OrganizationProgressCard
              value={completion}
              label="Client Approval Progress"
              caption="Approved clients vs pending requests"
            />

            {/* Divider */}
            <div className="border-t border-border/50" />

            {/* Focus mode strip */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Focus Mode</p>
                <p className="text-xs text-muted-foreground">Distraction-free workspace</p>
              </div>
              <button
                type="button"
                disabled
                className="org-sidebar-download-btn shrink-0 px-4"
              >
                Soon
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}