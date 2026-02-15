import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { 
  Users, 
  Shield, 
  Settings, 
  FileText, 
  Activity, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Search,
  LayoutDashboard
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppRole } from "@/types/roles";

// UI Components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/layout/Header"; // Adjust path to where your Header is

// Charts
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from "recharts";

// --- Types ---
interface SignupRequest {
  id: string;
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  created_at: string;
  status: string;
}

interface AdminStats {
  totalUsers: number;
  pendingRequests: number;
  activeEmployees: number;
  rejectedRequests: number;
}

const SIDEBAR_ITEMS = [
  { name: "Overview", icon: LayoutDashboard, href: "/admin", active: true },
  { name: "User Management", icon: Users, href: "/admin/users", active: false },
  { name: "Audit Logs", icon: FileText, href: "/admin/logs", active: false },
  { name: "Settings", icon: Settings, href: "/admin/settings", active: false },
];

export default function AdminDashboard() {
  const [requests, setRequests] = useState<SignupRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    pendingRequests: 0,
    activeEmployees: 0,
    rejectedRequests: 0
  });
  const { toast } = useToast();

  // --- Fetch Data ---
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Pending Requests
      const { data: requestsData, error: reqError } = await supabase
        .from("signup_requests" as any)
        .select("*")
        .eq('status', 'pending')
        .order("created_at", { ascending: false });

      if (reqError) throw reqError;
      const validRequests = (requestsData as unknown as SignupRequest[]) || [];
      setRequests(validRequests);

      // 2. Fetch Stats (Simulated counts for demo if tables are empty)
      // In a real app, you'd perform a count query on your tables
      const { count: employeeCount } = await supabase
        .from("user_roles")
        .select("*", { count: 'exact', head: true })
        .eq('role', 'employee');

      setStats({
        totalUsers: (employeeCount || 0) + validRequests.length,
        pendingRequests: validRequests.length,
        activeEmployees: employeeCount || 0,
        rejectedRequests: 0
      });

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error fetching data",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- Handlers ---
  const handleApprove = async (request: SignupRequest) => {
    try {
      const { error: roleError } = await supabase.from("user_roles").insert({
        user_id: request.user_id,
        role: AppRole.EMPLOYEE,
      });
      if (roleError) throw roleError;

      const { error: deleteError } = await supabase
        .from("signup_requests" as any)
        .delete()
        .eq("id", request.id);

      if (deleteError) console.error("Cleanup failed", deleteError);

      toast({ title: "User Approved", description: `${request.email} granted access.` });
      setRequests((prev) => prev.filter((r) => r.id !== request.id));
      setStats(prev => ({ ...prev, pendingRequests: prev.pendingRequests - 1, activeEmployees: prev.activeEmployees + 1 }));
    } catch (error: any) {
      toast({ variant: "destructive", title: "Failed", description: error.message });
    }
  };

  const handleReject = async (request: SignupRequest) => {
    if (!confirm(`Reject ${request.email}?`)) return;
    try {
      const { error } = await supabase
        .from("signup_requests" as any)
        .delete()
        .eq("id", request.id);

      if (error) throw error;
      toast({ title: "Rejected", description: "Request removed." });
      setRequests((prev) => prev.filter((r) => r.id !== request.id));
      setStats(prev => ({ ...prev, pendingRequests: prev.pendingRequests - 1, rejectedRequests: prev.rejectedRequests + 1 }));
    } catch (error: any) {
      toast({ variant: "destructive", title: "Failed", description: error.message });
    }
  };

  // Chart data for displaying user statistics
  const chartData = [
    { name: "Active", value: stats.activeEmployees },
    { name: "Pending", value: stats.pendingRequests },
    { name: "Rejected", value: stats.rejectedRequests },
  ];
  const CHART_COLORS = ["hsl(142, 71%, 45%)", "hsl(45, 93%, 47%)", "hsl(0, 72%, 50%)"];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* 1. HEADER */}
      <Header />

      <div className="flex flex-1 pt-16 lg:pt-20">
        
        {/* 2. ADMIN SIDEBAR (Hidden on mobile) */}
        <aside className="hidden lg:flex w-64 flex-col border-r bg-card h-[calc(100vh-5rem)] sticky top-20">
          <div className="p-6">
            <h2 className="text-lg font-semibold tracking-tight text-foreground/80 flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Admin Controls
            </h2>
          </div>
          <nav className="flex-1 px-4 space-y-2">
            {SIDEBAR_ITEMS.map((item) => (
              <Button
                key={item.name}
                variant={item.active ? "secondary" : "ghost"}
                className={`w-full justify-start gap-3 ${item.active ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground"}`}
                asChild
              >
                <Link to={item.href}>
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              </Button>
            ))}
          </nav>
          <div className="p-4 border-t">
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-xs font-medium text-muted-foreground mb-1">System Status</p>
              <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
                <Activity className="h-4 w-4" />
                Operational
              </div>
            </div>
          </div>
        </aside>

        {/* 3. MAIN CONTENT */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto space-y-6">
            
            {/* Title Section */}
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Admin Dashboard</h1>
                <p className="text-muted-foreground">Overview of system access and user management.</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    type="search" 
                    placeholder="Search users..." 
                    className="pl-8 w-[200px] lg:w-[300px]" 
                  />
                </div>
                <Button>
                  <Users className="mr-2 h-4 w-4" />
                  Add User
                </Button>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalUsers}</div>
                  <p className="text-xs text-muted-foreground">+20.1% from last month</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Employees</CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.activeEmployees}</div>
                  <p className="text-xs text-muted-foreground">Currently authenticated</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
                  <Clock className="h-4 w-4 text-orange-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.pendingRequests}</div>
                  <p className="text-xs text-muted-foreground">Requires attention</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Rejected</CardTitle>
                  <XCircle className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.rejectedRequests}</div>
                  <p className="text-xs text-muted-foreground">Blocked signups</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-7">
              {/* Table Section (Span 4) */}
              <Card className="col-span-7 lg:col-span-4">
                <CardHeader>
                  <CardTitle>Signup Requests</CardTitle>
                  <CardDescription>
                    Recent users requesting access to the platform.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="h-40 flex items-center justify-center text-muted-foreground">Loading requests...</div>
                  ) : requests.length === 0 ? (
                    <div className="h-40 flex flex-col items-center justify-center text-muted-foreground bg-muted/20 rounded-md">
                      <CheckCircle2 className="h-8 w-8 mb-2 text-green-500" />
                      <p>All requests handled!</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {requests.map((user) => (
                        <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="font-semibold text-primary">{user.first_name?.[0] || user.email[0].toUpperCase()}</span>
                            </div>
                            <div>
                              <p className="font-medium">{user.first_name} {user.last_name}</p>
                              <p className="text-sm text-muted-foreground">{user.email}</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive/10" onClick={() => handleReject(user)}>
                              Reject
                            </Button>
                            <Button size="sm" onClick={() => handleApprove(user)}>
                              Approve
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Chart Section (Span 3)  */}
              <Card className="col-span-7 lg:col-span-3">
                <CardHeader>
                  <CardTitle>User Status Distribution</CardTitle>
                  <CardDescription>Overview of user roles and request status.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                        <XAxis 
                          dataKey="name" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: "hsl(var(--muted-foreground))" }} 
                          dy={10}
                        />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: "hsl(var(--muted-foreground))" }} 
                        />
                        <RechartsTooltip 
                          cursor={{ fill: "hsl(var(--muted)/0.4)" }}
                          contentStyle={{ 
                            backgroundColor: "hsl(var(--card))", 
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "var(--radius)"
                          }} 
                        />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {chartData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}