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
  Calculator,
  FileText,
  Users,
  TrendingUp,
  Bell,
  Plus,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileStack,
  Boxes,
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
  {
    icon: Calculator,
    title: "Create Quote",
    description: "Start a new CPQ quote",
    color: "from-primary to-primary/60",
    route: "/dashboard/cpq/quotes/new",
  },
  {
    icon: FileText,
    title: "New Contract",
    description: "Draft a new contract",
    color: "from-accent to-accent/60",
    route: "/dashboard/clm/contracts",
  },
  {
    icon: FileStack,
    title: "Create Document",
    description: "Generate a new document",
    color: "from-chart-4 to-chart-4/60",
    route: "/dashboard/documents/create",
  },
  {
    icon: Boxes,
    title: "Update Inventory",
    description: "Manage stock levels",
    color: "from-orange-500 to-orange-500/60",
    route: "/dashboard/erp/inventory",
  },
  {
    icon: Users,
    title: "Add Contact",
    description: "Add a new customer",
    color: "from-chart-3 to-chart-3/60",
    route: "/dashboard/crm/contacts",
  },
];

const Dashboard = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);

  const [stats, setStats] = useState<Stat[]>([
    { label: "Open Quotes", value: "0", change: "+0%", icon: Calculator },
    { label: "Active Contracts", value: "0", change: "+0%", icon: FileText },
    {
      label: "Documents Generated",
      value: "0",
      change: "+0%",
      icon: FileStack,
    },
    { label: "Inventory Value", value: "$0", change: "+0%", icon: Boxes },
    { label: "Revenue MTD", value: "$0", change: "+0%", icon: TrendingUp },
  ]);

  const [recentActivity, setRecentActivity] = useState<Activity[]>([]);

  useEffect(() => {
    const fetchDashboard = async () => {
      if (!user) return;

      try {
        const { count: quotesCount } = await supabase
          .from("quotes")
          .select("id", { count: "exact" })
          .in("status", ["draft", "pending_approval"] as const);

        const { count: contractsCount } = await supabase
          .from("contracts")
          .select("id", { count: "exact" })
          .not("status", "eq", "expired")
          .neq("status", "cancelled");

        const { count: docsCount } = await supabase
          .from("auto_documents")
          .select("id", { count: "exact" });

        const { data: invRpc } = await supabase.rpc("get_inventory_value");
        const inventoryValue = Number(invRpc ?? 0);

        const start = new Date();
        start.setDate(1);
        const end = new Date();

        const { data: revRpc } = await supabase.rpc("get_revenue_mtd", {
          start_date: start.toISOString().split("T")[0],
          end_date: end.toISOString().split("T")[0],
        });

        const revenueMTD = Number(revRpc ?? 0);

        const { data: activitiesData } = await supabase
          .from("activities")
          .select("subject, created_at, is_completed")
          .order("created_at", { ascending: false })
          .limit(6);

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
                return { ...s, value: `$${inventoryValue.toLocaleString()}` };
              case "Revenue MTD":
                return { ...s, value: `$${revenueMTD.toLocaleString()}` };
              default:
                return s;
            }
          }),
        );

        if (activitiesData) {
          setRecentActivity(
            activitiesData.map((a: any) => ({
              title: a.subject,
              time: new Date(a.created_at).toLocaleString(),
              status: a.is_completed ? "completed" : "pending",
            })),
          );
        }
      } catch (err) {
        console.error(err);
      }
    };

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

        if (data) setProfile(data);
      }
    };
    fetchProfile();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin w-8 h-8 text-primary" />
      </div>
    );
  }

  if (!user) return null;

  const firstName =
    profile?.first_name ||
    user.user_metadata?.first_name ||
    user.email?.split("@")[0] ||
    "User";

  return (
    <div className="min-h-screen bg-background">
      <main className="pt-16 space-y-10">
        {/* 🔥 HERO */}
        <section className="container mx-auto px-6">
          <div className="rounded-2xl p-8 bg-gradient-to-br from-primary/10 to-background border border-border flex flex-col md:flex-row justify-between gap-6">
            <div>
              <h1 className="text-3xl font-bold">
                Welcome back, {firstName} 👋
              </h1>
              <p className="text-muted-foreground mt-1">
                Here's what's happening in your business today.
              </p>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" size="sm">
                <Bell className="w-4 h-4 mr-2" />
                Alerts
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="default" size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Quick Action
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Quick Actions</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {quickActions.map((a) => (
                    <DropdownMenuItem
                      key={a.title}
                      onClick={() => navigate(a.route)}
                    >
                      <a.icon className="w-4 h-4 mr-2" />
                      {a.title}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </section>

        {/* 📊 STATS */}
        <section className="container mx-auto px-6 grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {stats.map((s) => (
            <div
              key={s.label}
              className="p-5 rounded-xl bg-card border shadow-sm hover:shadow-md transition"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="p-3 rounded-lg bg-primary/10">
                  <s.icon className="w-5 h-5 text-primary" />
                </div>
                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full flex items-center justify-center">
                  {s.change}
                </span>
              </div>
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-sm text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </section>

        {/* ⚡ ACTION + ACTIVITY */}
        <section className="container mx-auto px-6 grid lg:grid-cols-3 gap-8">
          {/* Quick Actions */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Quick Actions</h2>
            {quickActions.map((a) => (
              <button
                key={a.title}
                onClick={() => navigate(a.route)}
                className="w-full p-4 rounded-xl border bg-card flex items-center gap-4 hover:shadow-md transition group"
              >
                <div
                  className={`w-11 h-11 rounded-lg bg-gradient-to-br ${a.color} flex items-center justify-center`}
                >
                  <a.icon className="w-5 h-5 text-white" />
                </div>
                <div className="text-left flex-1">
                  <div className="font-semibold">{a.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {a.description}
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
              </button>
            ))}
          </div>

          {/* Activity */}
          <div className="lg:col-span-2 bg-card border rounded-xl p-6">
            <div className="flex justify-between mb-4">
              <h2 className="text-xl font-semibold">Recent Activity</h2>
              <Link to="/dashboard/crm/activities">
                <Button size="sm" variant="ghost">
                  View All
                </Button>
              </Link>
            </div>

            {recentActivity.length === 0 ? (
              <div className="text-center text-muted-foreground py-10">
                No recent activity yet 🚀
              </div>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((a, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 border-b pb-3"
                  >
                    {a.status === "completed" ? (
                      <CheckCircle2 className="text-primary w-5 h-5" />
                    ) : a.status === "pending" ? (
                      <Clock className="text-accent w-5 h-5" />
                    ) : (
                      <AlertCircle className="text-red-500 w-5 h-5" />
                    )}
                    <div className="flex-1">
                      <div className="font-medium">{a.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {a.time}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
      {/* <Footer /> */}
    </div>
  );
};

export default Dashboard;
