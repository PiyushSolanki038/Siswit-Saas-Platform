import { ReactNode, useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { CustomerSidebar } from "./CustomerSidebar";
import { CustomerHeader } from "./CustomerHeader";
import { useAuth } from "@/core/auth/useAuth";
import { isPlatformRole } from "@/core/types/roles";
import { ImpersonationBanner } from "@/workspaces/platform/layout/ImpersonationBanner";
import { cn } from "@/core/utils/utils";

interface CustomerPortalLayoutProps {
  children?: ReactNode;
}

export function CustomerPortalLayout({ children }: CustomerPortalLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { role } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Redirect platform users away
  useEffect(() => {
    if (isPlatformRole(role)) {
      navigate("/platform", { replace: true });
    }
  }, [role, navigate]);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  if (isPlatformRole(role)) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-background">

      {/* ── Desktop sidebar — static ── */}
      <div
        className={cn(
          "hidden shrink-0 transition-all duration-300 lg:block",
          collapsed ? "w-[60px]" : "w-[250px]",
        )}
      >
        <CustomerSidebar
          collapsed={collapsed}
          onCollapseToggle={() => setCollapsed((c) => !c)}
        />
      </div>

      {/* ── Mobile sidebar — overlay drawer ── */}
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-background/70 backdrop-blur-sm transition-opacity lg:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />
      {/* Drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[250px] transform transition-transform duration-300 lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <CustomerSidebar
          onNavigate={() => setMobileOpen(false)}
          hideCollapseControl
        />
      </aside>

      {/* ── Main content ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <ImpersonationBanner />
        <CustomerHeader onOpenSidebar={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  );
}