import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
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
import { tenantAppPath, tenantDashboardPath } from "@/core/utils/routes";

interface EmployeeTopBarProps {
  onOpenSidebar: () => void;
}

const EMPLOYEE_PAGES = [
  { label: "Dashboard Overview", path: "" },
  { label: "CRM Leads", path: "crm/leads" },
  { label: "CRM Accounts", path: "crm/accounts" },
  { label: "CRM Contacts", path: "crm/contacts" },
  { label: "CRM Opportunities", path: "crm/opportunities" },
  { label: "CRM Pipeline", path: "crm/pipeline" },
  { label: "CRM Activities", path: "crm/activities" },
  { label: "CPQ Products", path: "cpq/products" },
  { label: "CPQ Quotes", path: "cpq/quotes" },
  { label: "CLM Contracts", path: "clm/contracts" },
  { label: "CLM Templates", path: "clm/templates" },
  { label: "Documents", path: "documents" },
  { label: "ERP Inventory", path: "erp/inventory" },
  { label: "ERP Procurement", path: "erp/procurement" },
  { label: "ERP Production", path: "erp/production" },
  { label: "ERP Finance", path: "erp/finance" },
  { label: "Settings", path: "settings" },
] as const;

function getDisplayName(user: any): string {
  if (user?.user_metadata?.first_name) return user.user_metadata.first_name;
  if (!user?.email) return "Employee";
  return user.email.split("@")[0] || "Employee";
}

function formatSelectedDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function EmployeeTopBar({ onOpenSidebar }: EmployeeTopBarProps) {
  const { user, signOut, role } = useAuth();
  const { organization } = useOrganization();
  const navigate = useNavigate();
  const { tenantSlug = "" } = useParams<{ tenantSlug: string }>();
  
  const displayName = getDisplayName(user);
  const initials = displayName.slice(0, 2).toUpperCase();
  const primaryColor = organization?.primary_color || "var(--primary)";

  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement>(null);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return EMPLOYEE_PAGES;
    return EMPLOYEE_PAGES.filter((p) => p.label.toLowerCase().includes(q));
  }, [searchQuery]);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const dateLabel = selectedDate ? formatSelectedDate(selectedDate) : "Current";

  const [selectedModule, setSelectedModule] = useState<string>("All");
  const handleModuleSelect = useCallback((label: string, path?: string) => {
    setSelectedModule(label);
    if (path === "") {
        navigate(tenantDashboardPath(tenantSlug));
    } else if (path) {
        navigate(tenantAppPath(tenantSlug, path));
    }
  }, [navigate, tenantSlug]);

  const orgCode = organization?.org_code ?? "SISWIT";
  const [copied, setCopied] = useState(false);
  async function handleCopyOrgCode() {
    try {
      await navigator.clipboard.writeText(orgCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* silent */ }
  }

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/auth/sign-in";
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-purple-500/10 bg-card/60 backdrop-blur-2xl px-4 lg:px-8 py-3 overflow-visible">
      {/* Topbar Internal Glow */}
      <div className="absolute inset-0 bg-purple-600/5 pointer-events-none overflow-hidden" />
      
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 relative z-10">
        
        {/* Left: Search & Navigation Helpers */}
        <div className="flex flex-1 items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden h-9 w-9 text-muted-foreground hover:bg-white/5"
            onClick={onOpenSidebar}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div ref={searchWrapRef} className="relative hidden md:block w-full max-w-[280px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
            <Input
              placeholder="Search command..."
              className="h-9 w-full bg-white/5 border-white/5 transition-all focus:bg-white/10 focus:ring-1 focus:ring-white/10 pl-10 text-xs font-medium"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
            />
            {searchOpen && (
              <div className="absolute left-0 top-full z-[100] mt-2 w-full overflow-hidden rounded-xl border border-white/10 bg-card/95 backdrop-blur-xl p-1 shadow-2xl animate-in fade-in zoom-in-95">
                {searchResults.length === 0 ? (
                  <p className="px-3 py-4 text-center text-xs text-muted-foreground/60">No matching commands</p>
                ) : (
                  <ul className="space-y-0.5">
                    {searchResults.map((page) => (
                      <li key={page.path}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-all hover:bg-white/5 hover:text-foreground"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            if (page.path === "") {
                                navigate(tenantDashboardPath(tenantSlug));
                            } else {
                                navigate(tenantAppPath(tenantSlug, page.path));
                            }
                            setSearchOpen(false);
                            setSearchQuery("");
                          }}
                        >
                          <Grid2X2 className="h-3.5 w-3.5 opacity-60" />
                          {page.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Center: Quick Action Chips (Desktop) */}
        <div className="hidden lg:flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/5 hover:bg-white/10 transition-all text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">
                <CalendarDays className="h-3.5 w-3.5" />
                {dateLabel}
                <ChevronDown className="h-3 w-3 opacity-40" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="center" className="w-auto p-0 border-white/10 bg-card/95 backdrop-blur-xl shadow-2xl">
              <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} />
            </PopoverContent>
          </Popover>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/5 hover:bg-white/10 transition-all text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">
                <Grid2X2 className="h-3.5 w-3.5" />
                {selectedModule}
                <ChevronDown className="h-3 w-3 opacity-40" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-48 border-white/10 bg-card/95 backdrop-blur-xl">
              <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60">Modules</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/5" />
              <DropdownMenuItem className="text-xs font-medium cursor-pointer" onSelect={() => handleModuleSelect("All", "")}>Overview</DropdownMenuItem>
              {EMPLOYEE_PAGES.map(p => (
                <DropdownMenuItem key={p.path} className="text-xs font-medium cursor-pointer" onSelect={() => handleModuleSelect(p.label, p.path)}>{p.label}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            onClick={handleCopyOrgCode}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/5 hover:bg-white/10 transition-all text-[11px] font-bold tracking-widest text-muted-foreground/80",
              copied && "border-primary/40 text-primary bg-primary/5"
            )}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
            {copied ? "COPIED" : orgCode}
          </button>
        </div>

        {/* Right: Actions & Profile */}
        <div className="flex items-center gap-3">
          <NotificationBell />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 p-1 rounded-full hover:bg-white/5 transition-all">
                <div 
                  className="h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shadow-lg border border-white/10 shrink-0 relative"
                  style={{ backgroundColor: primaryColor }}
                >
                  {initials}
                  <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-background" />
                </div>
                <div className="hidden md:block text-left mr-1">
                  <p className="text-xs font-bold leading-none">{displayName}</p>
                  <p className="text-[10px] text-muted-foreground font-medium mt-0.5 opacity-60 capitalize">{role || "Employee"}</p>
                </div>
                <ChevronDown className="h-3 w-3 text-muted-foreground/60 hidden md:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 mt-2 border-white/10 bg-card/95 backdrop-blur-xl p-2 shadow-2xl">
              <div className="px-2 py-3 mb-2 rounded-lg bg-white/5">
                <p className="text-xs font-bold">{displayName}</p>
                <p className="text-[10px] text-muted-foreground font-medium truncate mt-0.5">{user?.email}</p>
              </div>
              <DropdownMenuItem className="text-xs font-medium py-2 cursor-pointer focus:bg-white/5" onSelect={() => navigate(tenantAppPath(tenantSlug, "settings"))}>
                <Settings className="mr-2 h-3.5 w-3.5 opacity-60" /> Account Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/5" />
              <DropdownMenuItem className="text-xs font-medium py-2 cursor-pointer text-destructive focus:bg-destructive/10" onSelect={handleSignOut}>
                <LogOut className="mr-2 h-3.5 w-3.5" /> Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
