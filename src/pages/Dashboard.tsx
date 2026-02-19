import { useEffect, useState, ComponentType } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  Calculator, FileText, Users, Settings, BarChart3,
  Bell, Search, Plus, ArrowRight, TrendingUp, Clock,
  CheckCircle2, AlertCircle, Loader2, LogOut, FileStack,
  Boxes
} from "lucide-react";

interface Profile {
  first_name: string | null;
  last_name: string | null;
  company: string | null;
}

type ActivityStatus = "completed" | "pending" | "failed" | string;

interface Activity {
  title: string;
  time: string;
  status: ActivityStatus;
}

interface Stat {
  label: string;
  value: string;
  change: string;
  icon: ComponentType<any>;
}

interface QuickAction {
  icon: ComponentType<any>;
  title: string;
  description: string;
  color: string;
  route: string;
}

const quickActions: QuickAction[] = [
  { icon: Calculator, title: "Create Quote", description: "Start a new CPQ quote", color: "from-primary to-primary/60", route: "/dashboard/cpq/quotes/new" },
  { icon: FileText, title: "New Contract", description: "Draft a new contract", color: "from-accent to-accent/60", route: "/dashboard/clm/contracts" },
  { icon: FileStack, title: "Create Document", description: "Generate a new document", color: "from-chart-4 to-chart-4/60", route: "/dashboard/documents/create" },
  { icon: Boxes, title: "Update Inventory", description: "Manage stock levels", color: "from-orange-500 to-orange-500/60", route: "/dashboard/erp/inventory" },
  { icon: Users, title: "Add Contact", description: "Add a new customer", color: "from-chart-3 to-chart-3/60", route: "/dashboard/crm/contacts" },
];

