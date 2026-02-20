import { useCallback, useEffect, useState } from "react";
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
  LayoutDashboard,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/layout/Header";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface PendingEmployee {
  request_id: string; // Matches 'request_id' alias in your SQL view
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
  const [requests, setRequests] = useState<PendingEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    pendingRequests: 0,
    activeEmployees: 0,
    rejectedRequests: 0,
  });
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Stats in parallel
      const [totalUsersRes, activeEmployeesRes, rejectedRequestsRes, pendingViewRes] =
        await Promise.all([
          supabase.from("user_roles").select("*", { count: "exact", head: true }),
          supabase
            .from("user_roles")
            .select("*", { count: "exact", head: true })
            .eq("role", "employee")
            .eq("approved", true),
          supabase
            .from("signup_requests")
            .select("*", { count: "exact", head: true })
            .eq("status", "rejected"),
          // 2. Fetch the joined data directly from your new VIEW
          supabase.from("admin_pending_approvals").select("*"),
        ]);

      if (pendingViewRes.error) throw pendingViewRes.error;

      const pendingData = (pendingViewRes.data as PendingEmployee[]) || [];

      setRequests(pendingData);
      setStats({
        totalUsers: totalUsersRes.count ?? 0,
        pendingRequests: pendingData.length,
        activeEmployees: activeEmployeesRes.count ?? 0,
        rejectedRequests: rejectedRequestsRes.count ?? 0,
      });

    } catch (error: any) {
      console.error("error in fetchData", error);
      toast({
        variant: "destructive",
        title: "Error fetching data",
        description: error.message || "Unable to load admin dashboard data.",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApprove = async (request: PendingEmployee) => {
    try {
      // Update role to approved
      const { error: roleError } = await supabase
        .from("user_roles")
        .update({ approved: true })
        .eq("user_id", request.user_id)
        .eq("role", "employee");

      if (roleError) throw roleError;

      // Update signup request status
      const { error: requestError } = await supabase
        .from("signup_requests")
        .update({ status: "approved" })
        .eq("user_id", request.user_id);

      if (requestError) throw requestError;

      toast({
        title: "User Approved",
        description: `${request.email} granted employee access.`,
      });

      fetchData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Failed", description: error.message });
    }
  };

  const handleReject = async (request: PendingEmployee) => {
    if (!confirm(`Reject ${request.email}?`)) return;

    try {
      await Promise.all([
        supabase
          .from("signup_requests")
          .update({ status: "rejected" })
          .eq("user_id", request.user_id),
        supabase
          .from("user_roles")
          .delete()
          .eq("user_id", request.user_id)
          .eq("role", "employee"),
      ]);

      toast({ title: "Request Rejected", description: `${request.email} request rejected.` });
      fetchData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Failed", description: error.message });
    }
  };

  const chartData = [
    { name: "Active", value: stats.activeEmployees },
    { name: "Pending", value: stats.pendingRequests },
    { name: "Rejected", value: stats.rejectedRequests },
  ];

  const CHART_COLORS = ["#22c55e", "#f59e0b", "#ef4444"];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <div className="flex flex-1 pt-16 lg:pt-20">
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
                className={`w-full justify-start gap-3 ${
                  item.active ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground"
                }`}
                asChild
              >
                <Link to={item.href}>
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              </Button>
            ))}
          </nav>
        </aside>

        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Admin Dashboard</h1>
                <p className="text-muted-foreground">Overview of employee access and system health.</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatCard title="Total Users" value={stats.totalUsers} icon={Users} desc="Registered" />
              <StatCard title="Active Employees" value={stats.activeEmployees} icon={CheckCircle2} desc="Approved" color="text-green-600" />
              <StatCard title="Pending" value={stats.pendingRequests} icon={Clock} desc="Reviewing" color="text-orange-500" />
              <StatCard title="Rejected" value={stats.rejectedRequests} icon={XCircle} desc="Denied" color="text-red-500" />
            </div>

            <div className="grid gap-4 md:grid-cols-7">
              <Card className="col-span-7 lg:col-span-4">
                <CardHeader><CardTitle>Pending Employee Approvals</CardTitle></CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="h-40 flex items-center justify-center">Loading view...</div>
                  ) : requests.length === 0 ? (
                    <div className="h-40 flex flex-col items-center justify-center text-muted-foreground bg-muted/20 rounded-md">
                      <CheckCircle2 className="h-8 w-8 mb-2 text-green-500" />
                      <p>All clear! No pending requests found in view.</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {requests.map((emp) => (
                          <TableRow key={emp.user_id}>
                            <TableCell className="font-medium">{emp.first_name} {emp.last_name}</TableCell>
                            <TableCell>{emp.email}</TableCell>
                            <TableCell>
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                {emp.status}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleReject(emp)}>Reject</Button>
                                <Button size="sm" onClick={() => handleApprove(emp)}>Approve</Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              <Card className="col-span-7 lg:col-span-3">
                <CardHeader><CardTitle>Distribution</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} />
                        <YAxis axisLine={false} tickLine={false} />
                        <RechartsTooltip cursor={{ fill: "hsl(var(--muted)/0.4)" }} />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {chartData.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i]} />
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

function StatCard({ title, value, icon: Icon, desc, color }: any) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${color || "text-muted-foreground"}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </CardContent>
    </Card>
  );
}