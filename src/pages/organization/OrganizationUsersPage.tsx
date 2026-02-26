import { useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOrganizationOwnerData } from "@/hooks/useOrganizationOwnerData";

type RoleFilter = "all" | "owner" | "admin" | "manager" | "employee" | "client";
type StateFilter = "all" | "active" | "pending_approval" | "rejected" | "disabled";

const roleFilters: RoleFilter[] = ["all", "owner", "admin", "manager", "employee", "client"];
const stateFilters: StateFilter[] = ["all", "active", "pending_approval", "rejected", "disabled"];

export default function OrganizationUsersPage() {
  const { organization, loading, memberships, roleDistribution } = useOrganizationOwnerData();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [stateFilter, setStateFilter] = useState<StateFilter>("all");

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return memberships.filter((member) => {
      if (roleFilter !== "all" && member.role !== roleFilter) return false;
      if (stateFilter !== "all" && member.account_state !== stateFilter) return false;
      if (!query) return true;
      return member.email.toLowerCase().includes(query);
    });
  }, [memberships, roleFilter, search, stateFilter]);

  if (loading && !organization) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section>
        <h1 className="text-3xl font-semibold tracking-tight">User Management</h1>
        <p className="mt-1 text-sm text-muted-foreground">Review organization memberships by role and account state.</p>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {roleDistribution.map((role) => (
          <article key={role.role} className="org-panel py-4">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{role.role}</p>
            <p className="mt-2 font-mono text-3xl font-semibold">{role.count}</p>
          </article>
        ))}
      </section>

      <section className="org-panel space-y-4">
        <div className="grid gap-3 md:grid-cols-[1fr_180px_220px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Search by email" />
          </div>
          <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as RoleFilter)}>
            <SelectTrigger>
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              {roleFilters.map((role) => (
                <SelectItem key={role} value={role}>
                  {role === "all" ? "All roles" : role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={stateFilter} onValueChange={(value) => setStateFilter(value as StateFilter)}>
            <SelectTrigger>
              <SelectValue placeholder="Account state" />
            </SelectTrigger>
            <SelectContent>
              {stateFilters.map((state) => (
                <SelectItem key={state} value={state}>
                  {state === "all" ? "All states" : state}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {filteredMembers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No members match the selected filters.</p>
        ) : (
          <div className="space-y-2">
            {filteredMembers.map((member) => (
              <article
                key={member.id}
                className="grid gap-2 rounded-xl border border-border/70 bg-background/70 px-3.5 py-3 md:grid-cols-[1.5fr_120px_160px_120px]"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{member.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Joined {new Date(member.created_at).toLocaleDateString()}
                  </p>
                </div>
                <p className="text-sm capitalize">{member.role}</p>
                <p className="text-sm capitalize">{member.account_state.replace("_", " ")}</p>
                <span className="inline-flex items-center rounded-full bg-muted px-2 py-1 text-xs font-medium">
                  {member.is_active ? "Active" : "Disabled"}
                </span>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

