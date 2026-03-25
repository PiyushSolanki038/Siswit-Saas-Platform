import { useState, useMemo, useRef, useEffect, useCallback } from "react";
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
  X,
} from "lucide-react";
import { Button } from "@/ui/shadcn/button";
import { Input } from "@/ui/shadcn/input";
import { Calendar } from "@/ui/shadcn/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/ui/shadcn/popover";
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
import { NotificationBell } from "@/ui/notification-bell";

interface OrganizationTopBarProps {
  onOpenSidebar: () => void;
}

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
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/* Small icon-only button used in the mobile bar */
function MobileIconBtn({
  children,
  onClick,
  active,
  title,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  title?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors",
        active
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border/60 bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
        className
      )}
    >
      {children}
    </button>
  );
}

export function OrganizationTopBar({ onOpenSidebar }: OrganizationTopBarProps) {
  const { user, signOut } = useAuth();
  const { organization } = useOrganization();
  const navigate = useNavigate();
  const displayName = getDisplayName(user?.email);
  const initials = displayName.slice(0, 2).toUpperCase();

  /* ── Desktop search ── */
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement>(null);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return PAGES;
    return PAGES.filter((p) => p.label.toLowerCase().includes(q));
  }, [searchQuery]);

  function handleSearchSelect(path: string) {
    navigate(path);
    setSearchQuery("");
    setSearchOpen(false);
  }

  /* Close desktop search dropdown on outside click — use a ref-based
     approach so we never toggle `searchOpen` inside a focus handler,
     which is the main cause of flicker. */
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  /* ── Mobile search overlay ── */
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileQuery, setMobileQuery] = useState("");
  const mobileSearchRef = useRef<HTMLInputElement>(null);

  const mobileResults = useMemo(() => {
    const q = mobileQuery.trim().toLowerCase();
    if (!q) return PAGES;
    return PAGES.filter((p) => p.label.toLowerCase().includes(q));
  }, [mobileQuery]);

  useEffect(() => {
    if (mobileSearchOpen) setTimeout(() => mobileSearchRef.current?.focus(), 50);
  }, [mobileSearchOpen]);

  function handleMobileSearchSelect(path: string) {
    navigate(path);
    setMobileQuery("");
    setMobileSearchOpen(false);
  }

  /* ── Date picker ── */
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const dateLabel = selectedDate ? formatSelectedDate(selectedDate) : "Now";

  /* ── Module selector ── */
  const [selectedModule, setSelectedModule] = useState<string>("All");
  const handleModuleSelect = useCallback(
    (label: string, path?: string) => {
      setSelectedModule(label);
      if (path) navigate(path);
    },
    [navigate]
  );

  /* ── Org code copy ── */
  const orgCode = organization?.org_code ?? "ORG";
  const [copied, setCopied] = useState(false);
  async function handleCopyOrgCode() {
    try {
      await navigator.clipboard.writeText(orgCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* silent */ }
  }

  /* ── Sign out ── */
  const handleSignOut = async () => {
    await signOut();
    navigate("/auth/sign-in", { replace: true });
  };

  /* ── Shared calendar popover (used in both mobile + desktop) ── */
  const CalendarPopover = ({
    trigger,
    align,
  }: {
    trigger: React.ReactNode;
    align: "start" | "end";
  }) => (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align={align}
        className="w-auto p-0"
        /* Prevent the popover from stealing focus on open — key anti-flicker fix */
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(day) => setSelectedDate(day)}
        />
        {selectedDate && (
          <div className="border-t border-border px-3 py-2">
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={() => setSelectedDate(undefined)}
            >
              Reset to Now
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );

  /* ── Shared module dropdown ── */
  const ModuleDropdown = ({ align }: { align: "start" | "end" }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {align === "end" ? (
          <button type="button" className="org-chip">
            <Grid2X2 className="h-4 w-4" />
            Module: {selectedModule}
            <ChevronDown className="ml-0.5 h-3 w-3 opacity-60" />
          </button>
        ) : (
          <MobileIconBtn title={`Module: ${selectedModule}`} active={selectedModule !== "All"}>
            <Grid2X2 className="h-3.5 w-3.5" />
          </MobileIconBtn>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        className="w-48"
      >
        <DropdownMenuLabel>Select Module</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className={cn("cursor-pointer", selectedModule === "All" && "font-semibold text-primary")}
          onSelect={() => handleModuleSelect("All")}
        >
          All {selectedModule === "All" && <Check className="ml-auto h-4 w-4" />}
        </DropdownMenuItem>
        {PAGES.map((page) => (
          <DropdownMenuItem
            key={page.path}
            className={cn(
              "cursor-pointer",
              selectedModule === page.label && "font-semibold text-primary"
            )}
            onSelect={() => handleModuleSelect(page.label, page.path)}
          >
            {page.label}
            {selectedModule === page.label && <Check className="ml-auto h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  /* ── Shared profile dropdown ── */
  const ProfileDropdown = ({ mobile }: { mobile?: boolean }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {mobile ? (
          <button
            type="button"
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground ring-2 ring-primary/20 transition-opacity hover:opacity-90"
          >
            {initials}
          </button>
        ) : (
          <button type="button" className="org-profile-chip cursor-pointer">
            <div className="org-profile-avatar">{initials}</div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium leading-none">{displayName}</p>
              <p className="truncate text-xs text-muted-foreground">
                {user?.email ?? "owner@organization.com"}
              </p>
            </div>
            <ChevronDown className="ml-1 h-3 w-3 shrink-0 opacity-60" />
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-52"
      >
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-medium">{displayName}</p>
          <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer"
          onSelect={() => navigate("/organization/settings")}
        >
          <Settings className="mr-2 h-4 w-4" /> Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer text-destructive focus:text-destructive"
          onSelect={handleSignOut}
        >
          <LogOut className="mr-2 h-4 w-4" /> Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <>
      <header className="org-topbar">

        {/* ══════════════════════════════════
            MOBILE — single icon row
        ══════════════════════════════════ */}
        <div className="flex w-full items-center gap-1.5 lg:hidden">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground"
            onClick={onOpenSidebar}
          >
            <Menu className="h-4 w-4" />
            <span className="sr-only">Open sidebar</span>
          </Button>

          <MobileIconBtn title="Search" onClick={() => setMobileSearchOpen(true)}>
            <Search className="h-3.5 w-3.5" />
          </MobileIconBtn>

          <CalendarPopover
            align="start"
            trigger={
              <MobileIconBtn title={`Date: ${dateLabel}`} active={!!selectedDate}>
                <CalendarDays className="h-3.5 w-3.5" />
              </MobileIconBtn>
            }
          />

          <ModuleDropdown align="start" />

          <MobileIconBtn
            title={`Copy: ${orgCode}`}
            active={copied}
            onClick={handleCopyOrgCode}
          >
            {copied
              ? <Check className="h-3.5 w-3.5" />
              : <ClipboardCopy className="h-3.5 w-3.5" />}
          </MobileIconBtn>

          <Link to="/organization/invitations" className="shrink-0">
            <MobileIconBtn
              title="Invite User"
              className="border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
            </MobileIconBtn>
          </Link>

          <div className="flex-1" />

          <div className="mx-1">
            <NotificationBell />
          </div>
          <ProfileDropdown mobile />
        </div>

        {/* ══════════════════════════════════
            DESKTOP — chip layout
        ══════════════════════════════════ */}
        <div className="hidden w-full items-center gap-2 lg:flex">

          {/* Search — capped narrower than before */}
          <div ref={searchWrapRef} className="relative w-full max-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search workspace…"
              className="pl-9"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
            />
            {/* Results dropdown rendered as a plain div — no Popover, no focus transfer */}
            {searchOpen && (
              <div className="absolute left-0 top-full z-50 mt-1.5 w-full overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-md">
                {searchResults.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-muted-foreground">No pages found</p>
                ) : (
                  <ul className="space-y-0.5">
                    {searchResults.map((page) => (
                      <li key={page.path}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                          /* Use onMouseDown + preventDefault so the input doesn't lose
                             focus before the click fires — eliminates dropdown flicker */
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSearchSelect(page.path);
                          }}
                        >
                          <Search className="h-3.5 w-3.5 text-muted-foreground" />
                          {page.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div className="org-topbar-controls flex-1">

            {/* Date chip */}
            <CalendarPopover
              align="end"
              trigger={
                <button type="button" className="org-chip">
                  <CalendarDays className="h-4 w-4" />
                  Date: {dateLabel}
                  <ChevronDown className="ml-0.5 h-3 w-3 opacity-60" />
                </button>
              }
            />

            {/* Module chip */}
            <ModuleDropdown align="end" />

            {/* Org code chip */}
            <button
              type="button"
              className={cn("org-chip transition-all", copied && "border-primary/50 text-primary")}
              onClick={handleCopyOrgCode}
              title="Click to copy org code"
            >
              {copied
                ? <><Check className="h-4 w-4" /> Copied!</>
                : <><ClipboardCopy className="h-3.5 w-3.5" /> {orgCode}</>}
            </button>

            {/* Spacer pushes profile to the far right */}
            <div className="flex-1" />

            {/* Invite User */}
            <Link to="/organization/invitations">
              <Button size="sm" className="h-9 rounded-full px-4">
                <Plus className="mr-1.5 h-4 w-4" /> Invite User
              </Button>
            </Link>

            {/* Import Data */}
            <Button size="sm" variant="outline" className="h-9 rounded-full px-4" disabled>
              Import Data{" "}
              <span className="ml-1 text-xs text-muted-foreground">(Soon)</span>
            </Button>

            <div className="mx-2">
              <NotificationBell />
            </div>
            <ProfileDropdown />
          </div>
        </div>
      </header>

      {/* ══════════════════════════════════
          Mobile full-screen search overlay
      ══════════════════════════════════ */}
      {mobileSearchOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background lg:hidden">
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              ref={mobileSearchRef}
              type="text"
              placeholder="Search workspace…"
              value={mobileQuery}
              onChange={(e) => setMobileQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <button
              type="button"
              onClick={() => {
                setMobileSearchOpen(false);
                setMobileQuery("");
              }}
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <ul className="flex-1 overflow-y-auto p-2">
            {mobileResults.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                No pages found
              </p>
            ) : (
              mobileResults.map((page) => (
                <li key={page.path}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-sm text-foreground transition-colors hover:bg-accent"
                    onClick={() => handleMobileSearchSelect(page.path)}
                  >
                    <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                    {page.label}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </>
  );
}