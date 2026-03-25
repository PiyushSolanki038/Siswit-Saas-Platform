import { useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import type { ComponentType } from "react";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  LayoutDashboard,
  LogOut,
  MailPlus,
  Receipt,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Button } from "@/ui/shadcn/button";
import { cn } from "@/core/utils/utils";
import { useAuth } from "@/core/auth/useAuth";
import { useNavigate } from "react-router-dom";
import { useOrganization } from "@/workspaces/organization/hooks/useOrganization";

interface OrganizationSidebarProps {
  className?: string;
  onNavigate?: () => void;
  collapsed?: boolean;
  onCollapseToggle?: () => void;
  hideCollapseControl?: boolean;
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
  { label: "Billing", href: "/organization/billing", icon: Receipt },
  { label: "Alerts", href: "/organization/alerts", icon: Bell },
  { label: "Settings", href: "/organization/settings", icon: Settings },
];

export function OrganizationSidebar({ 
  className, 
  onNavigate,
  collapsed = false,
  onCollapseToggle,
  hideCollapseControl = false,
}: OrganizationSidebarProps) {
  const { organization } = useOrganization();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [logoFailed, setLogoFailed] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth/sign-in", { replace: true });
  };

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
      <div className={cn("org-sidebar-brand", collapsed && "justify-center px-0")}>
        {organization?.logo_url && !logoFailed ? (
          <img
            src={organization.logo_url}
            alt={`${organizationName} logo`}
            className="h-8 w-8 rounded-full border border-border/70 object-cover shrink-0"
            onError={() => setLogoFailed(true)}
          />
        ) : (
          <div className="org-brand-icon shrink-0" aria-hidden>
            {organizationInitials}
          </div>
        )}
        {!collapsed && (
          <div className="min-w-0 overflow-hidden">
            <p className="truncate text-sm font-semibold leading-none">{organizationName}</p>
            <p className="truncate text-xs text-muted-foreground">{organizationSubtitle}</p>
          </div>
        )}
      </div>

      <div className="mt-6 flex-1 space-y-2 overflow-y-auto pr-1">
        {!collapsed && (
          <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Menu
          </p>
        )}
        <nav className="space-y-1.5">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.href}
                to={item.href}
                onClick={onNavigate}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) => cn(
                  "org-sidebar-link", 
                  isActive && "org-sidebar-link-active",
                  collapsed && "justify-center px-2"
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", collapsed && "mr-0")} />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto pt-6 pb-2 border-t border-border/40 space-y-2">
        {!hideCollapseControl && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onCollapseToggle}
            className={cn("w-full text-muted-foreground hover:text-foreground", collapsed ? "justify-center px-2" : "justify-start")}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="mr-2 h-4 w-4" />
                <span>Collapse</span>
              </>
            )}
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          className={cn(
            "w-full text-destructive hover:text-destructive hover:bg-destructive/10",
            collapsed ? "justify-center px-2" : "justify-start",
          )}
          title={collapsed ? "Sign Out" : undefined}
        >
          <LogOut className={cn("h-4 w-4", !collapsed && "mr-2")} />
          {!collapsed && <span>Sign Out</span>}
        </Button>
      </div>
    </aside>
  );
}
