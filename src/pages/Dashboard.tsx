"use client";

import { useEffect, useState, ComponentType } from "react";
import { useNavigate, Link } from "react-router-dom";
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
import { useToast } from "@/hooks/use-toast";
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

/* --- CONFIGURATION --- */

const DASHBOARD_ROUTES = {
  NEW_QUOTE: "/dashboard/cpq/quotes/new",
  NEW_CONTRACT: "/dashboard/clm/contracts",
  CREATE_DOC: "/dashboard/documents/create",
  INVENTORY: "/dashboard/erp/inventory",
  CONTACTS: "/dashboard/crm/contacts",
  ACTIVITIES: "/dashboard/crm/activities",
} as const;

/* --- TYPES --- */

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
    route: DASHBOARD_ROUTES.NEW_QUOTE,
  },
  {
    icon: FileText,
    title: "New Contract",
    description: "Draft a new contract",
    color: "from-accent to-accent/60",
    route: DASHBOARD_ROUTES.NEW_CONTRACT,
  },
  {
    icon: FileStack,
    title: "Create Document",
    description: "Generate a new document",
    color: "from-chart-4 to-chart-4/60",
    route: DASHBOARD_ROUTES.CREATE_DOC,
  },
  {
    icon: Boxes,
    title: "Update Inventory",
    description: "Manage stock levels",
    color: "from-orange-500 to-orange-500/60",
    route: DASHBOARD_ROUTES.INVENTORY,
  },
  {
    icon: Users,
    title: "Add Contact",
    description: "Add a new customer",
    color: "from-chart-3 to-chart-3/60",
    route: DASHBOARD_ROUTES.CONTACTS,
  },
];

const Dashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [stats, setStats] = useState<Stat[]>([
    { label: "Open Quotes", value: "0", change: "+0%", icon: Calculator },
    { label: "Active Contracts", value: "0", change: "+0%", icon: FileText },
    { label: "Documents Generated", value: "0", change: "+0%", icon: FileStack },
    { label: "Inventory Value", value: "$0", change: "+0%", icon: Boxes },
    { label: "Revenue MTD", value: "$0", change: "+0%", icon: TrendingUp },
  ]);
  const [recentActivity, setRecentActivity] = useState<Activity[]>([]);

  useEffect(() => {
    const initializeDashboard = async () => {
      if (!user) return;
      setDataLoading(true);

      try {
        const [
          profileRes,
          quotesRes,
          contractsRes,
          docsRes,
          invRes,
          revRes,
          activitiesRes,
        ] = await Promise.all([
          supabase
            .from("profiles")
            .select("first_name, last_name, company")
            .eq("user_id", user.id)
            .maybeSingle(),
          supabase
            .from("quotes")
            .select("id", { count: "exact" })
            .in("status", ["draft", "pending_approval"]),
          supabase
            .from("contracts")
            .select("id", { count: "exact" })
            .not("status", "eq", "expired")
            .neq("status", "cancelled"),
          supabase.from("auto_documents").select("id", { count: "exact" }),
          supabase.rpc("get_inventory_value"),
          supabase.rpc("get_revenue_mtd", {
            start_date: new Date(
              new Date().getFullYear(),
              new Date().getMonth(),
              1
            )
              .toISOString()
              .split("T")[0],
            end_date: new Date().toISOString().split("T")[0],
          }),
          supabase
            .from("activities")
            .select("subject, created_at, is_completed")
            .order("created_at", { ascending: false })
            .limit(6),
        ]);

        if (profileRes.data) setProfile(profileRes.data);

        const inventoryValue = Number(invRes.data ?? 0);
        const revenueMTD = Number(revRes.data ?? 0);

        setStats((prev) =>
          prev.map((s) => {
            switch (s.label) {
              case "Open Quotes":
                return { ...s, value: String(quotesRes.count ?? 0) };
              case "Active Contracts":
                return { ...s, value: String(contractsRes.count ?? 0) };
              case "Documents Generated":
                return { ...s, value: String(docsRes.count ?? 0) };
              case "Inventory Value":
                return {
                  ...s,
                  value: `$${inventoryValue.toLocaleString()}`,
                };
              case "Revenue MTD":
                return {
                  ...s,
                  value: `$${revenueMTD.toLocaleString()}`,
                };
              default:
                return s;
            }
          })
        );

        if (activitiesRes.data) {
          setRecentActivity(
            activitiesRes.data.map((a) => ({
              title: a.subject,
              time: a.created_at
                ? new Date(a.created_at).toLocaleString()
                : "Unknown",
              status: a.is_completed ? "completed" : "pending",
            }))
          );
        }
      } catch (err) {
        toast({
          title: "Dashboard error",
          description: "We couldn't refresh your latest business data.",
          variant: "destructive",
        });
      } finally {
        setDataLoading(false);
      }
    };

    initializeDashboard();
  }, [user, toast]);

  if (authLoading || (dataLoading && !profile)) {
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
      <main className="pt-16 space-y-8">

        {/* HERO */}
        <section className="container mx-auto px-4 md:px-6">
          <div className="rounded-2xl p-5 md:p-8 bg-gradient-to-br from-primary/10 to-background border border-border flex flex-col md:flex-row justify-between gap-5">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">
                Welcome back, {firstName} 👋
              </h1>
              <p className="text-muted-foreground mt-1 text-sm md:text-base">
                Here's what's happening in your business today.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
              <Button variant="outline" size="sm" className="w-full sm:w-auto">
                <Bell className="w-4 h-4 mr-2" />
                Alerts
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="w-full sm:w-auto">
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

        {/* STATS */}
        <section className="container mx-auto px-4 md:px-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 md:gap-6">
          {stats.map((s) => (
            <div
              key={s.label}
              className="p-4 md:p-5 rounded-xl bg-card border shadow-sm hover:shadow-md transition"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <s.icon className="w-5 h-5 text-primary" />
                </div>
                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                  {s.change}
                </span>
              </div>

              <div className="text-xl md:text-2xl font-bold">{s.value}</div>
              <div className="text-xs md:text-sm text-muted-foreground">
                {s.label}
              </div>
            </div>
          ))}
        </section>

        {/* ACTIONS + ACTIVITY */}
        <section className="container mx-auto px-4 md:px-6 grid lg:grid-cols-3 gap-6 md:gap-8">

          {/* QUICK ACTIONS */}
          <div className="space-y-3">
            <h2 className="text-lg md:text-xl font-semibold">Quick Actions</h2>

            {quickActions.map((a) => (
              <button
                key={a.title}
                onClick={() => navigate(a.route)}
                className="w-full p-3 md:p-4 rounded-xl border bg-card flex items-center gap-3 hover:shadow-md transition group"
              >
                <div
                  className={`w-10 h-10 md:w-11 md:h-11 rounded-lg bg-gradient-to-br ${a.color} flex items-center justify-center`}
                >
                  <a.icon className="w-4 h-4 text-white" />
                </div>

                <div className="text-left flex-1">
                  <div className="font-semibold text-sm md:text-base">
                    {a.title}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {a.description}
                  </div>
                </div>

                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
              </button>
            ))}
          </div>

          {/* RECENT ACTIVITY */}
          <div className="lg:col-span-2 bg-card border rounded-xl p-4 md:p-6">
            <div className="flex justify-between mb-4">
              <h2 className="text-lg md:text-xl font-semibold">
                Recent Activity
              </h2>
              <Link to={DASHBOARD_ROUTES.ACTIVITIES}>
                <Button size="sm" variant="ghost">
                  View All
                </Button>
              </Link>
            </div>

            {recentActivity.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No recent activity yet 🚀
              </div>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((a, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 md:gap-3 border-b pb-2 last:border-0"
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
    </div>
  );
};

export default Dashboard;