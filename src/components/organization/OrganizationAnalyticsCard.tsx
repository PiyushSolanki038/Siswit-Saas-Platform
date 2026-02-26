import { BarChart3 } from "lucide-react";

interface TrendPoint {
  day: string;
  invites: number;
  approvals: number;
}

interface OrganizationAnalyticsCardProps {
  data: TrendPoint[];
}

export function OrganizationAnalyticsCard({ data }: OrganizationAnalyticsCardProps) {
  const max = Math.max(1, ...data.map((entry) => Math.max(entry.invites, entry.approvals)));

  return (
    <section className="org-panel h-full">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold">Invite Analytics</h3>
          <p className="text-xs text-muted-foreground">Last 7 days invite and approval activity</p>
        </div>
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/80 bg-muted/50">
          <BarChart3 className="h-4 w-4 text-primary" />
        </span>
      </div>

      <div className="grid grid-cols-7 items-end gap-2">
        {data.map((entry) => {
          const inviteHeight = Math.max(8, Math.round((entry.invites / max) * 94));
          const approvalHeight = Math.max(8, Math.round((entry.approvals / max) * 94));

          return (
            <div key={entry.day} className="space-y-2">
              <div className="flex h-28 items-end justify-center gap-1">
                <div
                  className="w-2 rounded-full bg-chart-2/90"
                  style={{ height: `${approvalHeight}px` }}
                  title={`${entry.approvals} approvals`}
                />
                <div
                  className="w-2 rounded-full bg-primary/90"
                  style={{ height: `${inviteHeight}px` }}
                  title={`${entry.invites} invites`}
                />
              </div>
              <p className="text-center font-mono text-[11px] text-muted-foreground">{entry.day}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-primary/90" />
          Invites
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-chart-2/90" />
          Approvals
        </span>
      </div>
    </section>
  );
}

