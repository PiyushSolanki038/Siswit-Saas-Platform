import { useLocation } from "react-router-dom";
import { useAuth } from "@/core/auth/useAuth";
import { Button } from "@/ui/shadcn/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/ui/shadcn/dropdown-menu";
import { RoleBadge } from "@/ui/shadcn/RoleBadge";
import { Bell, ChevronDown, LogOut, Menu } from "lucide-react";
import { useNavigate } from "react-router-dom";

/* Map pathnames to readable page titles */
const PAGE_TITLES: Record<string, string> = {
  "/portal/overview": "Overview",
  "/portal/quotes": "Quotes",
  "/portal/contracts": "Contracts",
  "/portal/documents": "Documents",
  "/portal/signatures": "Signatures",
};

function getInitials(email?: string | null, firstName?: string | null): string {
  if (firstName) return firstName.slice(0, 2).toUpperCase();
  if (!email) return "CL";
  return email.split("@")[0].slice(0, 2).toUpperCase();
}

function getDisplayName(email?: string | null, firstName?: string | null): string {
  if (firstName) return firstName;
  if (!email) return "Client";
  return email.split("@")[0];
}

interface CustomerHeaderProps {
  onOpenSidebar: () => void;
}

export function CustomerHeader({ onOpenSidebar }: CustomerHeaderProps) {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const initials = getInitials(user?.email, user?.user_metadata?.first_name);
  const displayName = getDisplayName(user?.email, user?.user_metadata?.first_name);

  /* Resolve current page title — walk up the path if exact match not found */
  const pageTitle =
    PAGE_TITLES[location.pathname] ??
    PAGE_TITLES[Object.keys(PAGE_TITLES).find((k) => location.pathname.startsWith(k + "/")) ?? ""] ??
    "Portal";

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth/sign-in");
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/60 bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-6">

      {/* Mobile sidebar trigger */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 text-muted-foreground lg:hidden"
        onClick={onOpenSidebar}
        aria-label="Open sidebar"
      >
        <Menu className="h-4 w-4" />
      </Button>

      {/* Current page title */}
      <h1 className="text-sm font-semibold tracking-tight">{pageTitle}</h1>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right controls */}
      <div className="flex items-center gap-1.5">

        {/* Notification bell */}
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-primary ring-2 ring-background" />
        </Button>

        {/* Profile chip */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-8 items-center gap-2 rounded-full border border-border/60 bg-background pl-0.5 pr-2.5 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                {initials}
              </div>
              <span className="hidden max-w-[100px] truncate sm:block">{displayName}</span>
              <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="flex items-center gap-3 px-3 py-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-[13px] font-semibold text-primary-foreground">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{displayName}</p>
                <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </div>
            {role && (
              <div className="px-3 pb-2">
                <RoleBadge role={role} size="sm" />
              </div>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={handleSignOut}
              className="cursor-pointer text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}