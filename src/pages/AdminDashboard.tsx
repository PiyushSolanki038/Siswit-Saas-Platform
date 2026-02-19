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
import { AppRole } from "@/types/roles";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/layout/Header";

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
  id: string;
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  created_at: string;
  status: string;
}

interface UserRoleRow {
  user_id: string;
  role: string;
  approved: boolean;
  created_at: string;
}

interface SignupRequestRow {
  id: string;
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
  status: string;
}

interface ProfileRow {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
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
      const [
        totalUsersResult,
        activeEmployeesResult,
        rejectedRequestsResult,
        pendingRolesResult,
      ] = await Promise.all([
        supabase.from("user_roles").select("*", { count: "exact", head: true }),
        supabase
          .from("user_roles")
          .select("*", { count: "exact", head: true })
          .eq("role", AppRole.EMPLOYEE)
          .eq("approved", true),
        supabase
          .from("signup_requests")
          .select("*", { count: "exact", head: true })
          .eq("status", "rejected"),
        supabase
          .from("user_roles")
          .select("user_id, role, approved, created_at")
          .eq("role", AppRole.EMPLOYEE)
          .eq("approved", false),
      ]);

      if (totalUsersResult.error) throw totalUsersResult.error;
      if (activeEmployeesResult.error) throw activeEmployeesResult.error;
      if (rejectedRequestsResult.error) throw rejectedRequestsResult.error;
      if (pendingRolesResult.error) throw pendingRolesResult.error;

      const pendingRoles = (pendingRolesResult.data ?? []) as UserRoleRow[];
      const pendingUserIds = pendingRoles.map((row) => row.user_id);

      let requestRows: SignupRequestRow[] = [];
      let profileRows: ProfileRow[] = [];

      if (pendingUserIds.length > 0) {
        const [requestResult, profileResult] = await Promise.all([
          supabase
            .from("signup_requests")
            .select(
              "id, user_id, email, first_name, last_name, created_at, status",
            )
            .in("user_id", pendingUserIds),
          supabase
            .from("profiles")
            .select("user_id, first_name, last_name")
            .in("user_id", pendingUserIds),
        ]);

        if (requestResult.error) throw requestResult.error;
        if (profileResult.error) throw profileResult.error;

        requestRows = (requestResult.data ?? []) as SignupRequestRow[];
        profileRows = (profileResult.data ?? []) as ProfileRow[];
      }

      const profileByUser = new Map(
        profileRows.map((profile) => [profile.user_id, profile]),
      );

      const pendingRequestByUser = new Map(
        requestRows
          .filter((request) => request.status === "pending")
          .map((request) => [request.user_id, request]),
      );

      const pendingEmployees = pendingRoles
        .map((roleRow) => {
          const request = pendingRequestByUser.get(roleRow.user_id);
          if (!request) {
            return null;
          }

          const profile = profileByUser.get(roleRow.user_id);
          const firstName = request.first_name ?? profile?.first_name ?? "";
          const lastName = request.last_name ?? profile?.last_name ?? "";

          return {
            id: request.id,
            user_id: roleRow.user_id,
            email: request.email,
            first_name: firstName,
            last_name: lastName,
            created_at: request.created_at,
            status: request.status,
          };
        })
        .filter((value): value is PendingEmployee => value !== null)
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );

      setRequests(pendingEmployees);
      setStats({
        totalUsers: totalUsersResult.count ?? 0,
        pendingRequests: pendingEmployees.length,
        activeEmployees: activeEmployeesResult.count ?? 0,
        rejectedRequests: rejectedRequestsResult.count ?? 0,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to load admin dashboard data.";

      toast({
        variant: "destructive",
        title: "Error fetching data",
        description: message,
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleApprove = async (request: PendingEmployee) => {
    try {
      const { error } = await supabase.rpc("approve_employee", {
        p_user_id: request.user_id,
      });

      if (error) throw error;

      toast({
        title: "User Approved",
        description: `${request.email} granted employee access.`,
      });

      await fetchData();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Approval failed.";
      toast({ variant: "destructive", title: "Failed", description: message });
    }
  };

  const handleReject = async (request: PendingEmployee) => {
    if (!confirm(`Reject ${request.email}?`)) return;

    try {
      const { error } = await supabase.rpc("reject_employee", {
        p_user_id: request.user_id,
      });

      if (error) throw error;

      toast({
        title: "Request Rejected",
        description: `${request.email} remains blocked until approved.`,
      });

      await fetchData();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Rejection failed.";
      toast({ variant: "destructive", title: "Failed", description: message });
    }
  };

  const chartData = [
    { name: "Active", value: stats.activeEmployees },
    { name: "Pending", value: stats.pendingRequests },
    { name: "Rejected", value: stats.rejectedRequests },
  ];
  const CHART_COLORS = [
    "hsl(142, 71%, 45%)",
    "hsl(45, 93%, 47%)",
    "hsl(0, 72%, 50%)",
  ];

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
                  item.active
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground"
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
          <div className="p-4 border-t">
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-xs font-medium text-muted-foreground mb-1">
                System Status
              </p>
              <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
                <Activity className="h-4 w-4" />
                Operational
              </div>
            </div>
          </div>
        </aside>

        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                  Admin Dashboard
                </h1>
                <p className="text-muted-foreground">
                  Overview of employee access approvals and account status.
                </p>
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

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Users
                  </CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalUsers}</div>
                  <p className="text-xs text-muted-foreground">
                    Role rows in user_roles
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Active Employees
                  </CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats.activeEmployees}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    role=employee and approved=true
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Pending Requests
                  </CardTitle>
                  <Clock className="h-4 w-4 text-orange-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats.pendingRequests}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    role=employee, approved=false, pending request
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Rejected
                  </CardTitle>
                  <XCircle className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats.rejectedRequests}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Historical rejected requests
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-7">
              <Card className="col-span-7 lg:col-span-4">
                <CardHeader>
                  <CardTitle>Pending Employee Approvals</CardTitle>
                  <CardDescription>
                    Employees are blocked until role approval is granted.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="h-40 flex items-center justify-center text-muted-foreground">
                      Loading requests...
                    </div>
                  ) : requests.length === 0 ? (
                    <div className="h-40 flex flex-col items-center justify-center text-muted-foreground bg-muted/20 rounded-md">
                      <CheckCircle2 className="h-8 w-8 mb-2 text-green-500" />
                      <p>No pending employee approvals.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {requests.map((employee) => (
                        <div
                          key={employee.id}
                          className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="font-semibold text-primary">
                                {(
                                  employee.first_name?.[0] ||
                                  employee.email[0] ||
                                  "U"
                                ).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium">
                                {employee.first_name} {employee.last_name}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {employee.email}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => handleReject(employee)}
                            >
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleApprove(employee)}
                            >
                              Approve
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="col-span-7 lg:col-span-3">
                <CardHeader>
                  <CardTitle>User Status Distribution</CardTitle>
                  <CardDescription>
                    Employee approvals and request history overview.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          className="stroke-muted"
                          vertical={false}
                        />
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
                            borderRadius: "var(--radius)",
                          }}
                        />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {chartData.map((_, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={CHART_COLORS[index % CHART_COLORS.length]}
                            />
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
