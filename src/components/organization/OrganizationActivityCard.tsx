import { Clock3 } from "lucide-react";

interface ActivityItem {
  id: string;
  title: string;
  subtitle: string;
  state: string;
}

interface OrganizationActivityCardProps {
  title: string;
  items: ActivityItem[];
}

function stateBadgeClass(state: string): string {
  switch (state.toLowerCase()) {
    case "accepted":
    case "active":
      return "bg-success/15 text-success";
    case "expired":
    case "rejected":
      return "bg-destructive/15 text-destructive";
    case "pending":
      return "bg-warning/15 text-warning";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function OrganizationActivityCard({ title, items }: OrganizationActivityCardProps) {
  return (
    <section className="org-panel h-full">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold">{title}</h3>
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/80 bg-muted/50">
          <Clock3 className="h-4 w-4 text-primary" />
        </span>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No recent records.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <article
              key={item.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-border/70 bg-background/70 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.title}</p>
                <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>
              </div>
              <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${stateBadgeClass(item.state)}`}>
                {item.state}
              </span>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

