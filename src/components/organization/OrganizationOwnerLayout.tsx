import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { OrganizationSidebar } from "@/components/organization/OrganizationSidebar";
import { OrganizationTopBar } from "@/components/organization/OrganizationTopBar";

export default function OrganizationOwnerLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="org-shell-bg min-h-screen">
      <div className="org-shell grid min-h-screen w-full overflow-hidden lg:grid-cols-[250px_1fr]">
        <OrganizationSidebar className="hidden lg:flex" />
        <div className="flex min-w-0 flex-col bg-background/80">
          <OrganizationTopBar onOpenSidebar={() => setSidebarOpen(true)} />
          <main className="org-main-scroll flex-1 overflow-y-auto p-4 md:p-5 lg:p-6">
            <Outlet />
          </main>
        </div>
      </div>

      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-[290px] border-r border-border/70 p-0">
          <OrganizationSidebar className="h-full" onNavigate={() => setSidebarOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
