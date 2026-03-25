import { Link, NavLink, useParams } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Building2,
  UserCircle,
  Target,
  Calendar,
  FileText,
  FileSignature,
  Package,
  Settings,
  ChevronLeft,
  ChevronRight,
  FileStack,
  FilePlus,
  History,
  Send,
  Truck,
  BarChart3,
  DollarSign,
  LogOut,
} from "lucide-react";
import { cn } from "@/core/utils/utils";
import { Button } from "@/ui/shadcn/button";
import { useMemo, type ComponentType } from "react";
import { tenantAppPath, tenantDashboardPath } from "@/core/utils/routes";
import { useAuth } from "@/core/auth/useAuth";
import { useOrganization } from "@/workspaces/organization/hooks/useOrganization";

type SidebarLink = {
  title: string;
  icon: ComponentType<{ className?: string }>;
  path: string;
};

type SidebarSection =
  | {
    title: string;
    icon: ComponentType<{ className?: string }>;
    path: string;
    items?: undefined;
  }
  | {
    title: string;
    items: SidebarLink[];
    icon?: undefined;
    path?: undefined;
  };

const buildMenuItems = (tenantSlug: string): SidebarSection[] => [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    path: tenantDashboardPath(tenantSlug),
  },
  {
    title: "CRM",
    items: [
      { title: "Dashboard", icon: LayoutDashboard, path: tenantAppPath(tenantSlug, "crm") },
      { title: "Leads", icon: Users, path: tenantAppPath(tenantSlug, "crm/leads") },
      { title: "Accounts", icon: Building2, path: tenantAppPath(tenantSlug, "crm/accounts") },
      { title: "Contacts", icon: UserCircle, path: tenantAppPath(tenantSlug, "crm/contacts") },
      { title: "Opportunities", icon: Target, path: tenantAppPath(tenantSlug, "crm/opportunities") },
      { title: "Pipeline", icon: Target, path: tenantAppPath(tenantSlug, "crm/pipeline") },
      { title: "Activities", icon: Calendar, path: tenantAppPath(tenantSlug, "crm/activities") },
    ],
  },
  {
    title: "CPQ",
    items: [
      { title: "Dashboard", icon: LayoutDashboard, path: tenantAppPath(tenantSlug, "cpq") },
      { title: "Products", icon: Package, path: tenantAppPath(tenantSlug, "cpq/products") },
      { title: "Quotes", icon: FileText, path: tenantAppPath(tenantSlug, "cpq/quotes") },
    ],
  },
  {
    title: "CLM",
    items: [
      { title: "Dashboard", icon: LayoutDashboard, path: tenantAppPath(tenantSlug, "clm") },
      { title: "Contracts", icon: FileSignature, path: tenantAppPath(tenantSlug, "clm/contracts") },
      { title: "Templates", icon: FileText, path: tenantAppPath(tenantSlug, "clm/templates") },
    ],
  },
  {
    title: "Documents",
    items: [
      { title: "All Documents", icon: FileStack, path: tenantAppPath(tenantSlug, "documents") },
      { title: "Create Document", icon: FilePlus, path: tenantAppPath(tenantSlug, "documents/create") },
      { title: "Templates", icon: FileText, path: tenantAppPath(tenantSlug, "documents/templates") },
      { title: "History", icon: History, path: tenantAppPath(tenantSlug, "documents/history") },
      { title: "Pending Signatures", icon: Send, path: tenantAppPath(tenantSlug, "documents/pending") },
    ],
  },
  {
    title: "ERP",
    items: [
      { title: "Dashboard", icon: LayoutDashboard, path: tenantAppPath(tenantSlug, "erp") },
      { title: "Inventory", icon: Package, path: tenantAppPath(tenantSlug, "erp/inventory") },
      { title: "Procurement", icon: Truck, path: tenantAppPath(tenantSlug, "erp/procurement") },
      { title: "Production", icon: BarChart3, path: tenantAppPath(tenantSlug, "erp/production") },
      { title: "Finance", icon: DollarSign, path: tenantAppPath(tenantSlug, "erp/finance") },
    ],
  },
];

