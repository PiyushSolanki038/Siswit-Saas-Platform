import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Menu,
  X,
  Moon,
  Sun,
  LogOut,
  User,
  Shield,
  LayoutDashboard,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { RoleBadge } from "@/components/ui/RoleBadge";
import { AppRole } from "@/types/roles";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/* -------------------- NAV -------------------- */

const navigation = [
  { name: "Home", href: "/" },
  { name: "Products", href: "/products" },
  { name: "Solutions", href: "/solutions" },
  { name: "Pricing", href: "/pricing" },
  { name: "About", href: "/about" },
];

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isDark, setIsDark] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const { user, role, signOut, loading } = useAuth();

  const isAdmin = role === AppRole.ADMIN;
  const isEmployee = role === AppRole.EMPLOYEE;
  const dashboardHref = isAdmin ? "/admin" : "/dashboard";

  const isActive = (href: string) =>
    location.pathname === href || location.pathname.startsWith(href + "/");

  /* -------------------- EFFECTS -------------------- */

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  /* -------------------- HANDLERS -------------------- */

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  /* -------------------- LOADING -------------------- */

  if (loading) {
    return (
      <header className="fixed top-0 inset-x-0 z-50 h-16 lg:h-20 bg-background/80 backdrop-blur border-b">
        <div className="container mx-auto px-4 h-full flex items-center justify-between">
          <span className="text-xl font-bold opacity-50">SISWIT</span>
          <div className="h-4 w-24 bg-muted animate-pulse rounded" />
        </div>
      </header>
    );
  }

  /* -------------------- RENDER -------------------- */

  return (
    <header
      className={`fixed top-0 inset-x-0 z-40 transition-all duration-300 ${
        scrolled
          ? "bg-background/80 backdrop-blur border-b shadow-sm"
          : "bg-transparent"
      }`}
    >
      <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* justify-between ensures the left group and right group stay at opposite ends */}
        <div className="flex items-center justify-between h-16 lg:h-20">
          
          {/* LEFT GROUP: Mobile Menu + Logo */}
          <div className="flex items-center">
            {/* Mobile Menu Button */}
            <div className="flex lg:hidden mr-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(true)}
              >
                <Menu className="h-6 w-6" />
              </Button>
            </div>

            {/* Logo */}
            <Link to="/" className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-lg">
                  S
                </span>
              </div>
              <span className="text-xl font-bold">
                SIS<span className="text-gradient">WIT</span>
              </span>
            </Link>
          </div>

          {/* CENTER/DESKTOP NAV: Stays hidden on mobile */}
          <div className="hidden lg:flex items-center gap-1">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  isActive(item.href)
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                {item.name}
              </Link>
            ))}
          </div>

          {/* RIGHT SECTION: Desktop Auth/Theme */}
          <div className="hidden lg:flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleTheme}>
              {isDark ? <Sun /> : <Moon />}
            </Button>

            {user && (
              <Link to={dashboardHref}>
                <Button variant="outline" size="sm" className="gap-2">
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </Button>
              </Link>
            )}

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    {isAdmin ? <Shield /> : <User />}
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end">
                  {role && (
                    <div className="px-2 py-1">
                      <RoleBadge role={role} size="sm" />
                    </div>
                  )}

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    onClick={handleSignOut}
                    className="text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex gap-2">
                <Link to="/auth">
                  <Button variant="outline" size="sm">
                    Sign In
                  </Button>
                </Link>
                <Link to="/auth">
                  <Button variant="hero" size="sm">
                    Get Started
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {/* MOBILE THEME TOGGLE: Pushed to far right by justify-between */}
          <div className="flex lg:hidden">
            <Button variant="ghost" size="icon" onClick={toggleTheme}>
              {isDark ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </nav>

      {/* -------------------- MOBILE OVERLAY -------------------- */}
      <div
        className={`fixed inset-0 z-50 bg-background/80 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          mobileMenuOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setMobileMenuOpen(false)}
      />

      {/* -------------------- MOBILE DRAWER -------------------- */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-[85vw] max-w-[320px] h-[100dvh] bg-background border-r border-border shadow-2xl transform transition-transform duration-300 ease-in-out lg:hidden ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <span className="text-xl font-bold">
              SIS<span className="text-gradient">WIT</span>
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-6">
            <div className="space-y-1">
              <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Menu
              </p>
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive(item.href)
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-secondary text-foreground/80"
                  }`}
                >
                  {item.name}
                  {isActive(item.href) && (
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  )}
                </Link>
              ))}
            </div>

            {(isEmployee || isAdmin) && (
              <div className="space-y-1">
                <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Workspace
                </p>

                {isEmployee && (
                  <Link
                    to="/dashboard"
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      location.pathname.startsWith("/dashboard")
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-secondary text-foreground/80"
                    }`}
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    Employee Dashboard
                  </Link>
                )}

                {isAdmin && (
                  <Link
                    to="/admin"
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      location.pathname.startsWith("/admin")
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-secondary text-foreground/80"
                    }`}
                  >
                    <Shield className="h-4 w-4" />
                    Admin Control Panel
                  </Link>
                )}
              </div>
            )}
          </div>

          <div className="p-4 border-t border-border bg-secondary/20">
            {user ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 px-1 mb-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                    {isAdmin ? (
                      <Shield className="h-5 w-5 text-primary" />
                    ) : (
                      <User className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-sm font-semibold truncate">
                      My Account
                    </span>
                    <div className="flex">
                      {role && <RoleBadge role={role} size="sm" />}
                    </div>
                  </div>
                </div>

                <Button
                  variant="outline"
                  onClick={handleSignOut}
                  className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Link to="/auth">
                  <Button variant="outline" className="w-full">
                    Sign In
                  </Button>
                </Link>
                <Link to="/auth">
                  <Button variant="hero" className="w-full">
                    Get Started
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}