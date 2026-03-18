import { useState, useMemo, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardCopy,
  Grid2X2,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  User,
} from "lucide-react";
import { Button } from "@/ui/shadcn/button";
import { Input } from "@/ui/shadcn/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/shadcn/popover";
import { Calendar } from "@/ui/shadcn/calendar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/ui/shadcn/dropdown-menu";
import { cn } from "@/core/utils/utils";
import { useAuth } from "@/core/auth/useAuth";
import { useOrganization } from "@/workspaces/organization/hooks/useOrganization";

interface OrganizationTopBarProps {
  onOpenSidebar: () => void;
}

/* ─── Sidebar page lookup used by Search & Module selector ─── */
const PAGES = [
  { label: "Dashboard", path: "/organization/overview" },
  { label: "User Management", path: "/organization/users" },
  { label: "Invitations", path: "/organization/invitations" },
  { label: "Client Approvals", path: "/organization/approvals" },
  { label: "Plans and Billing", path: "/organization/plans" },
  { label: "Alerts", path: "/organization/alerts" },
  { label: "Settings", path: "/organization/settings" },
] as const;

function getDisplayName(email: string | null | undefined): string {
  if (!email) return "Owner";
  return email.split("@")[0] || "Owner";
}

function formatSelectedDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/* ═════════════════════════  COMPONENT  ═════════════════════════ */

export function OrganizationTopBar({ onOpenSidebar }: OrganizationTopBarProps) {
  const { user, signOut } = useAuth();
  const { organization } = useOrganization();
  const navigate = useNavigate();
  const displayName = getDisplayName(user?.email);

  /* ── 1. Search ── */
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return PAGES;
    return PAGES.filter((p) => p.label.toLowerCase().includes(q));
  }, [searchQuery]);

  function handleSearchSelect(path: string) {
    navigate(path);
    setSearchQuery("");
    setSearchOpen(false);
    searchRef.current?.blur();
  }

  /* ── 2. Date picker ── */
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [dateOpen, setDateOpen] = useState(false);
  const dateLabel = selectedDate ? formatSelectedDate(selectedDate) : "Now";

  /* ── 3. Module selector ── */
  const [selectedModule, setSelectedModule] = useState<string>("All");

  function handleModuleSelect(label: string, path?: string) {
    setSelectedModule(label);
    if (path) navigate(path);
  }

  /* ── 4. Org code copy ── */
  const orgCode = organization?.org_code ?? "ORG";
  const [copied, setCopied] = useState(false);

  async function handleCopyOrgCode() {
    try {
      await navigator.clipboard.writeText(orgCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard API may fail silently in some contexts */
    }
  }

  /* ── 5. Profile / Sign out ── */
  const handleSignOut = async () => {
    await signOut();
    navigate("/auth/sign-in", { replace: true });
  };

  /* Close search dropdown when clicking outside */
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.closest(".search-popover-area")?.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <header className="org-topbar">
      {/* ───────── Left: Menu + Search ───────── */}
      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" size="icon" className="lg:hidden" onClick={onOpenSidebar}>
          <Menu className="h-5 w-5" />
          <span className="sr-only">Open menu</span>
        </Button>

        {/* Search with live results popover */}
        <Popover open={searchOpen} onOpenChange={setSearchOpen}>
          <PopoverTrigger asChild>
            <div className="search-popover-area relative w-full max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                placeholder="Search workspace…"
                className="pl-9"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
              />
            </div>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            sideOffset={6}
            className="w-[var(--radix-popover-trigger-width)] max-w-sm p-1"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            {searchResults.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">No pages found</p>
            ) : (
              <ul className="space-y-0.5">
                {searchResults.map((page) => (
                  <li key={page.path}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                      onClick={() => handleSearchSelect(page.path)}
                    >
                      <Search className="h-3.5 w-3.5 text-muted-foreground" />
                      {page.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {/* ───────── Right: Controls ───────── */}
      <div className="org-topbar-controls">

        {/* Date chip → Calendar popover */}
        <Popover open={dateOpen} onOpenChange={setDateOpen}>
          <PopoverTrigger asChild>
            <button type="button" className="org-chip">
              <CalendarDays className="h-4 w-4" />
              Date: {dateLabel}
              <ChevronDown className="ml-0.5 h-3 w-3 opacity-60" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-auto p-0">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(day) => {
                setSelectedDate(day);
                setDateOpen(false);
              }}
              initialFocus
            />
            {selectedDate && (
              <div className="border-t border-border px-3 py-2">
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => {
                    setSelectedDate(undefined);
                    setDateOpen(false);
                  }}
                >
                  Reset to Now
                </button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        {/* Module chip → Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="org-chip">
              <Grid2X2 className="h-4 w-4" />
              Module: {selectedModule}
              <ChevronDown className="ml-0.5 h-3 w-3 opacity-60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Select Module</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className={cn("cursor-pointer", selectedModule === "All" && "font-semibold text-primary")}
              onClick={() => handleModuleSelect("All")}
            >
              All
              {selectedModule === "All" && <Check className="ml-auto h-4 w-4" />}
            </DropdownMenuItem>
            {PAGES.map((page) => (
              <DropdownMenuItem
                key={page.path}
                className={cn("cursor-pointer", selectedModule === page.label && "font-semibold text-primary")}
                onClick={() => handleModuleSelect(page.label, page.path)}
              >
                {page.label}
                {selectedModule === page.label && <Check className="ml-auto h-4 w-4" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Org code chip → Copy to clipboard */}
        <button
          type="button"
          className={cn("org-chip transition-all", copied && "border-primary/50 text-primary")}
          onClick={handleCopyOrgCode}
          title="Click to copy org code"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4" />
              Copied!
            </>
          ) : (
            <>
              <ClipboardCopy className="h-3.5 w-3.5" />
              {orgCode}
            </>
          )}
        </button>

        {/* Profile chip → Dropdown menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="org-profile-chip cursor-pointer">
              <div className="org-profile-avatar">{displayName.slice(0, 2).toUpperCase()}</div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium leading-none">{displayName}</p>
                <p className="truncate text-xs text-muted-foreground">{user?.email ?? "owner@organization.com"}</p>
              </div>
              <ChevronDown className="ml-1 h-3 w-3 shrink-0 opacity-60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-medium">{displayName}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer" onClick={() => navigate("/organization/settings")}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer text-destructive focus:text-destructive"
              onClick={handleSignOut}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Invite User */}
        <Link to="/organization/invitations">
          <Button size="sm" className="h-9 rounded-full px-4">
            <Plus className="mr-1.5 h-4 w-4" />
            Invite User
          </Button>
        </Link>

        {/* Import Data (disabled, coming soon) */}
        <Button size="sm" variant="outline" className="h-9 rounded-full px-4" disabled>
          Import Data
          <span className="ml-1 text-xs text-muted-foreground">(Soon)</span>
        </Button>
      </div>
    </header>
  );
}
