import { LogOut, User, Menu } from "lucide-react";
import { useState } from "react";
import { Button } from "@/ui/shadcn/button";
import { Input } from "@/ui/shadcn/input";
import { Avatar, AvatarFallback } from "@/ui/shadcn/avatar";
import { useAuth } from "@/core/auth/useAuth";
import { useNavigate, useParams } from "react-router-dom";
import { RoleBadge } from "@/ui/shadcn/RoleBadge";
import { tenantAppPath } from "@/core/utils/routes";
import { NotificationBell } from "@/ui/notification-bell";

export function DashboardHeader() {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const { tenantSlug = "" } = useParams<{ tenantSlug: string }>();
  const [mobileOpen, setMobileOpen] = useState(false);
  const settingsPath = tenantAppPath(tenantSlug, "settings");

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth/sign-in", { replace: true });
  };

  const initials =
    user?.user_metadata?.first_name?.[0] ||
    user?.email?.[0]?.toUpperCase() ||
    "U";

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 md:px-6 relative">

      {/* SEARCH (LEFT SIDE) */}
      <div className="flex-1 max-w-md hidden sm:block">
        <Input placeholder="Search..." className="pl-4 bg-muted/50" />
      </div>

      {/* RIGHT SIDE DESKTOP */}
      <div className="hidden md:flex items-center gap-4 ml-auto">

        {/* Role always visible now */}
        {role && <RoleBadge role={role} />}

        {/* Notifications */}
        <NotificationBell />

        {/* Settings */}
        <Button variant="ghost" onClick={() => navigate(settingsPath)}>
          <User className="h-4 w-4 mr-1" />
          Settings
        </Button>

        <Button variant="destructive" onClick={handleSignOut}>
          <LogOut className="h-4 w-4 mr-1" />
          Logout
        </Button>
      </div>

      {/* MOBILE RIGHT SIDE */}
      <div className="md:hidden ml-auto flex items-center gap-2">

        {/* small notif */}
        <NotificationBell />

        {/*menu on RIGHT */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          <Menu className="h-6 w-6" />
        </Button>
      </div>

      {/* MOBILE DROPDOWN */}
      {mobileOpen && (
        <div className="absolute top-16 right-2 w-64 bg-card border border-border rounded-xl shadow-lg p-4 flex flex-col gap-3 z-50 md:hidden">

          <div className="flex items-center gap-2 border-b pb-3">
            <Avatar className="h-9 w-9">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium">
                {user?.user_metadata?.first_name}
              </p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          {/*Role always visible */}
          {role && <RoleBadge role={role} />}

          <Button variant="ghost" onClick={() => navigate(settingsPath)}>
            <User className="h-4 w-4 mr-2" />
            Settings
          </Button>

          <Button variant="destructive" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      )}
    </header>
  );
}
