import { useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import type { ComponentType } from "react";
import {
  Bell,
  CreditCard,
  Download,
  LayoutDashboard,
  MailPlus,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useOrganization } from "@/hooks/useOrganization";

interface OrganizationSidebarProps {
  className?: string;
  onNavigate?: () => void;
}

interface SidebarItem {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
}

const sidebarItems: SidebarItem[] = [
  { label: "Dashboard", href: "/organization/overview", icon: LayoutDashboard },
  { label: "User Management", href: "/organization/users", icon: Users },
  { label: "Invitations", href: "/organization/invitations", icon: MailPlus },
  { label: "Client Approvals", href: "/organization/approvals", icon: ShieldCheck },
  { label: "Plans and Billing", href: "/organization/plans", icon: CreditCard },
  { label: "Alerts", href: "/organization/alerts", icon: Bell },
  { label: "Settings", href: "/organization/settings", icon: Settings },
];

export function OrganizationSidebar({ className, onNavigate }: OrganizationSidebarProps) {
  const { organization } = useOrganization();
  const [logoFailed, setLogoFailed] = useState(false);

  const organizationName = organization?.name?.trim() || "Organization";
  const organizationSubtitle = organization?.org_code ?? organization?.slug ?? "Owner Workspace";
  const organizationInitials = useMemo(() => {
    const parts = organizationName
      .split(" ")
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, 2);
    if (parts.length === 0) return "OR";
    return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
  }, [organizationName]);

  return (
    <aside className={cn("org-sidebar-panel flex h-full w-full flex-col", className)}>
      <div className="org-sidebar-brand">
        {organization?.logo_url && !logoFailed ? (
          <img
            src={organization.logo_url}
            alt={`${organizationName} logo`}
            className="h-8 w-8 rounded-full border border-border/70 object-cover"
            onError={() => setLogoFailed(true)}
          />
        ) : (
          <div className="org-brand-icon" aria-hidden>
            {organizationInitials}
          </div>
        )}
        <div>
          <p className="text-sm font-semibold leading-none">{organizationName}</p>
          <p className="text-xs text-muted-foreground">{organizationSubtitle}</p>
        </div>
      </div>

      <div className="mt-6 flex-1 space-y-2 overflow-y-auto pr-1">
        <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Menu</p>
        <nav className="space-y-1.5">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.href}
                to={item.href}
                onClick={onNavigate}
                className={({ isActive }) => cn("org-sidebar-link", isActive && "org-sidebar-link-active")}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      <div className="org-sidebar-download mt-6">
        <p className="text-sm font-medium">Workspace update</p>
        <p className="mt-1 text-xs text-muted-foreground">
          More organization tools are being rolled out.
        </p>
        <button type="button" className="org-sidebar-download-btn mt-3" disabled>
          <Download className="h-4 w-4" />
          Coming soon
        </button>
      </div>
    </aside>
  );
}
