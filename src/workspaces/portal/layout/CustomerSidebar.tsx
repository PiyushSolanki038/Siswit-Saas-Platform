import { useMemo, useState } from "react";
import { NavLink, useParams } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import type { ComponentType } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FileSignature,
  FileStack,
  FileText,
  History,
  LayoutDashboard,
  LogOut,
  Quote,
  Send,
} from "lucide-react";
import { Button } from "@/ui/shadcn/button";
import { cn } from "@/core/utils/utils";
import { useAuth } from "@/core/auth/useAuth";
import { useOrganization } from "@/workspaces/organization/hooks/useOrganization";
import { tenantPortalPath } from "@/core/utils/routes";

interface CustomerSidebarProps {
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

interface SidebarSection {
  title: string;
  items: SidebarItem[];
}

function buildSections(tenantSlug: string): SidebarSection[] {
  return [
    {
      title: "My Quotes",
      items: [
        { label: "All Quotes", icon: Quote, href: tenantPortalPath(tenantSlug, "quotes") },
      ],
    },
    {
      title: "My Contracts",
      items: [
        { label: "Active Contracts", icon: FileSignature, href: tenantPortalPath(tenantSlug, "contracts") },
        // { label: "Templates", icon: FileText, href: tenantPortalPath(tenantSlug, "contract-templates") },
      ],
    },
    {
      title: "Documents",
      items: [
        { label: "All Documents", icon: FileStack, href: tenantPortalPath(tenantSlug, "documents") },
        { label: "History", icon: History, href: tenantPortalPath(tenantSlug, "document-history") },
      ],
    },
    {
      title: "E-Signatures",
      items: [
        { label: "Pending Signatures", icon: Send, href: tenantPortalPath(tenantSlug, "pending-signatures") },
      ],
    },
  ];
}

export function CustomerSidebar({
  className,
  onNavigate,
  collapsed = false,
  onCollapseToggle,
  hideCollapseControl = false,
}: CustomerSidebarProps) {
  const { tenantSlug = "" } = useParams<{ tenantSlug: string }>();
  const { organization } = useOrganization();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [logoFailed, setLogoFailed] = useState(false);

  const sections = useMemo(() => buildSections(tenantSlug), [tenantSlug]);
  const dashboardHref = tenantPortalPath(tenantSlug);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth/sign-in", { replace: true });
  };

  const organizationName = organization?.name?.trim() || "Client Portal";
  const organizationSubtitle = organization?.org_code ?? organization?.slug ?? "Client Workspace";
  const organizationInitials = useMemo(() => {
    const parts = organizationName
      .split(" ")
      .map((p) => p.trim())
      .filter(Boolean)
      .slice(0, 2);
    if (parts.length === 0) return "CP";
    return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
  }, [organizationName]);

  return (
    <aside className={cn("org-sidebar-panel flex h-full w-full flex-col", className)}>

      {/* ── Brand ── */}
      <div className={cn("org-sidebar-brand", collapsed && "justify-center px-0")}>
        {organization?.logo_url && !logoFailed ? (
          <img
            src={organization.logo_url}
            alt={`${organizationName} logo`}
            className="h-8 w-8 shrink-0 rounded-full border border-border/70 object-cover"
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

      {/* ── Navigation ── */}
      <div className="mt-6 flex-1 space-y-2 overflow-y-auto pr-1">

        {/* Dashboard — top-level direct link */}
        {!collapsed && (
          <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Menu
          </p>
        )}
        <nav className="space-y-1.5">
          <NavLink
            to={dashboardHref}
            end
            onClick={onNavigate}
            title={collapsed ? "Dashboard" : undefined}
            className={({ isActive }) =>
              cn(
                "org-sidebar-link",
                isActive && "org-sidebar-link-active",
                collapsed && "justify-center px-2",
              )
            }
          >
            <LayoutDashboard className={cn("h-4 w-4 shrink-0", collapsed && "mr-0")} />
            {!collapsed && <span>Dashboard</span>}
          </NavLink>
        </nav>

        {/* Grouped sections */}
        {sections.map((section) => (
          <div key={section.title} className="space-y-1.5 pt-3">
            {!collapsed && (
              <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {section.title}
              </p>
            )}
            {collapsed && <div className="mx-auto my-1 h-px w-6 bg-border/60" />}
            <nav className="space-y-1.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.href}
                    to={item.href}
                    end
                    onClick={onNavigate}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      cn(
                        "org-sidebar-link",
                        isActive && "org-sidebar-link-active",
                        collapsed && "justify-center px-2",
                      )
                    }
                  >
                    <Icon className={cn("h-4 w-4 shrink-0", collapsed && "mr-0")} />
                    {!collapsed && <span>{item.label}</span>}
                  </NavLink>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      {/* ── Footer ── */}
      <div className="mt-auto space-y-2 border-t border-border/40 pb-2 pt-6">
        {!hideCollapseControl && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onCollapseToggle}
            className={cn(
              "w-full text-muted-foreground hover:text-foreground",
              collapsed ? "justify-center px-2" : "justify-start",
            )}
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
            "w-full text-destructive hover:bg-destructive/10 hover:text-destructive",
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