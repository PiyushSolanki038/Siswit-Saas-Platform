import { ReactNode, useState } from "react";
import { Outlet } from "react-router-dom";
import { DashboardSidebar } from "./DashboardSidebar";
import { EmployeeTopBar } from "./EmployeeTopBar";
import { Sheet, SheetContent } from "@/ui/shadcn/sheet";

interface DashboardLayoutProps {
  children?: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen bg-[#050510] relative overflow-hidden text-foreground">
      {/* Background Atmospheric Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/5 blur-[120px] rounded-full pointer-events-none" />
      
      <DashboardSidebar 
        collapsed={collapsed} 
        onCollapseToggle={() => setCollapsed(!collapsed)}
        className="hidden lg:flex"
      />

      {/* Mobile Sidebar */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="p-0 border-none bg-transparent w-64">
           <DashboardSidebar 
              collapsed={false} 
              onCollapseToggle={() => setMobileMenuOpen(false)}
              className="w-full"
            />
        </SheetContent>
      </Sheet>
      
      {/* Mobile Sidebar Trigger (Placeholder for now, integrated in TopBar) */}
      
      <div className="flex-1 flex flex-col overflow-hidden relative z-10 bg-background/20 backdrop-blur-3xl">
        <EmployeeTopBar onOpenSidebar={() => setMobileMenuOpen(true)} />
        
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-muted/0">
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
}
