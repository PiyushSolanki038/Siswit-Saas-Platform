import { ReactNode, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useNavigate, useParams } from "react-router-dom";
import {
  Bell,
  Building2,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Settings,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/ui/shadcn/button";
import { cn } from "@/core/utils/utils";
import { useAuth } from "@/core/auth/useAuth";
import { useTenant } from "@/core/tenant/useTenant";
import { tenantAppPath, tenantDashboardPath } from "@/core/utils/routes";
import { ImpersonationBanner } from "@/workspaces/platform/layout/ImpersonationBanner";
import { isTenantUserRole } from "@/core/types/roles";
import { DashboardLayout } from "@/workspaces/employee/layout/DashboardLayout";

const buildTenantMenuItems = (enabledModules: string[], tenantSlug: string) => {
  const items = [
    { title: "Dashboard", icon: LayoutDashboard, path: tenantDashboardPath(tenantSlug) },
  ];

  if (enabledModules.includes("crm")) {
    items.push({ title: "CRM", icon: Users, path: tenantAppPath(tenantSlug, "crm") });
  }
  if (enabledModules.includes("cpq")) {
    items.push({ title: "CPQ", icon: Package, path: tenantAppPath(tenantSlug, "cpq") });
  }
  if (enabledModules.includes("clm")) {
    items.push({ title: "CLM", icon: Building2, path: tenantAppPath(tenantSlug, "clm") });
  }
  if (enabledModules.includes("erp")) {
    items.push({ title: "ERP", icon: Package, path: tenantAppPath(tenantSlug, "erp") });
  }
  if (enabledModules.includes("documents")) {
    items.push({
      title: "Documents",
      icon: Package,
      path: tenantAppPath(tenantSlug, "documents"),
    });
  }

  items.push({ title: "Settings", icon: Settings, path: tenantAppPath(tenantSlug, "settings") });
  return items;
};

interface TenantAdminLayoutProps {
  children?: ReactNode;
}

function SidebarContent({
  collapsed,
  menuItems,
  onSignOut,
  tenantName,
  userEmail,
  onCollapseToggle,
  hideCollapseControl = false,
}: {
  collapsed: boolean;
  menuItems: Array<{ title: string; icon: React.ComponentType<{ className?: string }>; path: string }>;
  onSignOut: () => void;
  tenantName?: string;
  userEmail?: string;
  onCollapseToggle: () => void;
  hideCollapseControl?: boolean;
}) {
  const linkBase = "flex items-center py-2.5 rounded-lg transition-colors mx-2";

  return (
    <>
      <div className="h-16 flex items-center justify-between px-4 border-b border-border">
        {!collapsed && (
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold">S</span>
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-foreground text-sm">
                SIS<span className="text-primary">WIT</span>
              </span>
              {tenantName && (
                <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                  {tenantName}
                </span>
              )}
            </div>
          </Link>
        )}
        {collapsed && (
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center mx-auto">
            <span className="text-primary-foreground font-bold">S</span>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.title === "Dashboard"}
            className={({ isActive }) =>
              cn(
                linkBase,
                collapsed ? "justify-center px-2" : "gap-3 px-4",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
              )
            }
          >
            <div className="h-5 w-5 flex items-center justify-center flex-shrink-0">
              <item.icon className="h-5 w-5" />
            </div>
            {!collapsed && <span className="text-sm font-medium">{item.title}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-border p-2">
        {!hideCollapseControl && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onCollapseToggle}
            className={cn("w-full", collapsed ? "justify-center" : "justify-start")}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4 mr-2" />
                <span>Collapse</span>
              </>
            )}
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={onSignOut}
          className={cn(
            "w-full mt-2 text-destructive hover:text-destructive",
            collapsed ? "justify-center" : "justify-start",
          )}
        >
          <LogOut className="w-4 h-4 mr-2" />
          {!collapsed && <span>Sign Out</span>}
        </Button>

        {!collapsed && userEmail && (
          <p className="text-xs text-muted-foreground px-2 mt-2 truncate">{userEmail}</p>
        )}
      </div>
    </>
  );
}

export function TenantAdminLayout({ children }: TenantAdminLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { signOut, user, role } = useAuth();
  const { tenant, enabledModules } = useTenant();
  const { tenantSlug = "" } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();

  const menuItems = useMemo(
    () => buildTenantMenuItems(enabledModules, tenantSlug),
    [enabledModules, tenantSlug],
  );

  if (isTenantUserRole(role)) {
    return <DashboardLayout>{children}</DashboardLayout>;
  }

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth/sign-in", { replace: true });
  };

  return (
    <div className="flex h-screen bg-background">
      <aside
        className={cn(
          "hidden lg:flex h-screen bg-card border-r border-border flex-col transition-all duration-300",
          collapsed ? "w-16" : "w-64",
        )}
      >
        <SidebarContent
          collapsed={collapsed}
          menuItems={menuItems}
          onSignOut={handleSignOut}
          tenantName={tenant?.name}
          userEmail={user?.email}
          onCollapseToggle={() => setCollapsed((current) => !current)}
        />
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <ImpersonationBanner />
        <header className="h-16 border-b border-border bg-card px-4 md:px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileMenuOpen(true)}>
              <Menu className="w-5 h-5" />
            </Button>
            <h1 className="text-lg font-semibold">
              {tenant?.company_name || tenant?.name || "Workspace"}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon">
              <Bell className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                <span className="text-primary-foreground text-sm font-medium">
                  {user?.email?.[0]?.toUpperCase() || "U"}
                </span>
              </div>
              <span className="text-sm text-muted-foreground hidden md:inline">
                {user?.email}
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children || <Outlet />}</main>
      </div>

      <div
        className={cn(
          "fixed inset-0 z-40 bg-background/70 backdrop-blur-sm transition-opacity lg:hidden",
          mobileMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        onClick={() => setMobileMenuOpen(false)}
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 bg-card border-r border-border flex flex-col transform transition-transform lg:hidden",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-end p-2 border-b border-border">
          <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <SidebarContent
          collapsed={false}
          menuItems={menuItems}
          onSignOut={handleSignOut}
          tenantName={tenant?.name}
          userEmail={user?.email}
          onCollapseToggle={() => undefined}
          hideCollapseControl
        />
      </aside>
    </div>
  );
}
