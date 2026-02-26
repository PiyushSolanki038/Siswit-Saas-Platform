import { Link } from "react-router-dom";
import { CalendarDays, Grid2X2, Menu, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";

interface OrganizationTopBarProps {
  onOpenSidebar: () => void;
}

function getDisplayName(email: string | null | undefined): string {
  if (!email) return "Owner";
  return email.split("@")[0] || "Owner";
}

export function OrganizationTopBar({ onOpenSidebar }: OrganizationTopBarProps) {
  const { user } = useAuth();
  const { organization } = useOrganization();
  const displayName = getDisplayName(user?.email);

  return (
    <header className="org-topbar">
      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" size="icon" className="lg:hidden" onClick={onOpenSidebar}>
          <Menu className="h-5 w-5" />
          <span className="sr-only">Open menu</span>
        </Button>
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search workspace" className="pl-9" />
        </div>
      </div>

      <div className="org-topbar-controls">
        <button type="button" className="org-chip">
          <CalendarDays className="h-4 w-4" />
          Date: Now
        </button>
        <button type="button" className="org-chip">
          <Grid2X2 className="h-4 w-4" />
          Module: All
        </button>
        <button type="button" className="org-chip">
          {organization?.org_code ?? "ORG"}
        </button>
        <div className="org-profile-chip">
          <div className="org-profile-avatar">{displayName.slice(0, 2).toUpperCase()}</div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium leading-none">{displayName}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email ?? "owner@organization.com"}</p>
          </div>
        </div>
        <Link to="/organization/invitations">
          <Button size="sm" className="h-9 rounded-full px-4">
            <Plus className="mr-1.5 h-4 w-4" />
            Invite User
          </Button>
        </Link>
        <Button size="sm" variant="outline" className="h-9 rounded-full px-4" disabled>
          Import Data
          <span className="ml-1 text-xs text-muted-foreground">(Soon)</span>
        </Button>
      </div>
    </header>
  );
}