interface DashboardSidebarProps {
  collapsed?: boolean;
  onCollapseToggle?: () => void;
  className?: string;
}

export function DashboardSidebar({ collapsed = false, onCollapseToggle, className }: DashboardSidebarProps) {
  const { organization } = useOrganization();
  const { signOut } = useAuth();
  const { tenantSlug = "" } = useParams<{ tenantSlug: string }>();
  const menuItems = useMemo(() => buildMenuItems(tenantSlug), [tenantSlug]);
  const settingsPath = tenantAppPath(tenantSlug, "settings");
  const primaryColor = organization?.primary_color || "var(--primary)";

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/auth/sign-in";
  };

  return (
    <aside
      className={cn(
        "h-screen bg-card/60 backdrop-blur-xl border-r border-border/40 flex flex-col transition-all duration-300 relative z-20 overflow-hidden",
        "before:absolute before:inset-0 before:bg-purple-600/5 before:pointer-events-none before:z-[-1]",
        collapsed ? "w-16" : "w-64",
        className
      )}
      style={{ "--sidebar-accent": primaryColor } as React.CSSProperties}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-border/40 shrink-0">
        {!collapsed && (
          <Link to={tenantDashboardPath(tenantSlug)} className="flex items-center gap-3">
            <div
              className="h-8 w-8 rounded-lg flex items-center justify-center text-white shrink-0 font-bold text-sm shadow-sm"
              style={{ backgroundColor: primaryColor }}
            >
              S
            </div>
            <span className="text-xl font-bold text-foreground">
              SIS<span className="text-gradient">WIT</span>
            </span>
          </Link>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={onCollapseToggle}
          className={cn("h-8 w-8 text-muted-foreground hover:bg-white/5", collapsed && "mx-auto")}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto pt-6 px-3 space-y-6 scrollbar-none">
        {menuItems.map((section, idx) => (
          <div key={idx} className="space-y-1.5">
            {"path" in section && section.path ? (
              <NavLink
                to={section.path}
                end
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-3 py-2 rounded-xl transition-all group relative",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                    collapsed && "justify-center px-0"
                  )
                }
                style={({ isActive }) => ({
                  backgroundColor: isActive ? `${primaryColor}15` : undefined,
                  color: isActive ? primaryColor : undefined,
                })}
              >
                {({ isActive }) => (
                  <>
                    <section.icon className={cn("h-4 w-4 shrink-0 transition-transform group-hover:scale-110")} />
                    {!collapsed && <span className="text-sm font-medium">{section.title}</span>}
                    {isActive && !collapsed && (
                      <div
                        className="absolute right-2 w-1 h-4 rounded-full"
                        style={{ backgroundColor: primaryColor }}
                      />
                    )}
                  </>
                )}
              </NavLink>
            ) : (
              <>
                {!collapsed && (
                  <h3 className="px-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.2em] mb-2">
                    {section.title}
                  </h3>
                )}

                <div className="space-y-1">
                  {section.items?.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-3 px-3 py-2 rounded-xl transition-all group relative",
                          isActive
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                          collapsed && "justify-center px-0"
                        )
                      }
                      style={({ isActive }) => ({
                        backgroundColor: isActive ? `${primaryColor}15` : undefined,
                        color: isActive ? primaryColor : undefined,
                      })}
                    >
                      {({ isActive }) => (
                        <>
                          <item.icon className={cn("h-4 w-4 shrink-0 transition-transform group-hover:scale-110")} />
                          {!collapsed && <span className="text-sm font-medium">{item.title}</span>}
                          {isActive && !collapsed && (
                            <div
                              className="absolute right-2 w-1 h-4 rounded-full"
                              style={{ backgroundColor: primaryColor }}
                            />
                          )}
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border/40 space-y-2 mt-auto">
        <NavLink
          to={settingsPath}
          end
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
          <Settings className={cn("h-4 w-4 shrink-0 transition-transform group-hover:scale-110")} />
          {!collapsed && <span className="text-sm font-medium">Settings</span>}
        </NavLink>

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
    </aside>
  );
}

