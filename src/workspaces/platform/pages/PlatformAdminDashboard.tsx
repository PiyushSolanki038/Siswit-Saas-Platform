import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  Building2,
  CreditCard,
  TrendingUp,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/shadcn/card";
import { Button } from "@/ui/shadcn/button";

import { usePlatformDashboard } from "../hooks/usePlatformDashboard";
import { Loader2 } from "lucide-react";

export default function PlatformAdminDashboard() {
  const { data, isLoading } = usePlatformDashboard();

  if (isLoading || !data) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const { stats: platformStats, recentTenants } = data;

  const stats = [
    {
      title: "Total Tenants",
      value: platformStats.totalTenants.toString(),
      change: "Live",
      icon: Building2,
      href: "/platform/tenants",
    },
    {
      title: "Total Users",
      value: platformStats.totalUsers.toString(),
      change: "Live",
      icon: Users,
      href: "/platform/users",
    },
    {
      title: "MRR",
      value: `$${platformStats.mrr.toLocaleString()}`,
      change: "Current Month",
      icon: TrendingUp,
      href: "/platform/billing",
    },
    {
      title: "Active Sessions",
      value: platformStats.activeSessions.toString(),
      change: "Current",
      icon: Activity,
      href: "/platform/users",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Platform Dashboard</h1>
        <p className="text-muted-foreground">Overview of your SaaS platform</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="mt-1 text-xs text-muted-foreground">{stat.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Tenants</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/platform/tenants">
                View All <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentTenants.map((tenant) => (
                <div
                  key={tenant.name}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium">{tenant.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {tenant.plan} - {tenant.users} users
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className={`rounded-full px-2 py-1 text-xs ${
                        tenant.status === "active"
                          ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                          : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                      }`}
                    >
                      {tenant.status}
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/${tenant.slug}/app/dashboard`}>Impersonate</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link to="/platform/tenants">
                <Building2 className="mr-2 h-4 w-4" />
                Create New Tenant
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link to="/platform/billing">
                <CreditCard className="mr-2 h-4 w-4" />
                View Billing
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link to="/platform/settings">
                <Users className="mr-2 h-4 w-4" />
                Manage Platform Settings
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link to="/platform/audit-logs">
                <Activity className="mr-2 h-4 w-4" />
                Review Audit Logs
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
