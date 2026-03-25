import { useMemo, useState } from "react";
import { NavLink, useParams } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  CreditCard,
  Settings,
  Bell,
  MailPlus,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Briefcase,
  FileText,
  ShoppingBag,
  Truck,
  Lock,
} from "lucide-react";
import { Button } from "@/ui/shadcn/button";
import { cn } from "@/core/utils/utils";
import { useAuth } from "@/core/auth/useAuth";
import { useOrganization } from "@/workspaces/organization/hooks/useOrganization";
import { usePlanLimits } from "@/core/hooks/usePlanLimits";
import { UpgradePrompt } from "@/ui/upgrade-prompt";
import { tenantAppPath } from "@/core/utils/routes";

interface SidebarGroup {
  label: string;
  items: {
    label: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    enabled?: boolean;
  }[];
}

interface AdminSidebarProps {
  className?: string;
  collapsed?: boolean;
  onCollapseToggle?: () => void;
  onNavigate?: () => void;
}

export function AdminSidebar({
  className,
  collapsed = false,
  onCollapseToggle,
  onNavigate
}: AdminSidebarProps) {
  const { organization, subscription } = useOrganization();
  const { signOut } = useAuth();
  const { planType } = usePlanLimits();
  const { tenantSlug = "" } = useParams<{ tenantSlug: string }>();
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const primaryColor = organization?.primary_color || "var(--primary)";

  const groups: SidebarGroup[] = useMemo(() => [
    {
      label: "Management",
      items: [
        { label: "Overview", href: tenantAppPath(tenantSlug, "dashboard"), icon: LayoutDashboard },
        { label: "Team", href: tenantAppPath(tenantSlug, "users"), icon: Users },
        { label: "Billing Hub", href: tenantAppPath(tenantSlug, "subscription"), icon: CreditCard },
      ]
    },
    {
      label: "Operations",
      items: [
        {
          label: "CRM (All)",
          href: tenantAppPath(tenantSlug, "crm/leads"),
          icon: Briefcase,
          enabled: Boolean(subscription?.module_crm)
        },
        {
          label: "CLM (All)",
          href: tenantAppPath(tenantSlug, "clm/contracts"),
          icon: ShieldCheck,
          enabled: Boolean(subscription?.module_clm)
        },
        {
          label: "CPQ (All)",
          href: tenantAppPath(tenantSlug, "cpq/quotes"),
          icon: ShoppingBag,
          enabled: Boolean(subscription?.module_cpq)
        },
      ]
    },
    {
      label: "Logistics",
      items: [
        {
          label: "ERP Hub",
          href: tenantAppPath(tenantSlug, "erp"),
          icon: Truck,
          enabled: Boolean(subscription?.module_erp)
        },
        {
          label: "Documents",
          href: tenantAppPath(tenantSlug, "documents"),
          icon: FileText,
          enabled: Boolean(subscription?.module_documents)
        },
      ]
    },
    {
      label: "Control",
      items: [
        { label: "Invitations", href: tenantAppPath(tenantSlug, "invitations"), icon: MailPlus },
        { label: "Alerts", href: tenantAppPath(tenantSlug, "alerts"), icon: Bell },
        { label: "Settings", href: tenantAppPath(tenantSlug, "settings"), icon: Settings },
      ]
    }
  ], [tenantSlug, subscription]);

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/auth/sign-in";
  };

  const organizationName = organization?.name || "Admin Panel";
  const initials = organizationName.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase();

  return (
    <aside
      className={cn(
        "flex flex-col bg-card/60 backdrop-blur-xl border-r border-border/40 h-full transition-all duration-300 relative z-20 overflow-hidden",
        "before:absolute before:inset-0 before:bg-purple-600/5 before:pointer-events-none before:z-[-1]",
        collapsed ? "w-16" : "w-64",
        className
      )}
      style={{ "--sidebar-accent": primaryColor } as React.CSSProperties}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center px-4 border-b border-border/40 shrink-0">
        {!collapsed ? (
          <div className="flex items-center gap-3 overflow-hidden">
            <div
              className="h-8 w-8 rounded-lg flex items-center justify-center text-white shrink-0 font-bold text-sm shadow-sm"
              style={{ backgroundColor: primaryColor }}
            >
              {initials}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-sm truncate">{organizationName}</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Command Center</span>
            </div>
          </div>
        ) : (
          <div
            className="h-8 w-8 rounded-lg flex items-center justify-center text-white mx-auto font-bold text-sm shadow-sm"
            style={{ backgroundColor: primaryColor }}
          >
            {initials[0]}
          </div>
        )}
      </div>

      {/* Nav Content */}
      <div className="flex-1 overflow-y-auto py-6 px-3 space-y-6 scrollbar-none">
        {groups.map((group) => (
          <div key={group.label} className="space-y-1.5">
            {!collapsed && (
              <h3 className="px-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.2em] mb-2">
                {group.label}
              </h3>
            )}
            <nav className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isLocked = item.enabled === false;

                if (isLocked) {
                  return (
                    <button
                      key={item.href}
                      onClick={() => setUpgradeOpen(true)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-xl transition-all group relative w-full text-left",
                        "text-muted-foreground/40 hover:bg-muted/30 cursor-pointer opacity-50 hover:opacity-70",
                        collapsed && "justify-center px-0"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {!collapsed && (
                        <>
                          <span className="text-sm font-medium flex-1">{item.label}</span>
                          <Lock className="h-3 w-3 text-muted-foreground/50" />
                        </>
                      )}
                    </button>
                  );
                }

                return (
                  <NavLink
                    key={item.href}
                    to={item.href}
                    onClick={onNavigate}
                    className={({ isActive }) => cn(
                      "flex items-center gap-3 px-3 py-2 rounded-xl transition-all group relative",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                      collapsed && "justify-center px-0"
                    )}
                    style={({ isActive }) => ({
                      backgroundColor: isActive ? `${primaryColor}15` : undefined,
                      color: isActive ? primaryColor : undefined,
                    })}
                  >
                    {({ isActive }) => (
                      <>
                        <Icon className={cn("h-4 w-4 shrink-0 transition-transform group-hover:scale-110")} />
                        {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
                        {isActive && !collapsed && (
                          <div
                            className="absolute right-2 w-1 h-4 rounded-full"
                            style={{ backgroundColor: primaryColor }}
                          />
                        )}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-border/40 space-y-2 mt-auto">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCollapseToggle}
          className={cn("w-full h-9 rounded-xl text-muted-foreground justify-start", collapsed && "justify-center px-0")}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : (
            <>
              <ChevronLeft className="mr-2 h-4 w-4" />
              <span>Collapse</span>
            </>
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          className={cn(
            "w-full h-9 rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive justify-start",
            collapsed && "justify-center px-0"
          )}
        >
          <LogOut className={cn("h-4 w-4", !collapsed && "mr-2")} />
          {!collapsed && <span>Sign Out</span>}
        </Button>
      </div>

      {/* Upgrade Modal */}
      <UpgradePrompt
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        currentPlan={planType}
      />
    </aside>
  );
}
