import { NavLink, useLocation } from "react-router-dom";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";

const menuItems = [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    path: "/dashboard",
  },
  {
    title: "CRM",
    items: [
      { title: "Dashboard", icon: LayoutDashboard, path: "/dashboard/crm" },
      { title: "Leads", icon: Users, path: "/dashboard/crm/leads" },
      { title: "Accounts", icon: Building2, path: "/dashboard/crm/accounts" },
      { title: "Contacts", icon: UserCircle, path: "/dashboard/crm/contacts" },
      { title: "Opportunities", icon: Target, path: "/dashboard/crm/opportunities" },
      { title: "Pipeline", icon: Target, path: "/dashboard/crm/pipeline" },
      { title: "Activities", icon: Calendar, path: "/dashboard/crm/activities" },
    ],
  },
  {
    title: "CPQ",
    items: [
      { title: "Dashboard", icon: LayoutDashboard, path: "/dashboard/cpq" },
      { title: "Products", icon: Package, path: "/dashboard/cpq/products" },
      { title: "Quotes", icon: FileText, path: "/dashboard/cpq/quotes" },
    ],
  },
  {
    title: "CLM",
    items: [
      { title: "Dashboard", icon: LayoutDashboard, path: "/dashboard/clm" },
      { title: "Contracts", icon: FileSignature, path: "/dashboard/clm/contracts" },
      { title: "Templates", icon: FileText, path: "/dashboard/clm/templates" },
    ],
  },
  {
    title: "Documents",
    items: [
      { title: "All Documents", icon: FileStack, path: "/dashboard/documents" },
      { title: "Create Document", icon: FilePlus, path: "/dashboard/documents/create" },
      { title: "Templates", icon: FileText, path: "/dashboard/documents/templates" },
      { title: "History", icon: History, path: "/dashboard/documents/history" },
      { title: "Pending Signatures", icon: Send, path: "/dashboard/documents/pending" },
    ],
  },
  {
    title: "ERP",
    items: [
      { title: "Dashboard", icon: LayoutDashboard, path: "/dashboard/erp" },
      { title: "Inventory", icon: Package, path: "/dashboard/erp/inventory" },
      { title: "Procurement", icon: Truck, path: "/dashboard/erp/procurement" },
      { title: "Production", icon: BarChart3, path: "/dashboard/erp/production" },
      { title: "Finance", icon: DollarSign, path: "/dashboard/erp/finance" },
    ],
  },
];

export function DashboardSidebar() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setCollapsed(window.innerWidth < 768);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const location = useLocation();

  const linkBase =
    "flex items-center py-2 rounded-lg transition-colors mx-2";

  return (
    <aside
      className={cn(
        "h-screen bg-card border-r border-border flex flex-col transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-border">
        {!collapsed && (
          <span className="text-xl font-bold text-foreground">
            SIS<span className="text-gradient">WIT</span>
          </span>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        {menuItems.map((section, idx) => (
          <div key={idx} className="mb-4">
            {"path" in section && section.path ? (
              <NavLink
                to={section.path}
                end
                className={({ isActive }) =>
                  cn(
                    linkBase,
                    collapsed ? "justify-center px-2" : "gap-3 px-4",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )
                }
              >
                {/* ICON WRAPPER (fix centering) */}
                <div className="h-5 w-5 flex items-center justify-center flex-shrink-0">
                  <section.icon className="h-5 w-5" />
                </div>

                {!collapsed && (
                  <span className="text-sm font-medium">{section.title}</span>
                )}
              </NavLink>
            ) : (
              <>
                {!collapsed && (
                  <h3 className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
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
                          linkBase,
                          collapsed ? "justify-center px-2" : "gap-3 px-4",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        )
                      }
                    >
                      {/* ICON WRAPPER (fix centering) */}
                      <div className="h-4 w-4 flex items-center justify-center flex-shrink-0">
                        <item.icon className="h-4 w-4" />
                      </div>

                      {!collapsed && (
                        <span className="text-sm">{item.title}</span>
                      )}
                    </NavLink>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </nav>

      {/* Settings */}
      <div className="border-t border-border p-2">
        <NavLink
          to="/dashboard/settings"
          end
          className={({ isActive }) =>
            cn(
              linkBase,
              collapsed ? "justify-center px-2" : "gap-3 px-4",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )
          }
        >
          <div className="h-4 w-4 flex items-center justify-center flex-shrink-0">
            <Settings className="h-4 w-4" />
          </div>

          {!collapsed && <span className="text-sm">Settings</span>}
        </NavLink>
      </div>
    </aside>
  );
}
