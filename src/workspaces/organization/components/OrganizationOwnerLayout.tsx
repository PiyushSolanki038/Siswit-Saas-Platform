import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/ui/shadcn/sheet";
import { OrganizationSidebar } from "@/workspaces/organization/components/OrganizationSidebar";
import { OrganizationTopBar } from "@/workspaces/organization/components/OrganizationTopBar";
import { TrialBanner } from "@/ui/trial-banner";
import { useOrganization } from "@/workspaces/organization/hooks/useOrganization";
import { cn } from "@/core/utils/utils";

export default function OrganizationOwnerLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { organization } = useOrganization();
  const primaryColor = organization?.primary_color || "var(--primary)";

  return (
    <div className="relative h-screen overflow-hidden bg-background text-foreground selection:bg-primary/30">
      {/* Branded Radial Glow */}
      <div
        className="fixed -top-[10%] -right-[5%] w-[40%] h-[40%] rounded-full blur-[120px] opacity-[0.08] pointer-events-none z-0"
        style={{ backgroundColor: primaryColor }}
      />
      <div
        className="fixed -bottom-[10%] -left-[5%] w-[40%] h-[40%] rounded-full blur-[120px] opacity-[0.05] pointer-events-none z-0"
        style={{ backgroundColor: primaryColor }}
      />
      
      {/* Marketing Purple Accent Glow */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] rounded-full bg-purple-600/5 blur-[160px] pointer-events-none z-0" />

      <div className="relative flex h-screen w-full transition-all duration-300 z-10">
        <OrganizationSidebar
          className={cn(
            "hidden lg:flex h-screen shrink-0 transition-all duration-300",
            collapsed ? "w-16" : "w-64"
          )}
          collapsed={collapsed}
          onCollapseToggle={() => setCollapsed(!collapsed)}
        />

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background/20 backdrop-blur-3xl">
          <TrialBanner />
          <OrganizationTopBar onOpenSidebar={() => setSidebarOpen(true)} />
          <main className="flex-1 overflow-y-auto custom-scrollbar p-6 lg:p-8 bg-muted/0">
            <div className="mx-auto max-w-7xl animate-in fade-in slide-in-from-bottom-4 duration-700">
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-[280px] p-0 border-r border-border/40 bg-card/95 backdrop-blur-xl">
          <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
          <SheetDescription className="sr-only">Organization navigation links</SheetDescription>
          <OrganizationSidebar
            className="h-full border-none"
            onNavigate={() => setSidebarOpen(false)}
            hideCollapseControl
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
