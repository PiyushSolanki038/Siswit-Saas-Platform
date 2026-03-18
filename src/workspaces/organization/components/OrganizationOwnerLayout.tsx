import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/ui/shadcn/sheet";
import { OrganizationSidebar } from "@/workspaces/organization/components/OrganizationSidebar";
import { OrganizationTopBar } from "@/workspaces/organization/components/OrganizationTopBar";
import { cn } from "@/core/utils/utils";

export default function OrganizationOwnerLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="org-shell-bg h-screen overflow-hidden">
      <div className={cn("org-shell flex h-screen w-full transition-all duration-300")}>
        <OrganizationSidebar 
          className={cn("hidden lg:flex h-screen shrink-0 transition-all duration-300", collapsed ? "w-16" : "w-[250px]")}
          collapsed={collapsed}
          onCollapseToggle={() => setCollapsed(!collapsed)}
        />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background/80">
          <OrganizationTopBar onOpenSidebar={() => setSidebarOpen(true)} />
          <main className="org-main-scroll flex-1 overflow-y-auto p-4 md:p-5 lg:p-6">
            <Outlet />
          </main>
        </div>
      </div>

      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-[290px] border-r border-border/70 p-0">
          <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
          <SheetDescription className="sr-only">Organization navigation links</SheetDescription>
          <OrganizationSidebar 
            className="h-full" 
            onNavigate={() => setSidebarOpen(false)} 
            hideCollapseControl
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
