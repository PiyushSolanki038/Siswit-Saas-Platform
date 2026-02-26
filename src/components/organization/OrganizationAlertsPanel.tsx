import { AlertTriangle, BellRing, ShieldAlert, X } from "lucide-react";
import type { ComponentType } from "react";
import { Button } from "@/components/ui/button";
import type { OrganizationOwnerAlert } from "@/hooks/useOrganizationOwnerData";

interface OrganizationAlertsPanelProps {
  alerts: OrganizationOwnerAlert[];
  onDismiss?: (alertId: string) => void;
  title?: string;
}

function alertStyles(severity: OrganizationOwnerAlert["severity"]): {
  icon: ComponentType<{ className?: string }>;
  badgeClass: string;
} {
  if (severity === "critical") {
    return {
      icon: ShieldAlert,
      badgeClass: "bg-destructive/15 text-destructive",
    };
  }
  if (severity === "warning") {
    return {
      icon: AlertTriangle,
      badgeClass: "bg-warning/15 text-warning",
    };
  }
  return {
    icon: BellRing,
    badgeClass: "bg-info/15 text-info",
  };
}

export function OrganizationAlertsPanel({ alerts, onDismiss, title = "Alerts" }: OrganizationAlertsPanelProps) {
  return (
    <section className="org-panel h-full">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold">{title}</h3>
      </div>
      {alerts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No active alerts.</p>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => {
            const { icon: Icon, badgeClass } = alertStyles(alert.severity);
            return (
              <article
                key={alert.id}
                className="rounded-xl border border-border/70 bg-background/75 px-3.5 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    <span className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${badgeClass}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{alert.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{alert.description}</p>
                    </div>
                  </div>
                  {onDismiss ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => onDismiss(alert.id)}
                    >
                      <X className="h-4 w-4" />
                      <span className="sr-only">Dismiss alert</span>
                    </Button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
