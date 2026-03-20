import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Search, Users } from "lucide-react";
import { supabase } from "@/core/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/shadcn/card";
import { Input } from "@/ui/shadcn/input";
import { Badge } from "@/ui/shadcn/badge";
import { Button } from "@/ui/shadcn/button";

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended" | "trial" | "cancelled";
  plan_type: string;
  created_at: string;
  active_users: number;
}

interface TenantMembershipRow {
  organization_id: string;
}

const statusTone: Record<string, string> = {
  active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  suspended: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  trial: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  cancelled: "bg-zinc-100 text-zinc-700 dark:bg-zinc-900/30 dark:text-zinc-300",
};

export default function TenantsPanel() {
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tenants, setTenants] = useState<TenantRow[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      const [orgsResult, membershipsResult] = await Promise.all([
        supabase
          .from("organizations")
          .select("id,name,slug,status,plan_type,created_at")
          .order("created_at", { ascending: false }),
        supabase.from("organization_memberships").select("organization_id").eq("is_active", true),
      ]);

      if (orgsResult.error) {
        setTenants([]);
        setLoading(false);
        return;
      }

      const memberships = (membershipsResult.data as TenantMembershipRow[] | null) ?? [];
      const memberCountByOrg = memberships.reduce<Map<string, number>>((map, item) => {
        const orgId = item.organization_id;
        map.set(orgId, (map.get(orgId) ?? 0) + 1);
        return map;
      }, new Map());

      const rows = ((orgsResult.data as TenantRow[] | null) ?? []).map((org) => ({
        ...org,
        active_users: memberCountByOrg.get(org.id) ?? 0,
      }));

      setTenants(rows);
      setLoading(false);
    };

    void load();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return tenants;
    return tenants.filter(
      (tenant) =>
        tenant.name.toLowerCase().includes(term) ||
        tenant.slug.toLowerCase().includes(term) ||
        tenant.plan_type.toLowerCase().includes(term),
    );
  }, [search, tenants]);

  const stats = useMemo(
    () => ({
      total: tenants.length,
      active: tenants.filter((tenant) => tenant.status === "active").length,
      trial: tenants.filter((tenant) => tenant.status === "trial").length,
      users: tenants.reduce((sum, tenant) => sum + tenant.active_users, 0),
    }),
    [tenants],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Tenant Management</h1>
          <p className="text-sm text-muted-foreground">Manage all subscribed companies and their workspace access.</p>
        </div>
        <Button asChild>
          <Link to="/platform/settings">Configure Tenant Defaults</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Tenants</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{stats.total}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Active</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{stats.active}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Trials</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{stats.trial}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Active Users</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-2xl font-semibold">
            <Users className="h-5 w-5 text-muted-foreground" />
            {stats.users}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="text-base">Tenant Directory</CardTitle>
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by company, slug, or plan"
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-6 text-sm text-muted-foreground">Loading tenants...</p>
          ) : filtered.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">No tenants found.</p>
          ) : (
            <div className="space-y-3">
              {filtered.map((tenant) => (
                <div
                  key={tenant.id}
                  className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <p className="font-medium">{tenant.name}</p>
                      <Badge variant="secondary">{tenant.plan_type}</Badge>
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusTone[tenant.status]}`}>
                        {tenant.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      /{tenant.slug} · {tenant.active_users} active users · Created{" "}
                      {new Date(tenant.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/${tenant.slug}/app/dashboard`}>Impersonate</Link>
                    </Button>
                    <Button variant="ghost" size="sm" asChild>
                      <Link to="/platform/billing">Billing</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
