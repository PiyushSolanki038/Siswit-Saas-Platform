import { useMemo } from "react";
import {
  BarChart,
  Bar,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CalendarDays,
  Clock3,
  MoreHorizontal,
  Search,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { format, subDays, isAfter } from "date-fns";
import { useAuth } from "../../../core/auth/useAuth";
import { useTenant } from "../../../core/tenant/useTenant";
import { cn } from "../../../core/utils/utils";
import { Badge } from "../../../ui/shadcn/badge";
import { Button } from "../../../ui/shadcn/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../ui/shadcn/card";
import { Input } from "../../../ui/shadcn/input";
import { Progress } from "../../../ui/shadcn/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../ui/shadcn/table";
import { useOrganizationDashboard } from "../hooks/useOrganizationDashboard";

interface KPIItem {
  label: string;
  value: string | number;
  delta: string;
  positive: boolean;
  emphasis?: boolean;
}

interface DashboardItem {
  id?: string;
  name?: string;
  created_at?: string;
  status?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  company?: string;
  action?: string;
  entity_type?: string;
  user_id?: string;
  amount?: number;
  close_date?: string;
  total_value?: number;
  end_date?: string;
  start_time?: string;
  type?: string;
  subject?: string;
  stage?: string;
}

const applicantTabs = ["All Leads", "New", "Contacted", "Qualified", "Lost"];

export default function OrganizationAdminDashboard() {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { data: dashboardData, isLoading } = useOrganizationDashboard();

  const userName = useMemo(() => {
    const firstName = String(user?.user_metadata?.first_name ?? "").trim();
    const lastName = String(user?.user_metadata?.last_name ?? "").trim();
    const fullName = `${firstName} ${lastName}`.trim();
    if (fullName) return fullName;
    return user?.email?.split("@")[0] ?? "Admin";
  }, [user?.email, user?.user_metadata]);

  const orgName = tenant?.company_name || tenant?.name || "Your Workspace";
  const userInitial = userName.charAt(0).toUpperCase();

  // Process Bar Chart (last 7 days of items created)
  const barChartData = useMemo(() => {
    const days = Array.from({ length: 7 }).map((_, i) => {
      const d = subDays(new Date(), 6 - i);
      return {
        dateObj: d,
        name: format(d, "dd MMM"),
        leads: 0,
        contracts: 0,
        quotes: 0
      };
    });

    if (!dashboardData?.charts) return days;
    const sevenDaysAgo = subDays(new Date(), 7);

    // Count Leads
    dashboardData.charts.leads?.forEach((lead: DashboardItem) => {
      if (!lead.created_at) return;
      const d = new Date(lead.created_at);
      if (isAfter(d, sevenDaysAgo)) {
        const dayStr = format(d, "dd MMM");
        const entry = days.find(x => x.name === dayStr);
        if (entry) entry.leads += 1;
      }
    });

    // Count Contracts
    dashboardData.charts.contracts?.forEach((contract: DashboardItem) => {
      if (!contract.created_at) return;
      const d = new Date(contract.created_at);
      if (isAfter(d, sevenDaysAgo)) {
        const dayStr = format(d, "dd MMM");
        const entry = days.find(x => x.name === dayStr);
        if (entry) entry.contracts += 1;
      }
    });

    return days;
  }, [dashboardData?.charts]);

  // Process Leads Status (Donut Chart)
  const leadsStatusData = useMemo(() => {
    const statuses: Record<string, number> = {};
    if (!dashboardData?.charts) return [{ name: "No Leads", value: 1, color: "hsl(var(--muted))" }];

    dashboardData.charts.leads?.forEach((lead: DashboardItem) => {
      const st = lead.status || "New";
      statuses[st] = (statuses[st] || 0) + 1;
    });

    const colors = [
      "hsl(var(--primary))",
      "hsl(var(--chart-2))",
      "hsl(var(--chart-3))",
      "hsl(var(--chart-4))",
      "hsl(var(--chart-5))"
    ];

    const result = Object.entries(statuses)
      .map(([name, value], i) => ({
        name,
        value,
        color: colors[i % colors.length]
      }))
      .sort((a, b) => b.value - a.value);

    return result.length > 0 ? result : [{ name: "No Leads", value: 1, color: "hsl(var(--muted))" }];
  }, [dashboardData?.charts]);

  // Loading state
  if (isLoading || !dashboardData) {
    return (
      <div className="flex h-full min-h-[500px] items-center justify-center">
        <p className="text-muted-foreground animate-pulse">Loading dashboard data...</p>
      </div>
    );
  }

  const { kpis, lists, charts } = dashboardData;

  const kpiItems: KPIItem[] = [
    { label: "Total Leads", value: kpis.leads, delta: "+12.7%", positive: true, emphasis: true },
    { label: "Active Contracts", value: kpis.contracts, delta: "+5.2%", positive: true },
    { label: "Pending Quotes", value: kpis.quotes, delta: "-1.9%", positive: false },
    { label: "Purchase Orders", value: kpis.orders, delta: "+8.3%", positive: true },
  ];

  // Process Pie Chart (Records by Module)
  const moduleData = [
    { name: "CRM (Leads)", value: kpis.leads || 0, color: "hsl(var(--primary))" },
    { name: "CLM (Contracts)", value: kpis.contracts || 0, color: "hsl(var(--chart-2))" },
    { name: "CPQ (Quotes)", value: kpis.quotes || 0, color: "hsl(var(--chart-3))" },
    { name: "ERP (Orders)", value: kpis.orders || 0, color: "hsl(var(--chart-4))" },
  ].filter(x => x.value > 0);

  // Fallback if no records at all
  if (moduleData.length === 0) {
    moduleData.push({ name: "No data yet", value: 1, color: "hsl(var(--muted))" });
  }

  const moduleTotal = moduleData.reduce((sum, item) => sum + (item.name === "No data yet" ? 0 : item.value), 0);
  const leadTotal = charts.leads?.length || 0;

  return (
    <div className="space-y-4 lg:space-y-5">
      <section className="rounded-2xl border border-border/70 bg-card/85 p-4 shadow-sm md:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Organization overview for {orgName}.
            </p>
          </div>

          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-[300px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search leads, contracts, etc."
                className="h-10 rounded-xl border-border/70 bg-background pl-9"
              />
            </div>
            <Button variant="outline" size="sm" className="h-10 rounded-xl">
              <CalendarDays className="mr-2 h-4 w-4" />
              Today
            </Button>
            <div className="inline-flex h-10 min-w-10 items-center justify-center rounded-xl bg-primary/15 px-3 text-sm font-semibold text-primary">
              {userInitial || "A"}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-9">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {kpiItems.map((item) => (
              <Card
                key={item.label}
                className={cn(
                  "border-border/70 shadow-sm",
                  item.emphasis && "border-primary/40 bg-primary/15",
                )}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{item.label}</CardTitle>
                  <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-semibold leading-tight">{item.value.toLocaleString()}</p>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "mt-3 border-0 bg-background/80 px-2 py-0.5 text-[11px] font-medium",
                      item.positive ? "text-primary" : "text-destructive",
                    )}
                  >
                    {item.positive ? <TrendingUp className="mr-1 h-3 w-3" /> : <TrendingDown className="mr-1 h-3 w-3" />}
                    {item.delta}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-border/70 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
                <CardTitle className="text-lg">New Items Over Time</CardTitle>
                <Button variant="ghost" size="sm" className="h-8 rounded-lg px-2 text-xs text-muted-foreground">
                  <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
                  Last 7 Days
                </Button>
              </CardHeader>
              <CardContent className="h-[250px] pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData} barGap={10}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--muted) / 0.35)" }}
                      contentStyle={{ borderRadius: "0.75rem", border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--card))" }}
                      labelStyle={{ color: "hsl(var(--foreground))", marginBottom: "4px" }}
                      itemStyle={{ padding: "4px 0" }}
                    />
                    <Bar dataKey="leads" name="Leads" fill="hsl(var(--primary) / 0.55)" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="contracts" name="Contracts" fill="hsl(var(--chart-2) / 0.8)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-border/70 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
                <CardTitle className="text-lg">Records by Module</CardTitle>
                <Button variant="ghost" size="sm" className="h-8 rounded-lg px-2 text-xs text-muted-foreground">
                  <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
                  All Time
                </Button>
              </CardHeader>
              <CardContent className="grid gap-4 pt-4 sm:grid-cols-[170px_1fr]">
                <div className="relative h-[170px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={moduleData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={45}
                        outerRadius={72}
                        paddingAngle={2}
                      >
                        {moduleData.map((item) => (
                          <Cell key={item.name} fill={item.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-semibold">{moduleTotal}</span>
                    <span className="text-xs text-muted-foreground">Total Records</span>
                  </div>
                </div>

                <div className="space-y-2 flex flex-col justify-center">
                  {moduleData.filter(m => m.name !== "No data yet").map((item) => (
                    <div key={item.name} className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-muted/20 px-2.5 py-2">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="text-sm truncate w-[80px]" title={item.name}>{item.name.split(" ")[0]}</span>
                      </div>
                      <span className="text-sm font-semibold">{item.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="border-primary/30 bg-gradient-to-b from-primary/15 via-card to-card shadow-sm xl:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Leads by Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="relative mx-auto h-[180px] w-full max-w-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={leadsStatusData} dataKey="value" innerRadius={56} outerRadius={78} paddingAngle={4}>
                    {leadsStatusData.map((item) => (
                      <Cell key={item.name} fill={item.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-semibold">{leadTotal.toLocaleString()}</span>
                <span className="text-xs text-muted-foreground">Total Leads</span>
              </div>
            </div>

            <div className="grid gap-2">
              {leadsStatusData.filter(l => l.name !== "No Leads").map((item) => (
                <div key={item.name} className="flex items-center justify-between rounded-lg bg-background/70 px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="capitalize">{item.name.replace(/_/g, " ")}</span>
                  </div>
                  <span className="font-semibold">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-12">
        <Card className="border-border/70 shadow-sm xl:col-span-6">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg">Recent Opportunities (CRM)</CardTitle>
            <Button variant="ghost" size="sm" className="h-8 rounded-lg text-xs">
              See All
            </Button>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {lists.opportunities.length > 0 ? lists.opportunities.map((opp: DashboardItem) => (
              <article key={opp.id} className="rounded-xl border border-border/70 bg-background/80 p-3">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h3 className="text-base font-semibold leading-tight truncate" title={opp.name}>{opp.name}</h3>
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg shrink-0">
                    <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
                <div className="mb-3 flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className="bg-muted px-2 py-0.5 text-[11px] capitalize">{opp.stage}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold">${(opp.amount || 0).toLocaleString()}</span>
                  <span className="text-muted-foreground text-xs">
                    {opp.close_date ? format(new Date(opp.close_date), "MMM dd, yyyy") : "No date"}
                  </span>
                </div>
              </article>
            )) : <p className="text-sm text-muted-foreground p-4">No recent opportunities found.</p>}
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm xl:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg">Recent Contracts (CLM)</CardTitle>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {lists.contracts.length > 0 ? lists.contracts.map((contract: DashboardItem) => (
              <article key={contract.id} className="space-y-2.5 rounded-xl border border-border/70 bg-background/70 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="overflow-hidden">
                    <p className="text-sm font-medium truncate" title={contract.name}>{contract.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{contract.status}</p>
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
                    ${(contract.total_value || 0).toLocaleString()}
                  </span>
                </div>
                <Progress value={Math.random() * 60 + 20} className="h-2.5 bg-muted/60" /> {/* Random progress for visual indicator representing lifecycle */}
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock3 className="h-3.5 w-3.5" />
                  Ends {contract.end_date ? format(new Date(contract.end_date), "MMM dd, yyyy") : "TBD"}
                </div>
              </article>
            )) : <p className="text-sm text-muted-foreground p-4">No recent contracts.</p>}
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm xl:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg">Recent Activities</CardTitle>
            <Button variant="ghost" size="sm" className="h-8 rounded-lg px-2 text-xs text-muted-foreground">
              <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
              Latest
            </Button>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {lists.activities.length > 0 ? lists.activities.map((activity: DashboardItem, index: number) => {
              const dateStr = activity.start_time ? format(new Date(activity.start_time), "h:mm a") : "Time TBD";
              // Rotate through tones
              const tones = ["bg-chart-2/20", "bg-primary/15", "bg-chart-3/20", "bg-chart-4/20"];
              const tone = tones[index % tones.length];

              return (
                <article key={activity.id} className="grid grid-cols-[56px_1fr] items-start gap-2.5">
                  <p className="pt-1 text-xs text-muted-foreground">{dateStr}</p>
                  <div className={cn("rounded-xl border border-border/50 px-3 py-2.5 text-foreground", tone)}>
                    <p className="text-sm font-semibold leading-snug line-clamp-2" title={activity.subject}>{activity.subject}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground capitalize">{activity.type}</p>
                  </div>
                </article>
              )
            }) : <p className="text-sm text-muted-foreground p-4">No recent activities.</p>}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-12">
        <Card className="border-border/70 shadow-sm xl:col-span-8">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg">Recent Leads ({kpis.leads})</CardTitle>
            <Button variant="ghost" size="sm" className="h-8 rounded-lg text-xs">
              See All
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {applicantTabs.map((tab, index) => (
                <Badge
                  key={tab}
                  variant={index === 0 ? "default" : "secondary"}
                  className={cn("rounded-full px-3 py-1 text-[11px] cursor-pointer", index === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}
                >
                  {tab}
                </Badge>
              ))}
            </div>
            {lists.leads.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lists.leads.map((lead: DashboardItem) => (
                    <TableRow key={lead.id}>
                      <TableCell>
                        <div className="max-w-[150px] truncate">
                          <p className="font-medium truncate" title={`${lead.first_name || ""} ${lead.last_name || ""}`.trim()}>
                            {lead.first_name || lead.last_name ? `${lead.first_name || ""} ${lead.last_name || ""}`.trim() : "Unnamed Lead"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate" title={lead.email || ""}>{lead.email || "No email"}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="truncate max-w-[120px] inline-block" title={lead.company || ""}>{lead.company || "-"}</span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {lead.created_at ? format(new Date(lead.created_at), "MMM dd, yyyy") : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="rounded-full px-2 py-0 text-[11px] capitalize whitespace-nowrap">
                          {lead.status?.replace(/_/g, " ") || "New"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : <p className="text-sm text-muted-foreground py-6 text-center">No leads found.</p>}
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm xl:col-span-4 max-h-[500px] flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 shrink-0">
            <CardTitle className="text-lg">Audit Logs</CardTitle>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-3 overflow-y-auto">
            {lists.auditLogs.length > 0 ? lists.auditLogs.map((log: DashboardItem) => (
              <article key={log.id} className="rounded-xl border border-border/70 bg-background/75 p-3">
                <p className="text-sm leading-relaxed">
                  <span className="font-medium">{log.user_id ? "A user" : "System"}</span> {log.action} <span className="font-medium">{log.entity_type}</span>
                </p>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {log.created_at ? format(new Date(log.created_at), "MMM dd, yyyy • h:mm a") : ""}
                </p>
              </article>
            )) : <p className="text-sm text-muted-foreground p-4 text-center">No recent audit logs.</p>}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
