import { useMemo, useState } from "react";
import { Link, NavLink, useParams } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  FilePlus,
  FileSignature,
  FileStack,
  FileText,
  History,
  LayoutDashboard,
  Quote,
  Send,
} from "lucide-react";
import { cn } from "@/core/utils/utils";
import { Button } from "@/ui/shadcn/button";
import { tenantPortalPath } from "@/core/utils/routes";

const buildMenuItems = (tenantSlug: string) => [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    path: tenantPortalPath(tenantSlug),
  },
  {
    title: "My Quotes",
    items: [{ title: "All Quotes", icon: Quote, path: tenantPortalPath(tenantSlug, "quotes") }],
  },
  {
    title: "My Contracts",
    items: [
      { title: "Active Contracts", icon: FileSignature, path: tenantPortalPath(tenantSlug, "contracts") },
      { title: "Templates", icon: FileText, path: tenantPortalPath(tenantSlug, "contract-templates") },
    ],
  },
  {
    title: "Documents",
    items: [
      { title: "All Documents", icon: FileStack, path: tenantPortalPath(tenantSlug, "documents") },
      // { title: "Create Document", icon: FilePlus, path: tenantPortalPath(tenantSlug, "document-create") },
      { title: "History", icon: History, path: tenantPortalPath(tenantSlug, "document-history") },
    ],
  },
  {
    title: "E-Signatures",
    items: [{ title: "Pending Signatures", icon: Send, path: tenantPortalPath(tenantSlug, "pending-signatures") }],
  },
];

export function CustomerSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { tenantSlug = "" } = useParams<{ tenantSlug: string }>();
  const menuItems = useMemo(() => buildMenuItems(tenantSlug), [tenantSlug]);

  const linkBase = "flex items-center py-2 rounded-lg transition-colors mx-2";

  return (
    <aside
      className={cn(
        "h-screen bg-card border-r border-border flex flex-col transition-all duration-300",
        collapsed ? "w-16" : "w-64",
      )}
    >
      <div className="h-16 flex items-center justify-between px-4 border-b border-border">
        {!collapsed && (
          <Link to="/" className="text-xl font-bold text-foreground">
            SIS<span className="text-gradient">WIT</span>
          </Link>
        )}
        {collapsed && <Link to="/" className="text-lg font-bold text-foreground">S</Link>}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed((current) => !current)}
          className="ml-auto"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

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
                      : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  )
                }
              >
                <div className="h-5 w-5 flex items-center justify-center flex-shrink-0">
                  <section.icon className="h-5 w-5" />
                </div>
                {!collapsed && <span className="text-sm font-medium">{section.title}</span>}
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
                            : "text-muted-foreground hover:text-foreground hover:bg-muted",
                        )
                      }
                    >
                      <div className="h-4 w-4 flex items-center justify-center flex-shrink-0">
                        <item.icon className="h-4 w-4" />
                      </div>
                      {!collapsed && <span className="text-sm">{item.title}</span>}
                    </NavLink>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </nav>
    </aside>
  );
}