const Dashboard = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);

  // Initialize with empty/zero stats - these will show real data when fetched
  const [stats, setStats] = useState<Stat[]>([
    { label: "Open Quotes", value: "0", change: "+0%", icon: Calculator },
    { label: "Active Contracts", value: "0", change: "+0%", icon: FileText },
    { label: "Documents Generated", value: "0", change: "+0%", icon: FileStack },
    { label: "Inventory Value", value: "$0", change: "+0%", icon: Boxes },
    { label: "Revenue MTD", value: "$0", change: "+0%", icon: TrendingUp },
  ]);
  const [recentActivity, setRecentActivity] = useState<Activity[]>([]);

  // Fetch dashboard stats and recent activities
  useEffect(() => {
    const fetchDashboard = async () => {
      if (!user) return;

      try {
        // Quotes count (open)
        const { count: quotesCount, error: quotesErr } = await supabase
          .from("quotes")
          .select("id", { count: "exact" })
          .in("status", ["draft", "pending_approval"] as const);
        if (quotesErr) console.error("Failed to fetch quotes count:", quotesErr);

        // Active contracts (not expired/cancelled)
        const { count: contractsCount, error: contractsErr } = await supabase
          .from("contracts")
          .select("id", { count: "exact" })
          .not("status", "eq", "expired")
          .neq("status", "cancelled");
        if (contractsErr) console.error("Failed to fetch contracts count:", contractsErr);

        // Documents generated
        const { count: docsCount, error: docsErr } = await supabase
          .from("auto_documents")
          .select("id", { count: "exact" });
        if (docsErr) console.error("Failed to fetch documents count:", docsErr);
        // Inventory value and Revenue MTD via server-side RPCs to reduce transferred rows
        const { data: invRpc, error: invErr } = await supabase.rpc("get_inventory_value");
        const inventoryValue = invErr ? 0 : Number(invRpc ?? 0);

        const start = new Date();
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        const end = new Date();
        end.setHours(23, 59, 59, 999);

        const { data: revRpc, error: revErr } = await supabase.rpc("get_revenue_mtd", {
          start_date: start.toISOString().split("T")[0],
          end_date: end.toISOString().split("T")[0],
        });

        const revenueMTD = revErr ? 0 : Number(revRpc ?? 0);

        // Recent activities (limit 6)
        const { data: activitiesData } = await supabase
          .from("activities")
          .select("subject, created_at, is_completed")
          .order("created_at", { ascending: false })
          .limit(6);

        // Update stats (preserve icons)
        setStats((prev) =>
          prev.map((s) => {
            switch (s.label) {
              case "Open Quotes":
                return { ...s, value: String(quotesCount ?? 0) };
              case "Active Contracts":
                return { ...s, value: String(contractsCount ?? 0) };
              case "Documents Generated":
                return { ...s, value: String(docsCount ?? 0) };
              case "Inventory Value":
                return { ...s, value: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(inventoryValue) };
              case "Revenue MTD":
                return { ...s, value: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(revenueMTD) };
              default:
                return s;
            }
          })
        );

        // Map recent activities
        if (activitiesData && Array.isArray(activitiesData)) {
          const mapped = activitiesData.map((a: any) => ({
            title: a.subject ?? "Activity",
            time: a.created_at ? new Date(a.created_at).toLocaleString() : "",
            status: a.is_completed ? "completed" : "pending",
          } as Activity));

          setRecentActivity(mapped);
        }
      } catch (err) {
        console.error("Failed to fetch dashboard data:", err);
      }    };

    fetchDashboard();
  }, [user]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("first_name, last_name, company")
          .eq("user_id", user.id)
          .maybeSingle();

        if (data) {
          setProfile(data);
        }
      }
    };

    fetchProfile();
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const firstName = profile?.first_name || user.user_metadata?.first_name || user.email?.split("@")[0] || "User";

  return (
    <div className="min-h-screen bg-background">
      {/* Replaced custom header with the shared Header component */}
      {/* <Header /> */}

      <main className="pt-16">
        {/* Welcome Section */}
        <section className="py-12 gradient-hero">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h1 className="text-3xl font-bold text-foreground mb-2">
                  Welcome back, {firstName}!
                </h1>
                <p className="text-muted-foreground">
                  Here's what's happening with your business today.
                </p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" size="sm">
                  <Bell className="w-4 h-4 mr-2" />
                  Notifications
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="hero" size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      Quick Action
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Quick Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {quickActions.map((action) => (
                      <DropdownMenuItem
                        key={action.title}
                        onClick={() => navigate(action.route)}
                        className="cursor-pointer"
                      >
                        <action.icon className="w-4 h-4 mr-2" />
                        <div className="flex flex-col">
                          <span className="font-medium">{action.title}</span>
                          <span className="text-xs text-muted-foreground">{action.description}</span>
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Grid */}
        <section className="py-8">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            {/* Updated grid to accommodate 5 items on large screens */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="p-6 rounded-xl bg-card border border-border shadow-card hover:shadow-card-hover transition-all"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <stat.icon className="w-6 h-6 text-primary" />
                    </div>
                    <span className="text-sm font-medium text-primary bg-primary/10 px-2 py-1 rounded-full">
                      {stat.change}
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-foreground mb-1">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Quick Actions & Activity */}
        <section className="py-8">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-3 gap-8">
              {/* Quick Actions */}
              <div className="lg:col-span-1">
                <h2 className="text-xl font-bold text-foreground mb-4">Quick Actions</h2>
                <div className="space-y-4">
                  {quickActions.map((action) => (
                    <button
                      key={action.title}
                      onClick={() => navigate(action.route)}
                      className="w-full p-4 rounded-xl bg-card border border-border hover:border-primary/30 hover:shadow-card-hover transition-all flex items-center gap-4 text-left group"
                    >
                      <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${action.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                        <action.icon className="w-6 h-6 text-primary-foreground" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-foreground">{action.title}</div>
                        <div className="text-sm text-muted-foreground">{action.description}</div>
                      </div>
                      <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Recent Activity */}
              <div className="lg:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-foreground">Recent Activity</h2>
                  <Link to="/dashboard/crm/activities">
                    <Button variant="ghost" size="sm">
                      View All
                    </Button>
                  </Link>
                </div>
                <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
                  {recentActivity.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <div>No recent activity. Start by creating a quote or contract!</div>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {recentActivity.map((activity, index) => (
                        <div
                          key={index}
                          className="p-4 hover:bg-secondary/50 transition-colors flex items-center gap-4"
                        >
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${activity.status === "completed"
                              ? "bg-primary/10"
                              : activity.status === "pending"
                                ? "bg-accent/10"
                                : "bg-chart-3/10"
                            }`}>
                            {activity.status === "completed" ? (
                              <CheckCircle2 className="w-5 h-5 text-primary" />
                            ) : activity.status === "pending" ? (
                              <Clock className="w-5 h-5 text-accent" />
                            ) : (
                              <AlertCircle className="w-5 h-5 text-chart-3" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-foreground">{activity.title}</div>
                            <div className="text-sm text-muted-foreground">{activity.time}</div>
                          </div>
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${activity.status === "completed"
                              ? "bg-primary/10 text-primary"
                              : activity.status === "pending"
                                ? "bg-accent/10 text-accent"
                                : "bg-chart-3/10 text-chart-3"
                            }`}>
                            {activity.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Module Cards */}
        <section className="py-8 pb-16">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-xl font-bold text-foreground mb-6">Your Modules</h2>
            {/* Updated grid to accommodate 5 modules */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
              <Link to="/dashboard/cpq" className="group p-6 rounded-xl bg-card border border-border hover:border-primary/30 hover:shadow-card-hover transition-all flex flex-col h-full">
                <div className="w-14 h-14 rounded-xl gradient-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Calculator className="w-7 h-7 text-primary-foreground" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">CPQ</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Configure products, set pricing rules, and generate professional quotes.
                </p>
                <span className="mt-auto text-primary font-medium text-sm flex items-center gap-1 group-hover:gap-2 transition-all">
                  Open Module <ArrowRight className="w-4 h-4" />
                </span>
              </Link>

              <Link to="/dashboard/clm" className="group p-6 rounded-xl bg-card border border-border hover:border-accent/30 hover:shadow-card-hover transition-all flex flex-col h-full">
                <div className="w-14 h-14 rounded-xl bg-accent flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <FileText className="w-7 h-7 text-accent-foreground" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">CLM</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Create, track, and manage contracts throughout their lifecycle.
                </p>
                <span className="mt-auto text-primary font-medium text-sm flex items-center gap-1 group-hover:gap-2 transition-all">
                  Open Module <ArrowRight className="w-4 h-4" />
                </span>
              </Link>

              <Link to="/dashboard/crm" className="group p-6 rounded-xl bg-card border border-border hover:border-chart-3/30 hover:shadow-card-hover transition-all flex flex-col h-full">
                <div className="w-14 h-14 rounded-xl bg-chart-3 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Users className="w-7 h-7 text-primary-foreground" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">CRM</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Manage leads, track opportunities, and build customer relationships.
                </p>
                <span className="mt-auto text-chart-3 font-medium text-sm flex items-center gap-1 group-hover:gap-2 transition-all">
                  Open Module <ArrowRight className="w-4 h-4" />
                </span>
              </Link>

              {/* Added ERP Module Card */}
              <Link to="/dashboard/erp" className="group p-6 rounded-xl bg-card border border-border hover:border-orange-500/30 hover:shadow-card-hover transition-all flex flex-col h-full">
                <div className="w-14 h-14 rounded-xl bg-orange-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Boxes className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">ERP</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Track inventory, manage resources, and oversee financials.
                </p>
                <span className="mt-auto text-orange-500 font-medium text-sm flex items-center gap-1 group-hover:gap-2 transition-all">
                  Open Module <ArrowRight className="w-4 h-4" />
                </span>
              </Link>

              <Link to="/dashboard/documents" className="group p-6 rounded-xl bg-card border border-border hover:border-chart-4/30 hover:shadow-card-hover transition-all flex flex-col h-full">
                <div className="w-14 h-14 rounded-xl bg-chart-4 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <FileStack className="w-7 h-7 text-primary-foreground" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">Document Automation</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Generate documents at scale with smart templates and automation.
                </p>
                <span className="mt-auto text-chart-4 font-medium text-sm flex items-center gap-1 group-hover:gap-2 transition-all">
                  Open Module <ArrowRight className="w-4 h-4" />
                </span>
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Dashboard;