"use client";

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/core/auth/useAuth";
import { supabase } from "@/core/api/client";
import { tenantPortalPath } from "@/core/utils/routes";
import { usePortalScope } from "@/workspaces/portal/hooks/usePortalScope";
import {
  AlertTriangle,
  ArrowRight,
  FileSignature,
  FileStack,
  FileText,
  Loader2,
  Quote,
  CheckCircle2,
  Clock,
  FilePlus2,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/core/utils/utils";

/* ─── Types ─────────────────────────────────── */

interface ActivityItem {
  id: string;
  type: "quote" | "contract" | "document" | "signature";
  label: string;
  sub: string;
  status: "pending" | "active" | "completed" | "new";
  date: string;
}

interface Stats {
  quotes: number;
  contracts: number;
  documents: number;
  pendingSignatures: number;
}

/* ─── Helpers ────────────────────────────────── */

const STATUS_STYLES: Record<ActivityItem["status"], string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800/40",
  active: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800/40",
  completed: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-300 dark:border-green-800/40",
  new: "bg-primary/8 text-primary border-primary/20",
};

const STATUS_ICONS: Record<ActivityItem["status"], typeof CheckCircle2> = {
  pending: Clock,
  active: TrendingUp,
  completed: CheckCircle2,
  new: FilePlus2,
};

const TYPE_COLORS: Record<ActivityItem["type"], string> = {
  quote: "bg-violet-100 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400",
  contract: "bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
  document: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400",
  signature: "bg-orange-100 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400",
};

const TYPE_ICONS: Record<ActivityItem["type"], typeof Quote> = {
  quote: Quote,
  contract: FileSignature,
  document: FileStack,
  signature: FileText,
};

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/* Circular progress SVG */
function ProgressRing({
  value,
  total,
  size = 80,
  stroke = 7,
}: {
  value: number;
  total: number;
  size?: number;
  stroke?: number;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = total === 0 ? 0 : Math.min(value / total, 1);
  const offset = circ * (1 - pct);

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        className="text-border/40"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="text-primary transition-all duration-700"
      />
    </svg>
  );
}

/* ─── Component ──────────────────────────────── */

const PortalDashboard = () => {
  const { user } = useAuth();
  const { tenantSlug = "" } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { organizationId, organizationLoading, portalEmail, contactId, accountId, userId, isReady } = usePortalScope();

  const [dataLoading, setDataLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({ quotes: 0, contracts: 0, documents: 0, pendingSignatures: 0 });
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  const quickActions = useMemo(() => [
    { icon: Quote, title: "Quotes", description: "Check your quotes", route: tenantPortalPath(tenantSlug, "quotes") },
    { icon: FileSignature, title: "Contracts", description: "View active agreements", route: tenantPortalPath(tenantSlug, "contracts") },
    { icon: FileStack, title: "Documents", description: "Access shared files", route: tenantPortalPath(tenantSlug, "documents") },
    { icon: FileText, title: "Pending Signatures", description: "Sign pending documents", route: tenantPortalPath(tenantSlug, "pending-signatures") },
  ], [tenantSlug]);

  useEffect(() => {
    const fetchAll = async () => {
      setDataLoading(true);
      try {
        if (!organizationId || !userId) {
          setStats({ quotes: 0, contracts: 0, documents: 0, pendingSignatures: 0 });
          setActivity([]);
          return;
        }

        const withScope = <T extends { eq: (column: string, value: string) => T }>(query: T): T => {
          if (contactId) return query.eq("contact_id", contactId);
          if (accountId) return query.eq("account_id", accountId);
          // If neither ID is available, we must NOT fall back to email for primary data objects
          // to prevent cross-org leaks. We return a query that will yield no results.
          // Using a non-existent UUID as a safety break
          return query.eq("id", "00000000-0000-0000-0000-000000000000");
        };

        /* ── Stats ── */
        const [quotesRes, contractsRes, docsRes] = await Promise.all([
          withScope(supabase.from("quotes").select("id", { count: "exact", head: true }).eq("organization_id", organizationId)),
          withScope(supabase.from("contracts").select("id", { count: "exact", head: true }).eq("organization_id", organizationId)),
          supabase.from("auto_documents").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("created_by", userId),
        ]);

        let pendingCount = 0;
        if (portalEmail && organizationId) {
          const { count } = await supabase
            .from("contract_esignatures")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", organizationId)
            .eq("signer_email", portalEmail)
            .eq("status", "pending");
          
          pendingCount = count ?? 0;
        }

        setStats({
          quotes: quotesRes.count ?? 0,
          contracts: contractsRes.count ?? 0,
          documents: docsRes.count ?? 0,
          pendingSignatures: pendingCount,
        });

        /* ── Recent activity (quotes + contracts, latest 6) ── */
        const activityItems: ActivityItem[] = [];

        if (portalEmail) {
          const { data: recentQuotes } = await withScope(
            supabase.from("quotes").select("id, name, quote_number, status, created_at")
              .eq("organization_id", organizationId)
          ).order("created_at", { ascending: false }).limit(3);

          recentQuotes?.forEach((q: { id: string; name?: string | null; quote_number?: string | null; status?: string | null; created_at?: string | null }) => {
            activityItems.push({
              id: `q-${q.id}`,
              type: "quote",
              label: q.name ?? q.quote_number ?? "Quote",
              sub: `Quote · ${q.quote_number}`,
              status: q.status === "accepted" ? "completed" : q.status === "pending" ? "pending" : "new",
              date: q.created_at ?? new Date().toISOString(),
            });
          });

          const { data: recentContracts } = await withScope(
            supabase.from("contracts").select("id, name, contract_number, status, created_at")
              .eq("organization_id", organizationId)
          ).order("created_at", { ascending: false }).limit(3);

          recentContracts?.forEach((c: { id: string; name?: string | null; contract_number?: string | null; status?: string | null; created_at?: string | null }) => {
            activityItems.push({
              id: `c-${c.id}`,
              type: "contract",
              label: c.name ?? "Contract",
              sub: `Contract${c.contract_number ? ` · ${c.contract_number}` : ""}`,
              status: c.status === "active" ? "active" : c.status === "completed" ? "completed" : "new",
              date: c.created_at ?? new Date().toISOString(),
            });
          });
        }

        activityItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setActivity(activityItems.slice(0, 6));
      } catch {
        /* silent */
      } finally {
        setDataLoading(false);
      }
    };

    if (!organizationLoading) void fetchAll();
  }, [organizationId, organizationLoading, portalEmail, userId, accountId, contactId]);

  if (organizationLoading || dataLoading || !isReady) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  const firstName = user.user_metadata?.first_name || user.email?.split("@")[0] || "there";
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const totalSigned = stats.contracts; // proxy: contracts = signed+active
  const signatureTotal = totalSigned + stats.pendingSignatures;

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <section className="org-animate-in flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            Client Portal
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Welcome back, {firstName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{today}</p>
        </div>

        {/* Pending signatures alert badge */}
        {stats.pendingSignatures > 0 && (
          <button
            type="button"
            onClick={() => navigate(tenantPortalPath(tenantSlug, "pending-signatures"))}
            className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-100 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-950/50"
          >
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {stats.pendingSignatures} signature{stats.pendingSignatures !== 1 ? "s" : ""} awaiting your review
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </section>

      {/* ── Stat cards ── */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { title: "My Quotes", value: stats.quotes, sub: "Total quotes received", icon: Quote, emphasis: true },
          { title: "Contracts", value: stats.contracts, sub: "Active agreements", icon: FileSignature, emphasis: false },
          { title: "Documents", value: stats.documents, sub: "Shared files", icon: FileStack, emphasis: false },
          { title: "Pending Signs", value: stats.pendingSignatures, sub: "Awaiting your signature", icon: FileText, emphasis: false, urgent: stats.pendingSignatures > 0 },
        ].map((card, i) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className={cn(
                "org-animate-in rounded-2xl border p-5 transition-colors",
                card.emphasis
                  ? "border-primary/20 bg-primary/5"
                  : card.urgent
                    ? "border-amber-200 bg-amber-50/60 dark:border-amber-800/40 dark:bg-amber-950/20"
                    : "border-border/70 bg-card/60",
              )}
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-xl",
                    card.emphasis ? "bg-primary/15 text-primary"
                      : card.urgent ? "bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <span className={cn(
                  "text-3xl font-semibold leading-none tabular-nums",
                  card.urgent && stats.pendingSignatures > 0 && "text-amber-700 dark:text-amber-300",
                )}>
                  {card.value}
                </span>
              </div>
              <p className="mt-4 text-sm font-medium">{card.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{card.sub}</p>
            </div>
          );
        })}
      </section>

      {/* ── Main content: activity + sidebar ── */}
      <section className="grid gap-6 xl:grid-cols-12">

        {/* Activity feed — primary column */}
        <div className="space-y-4 xl:col-span-7">
          <div className="org-animate-in rounded-2xl border border-border/70 bg-card/60 p-5" style={{ animationDelay: "200ms" }}>
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">Recent Activity</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">Your latest quotes, contracts and documents</p>
              </div>
            </div>

            {activity.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/60 bg-background/30 py-10 text-center">
                <FileStack className="mx-auto h-8 w-8 text-muted-foreground/40" />
                <p className="mt-3 text-sm text-muted-foreground">No activity yet.</p>
                <p className="mt-1 text-xs text-muted-foreground/60">Your quotes and contracts will appear here.</p>
              </div>
            ) : (
              <div className="relative space-y-0">
                {/* Vertical timeline line */}
                <div className="absolute left-[19px] top-3 bottom-3 w-px bg-border/50" />

                {activity.map((item, i) => {
                  const TypeIcon = TYPE_ICONS[item.type];
                  const StatusIcon = STATUS_ICONS[item.status];
                  return (
                    <div
                      key={item.id}
                      className="org-animate-in relative flex gap-4 pb-4 last:pb-0"
                      style={{ animationDelay: `${220 + i * 50}ms` }}
                    >
                      {/* Timeline dot */}
                      <div className={cn(
                        "relative z-10 mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-background",
                        TYPE_COLORS[item.type],
                      )}>
                        <TypeIcon className="h-4 w-4" />
                      </div>

                      {/* Content */}
                      <div className="flex flex-1 items-start justify-between gap-3 rounded-xl border border-border/50 bg-background/70 px-4 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{item.label}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{item.sub}</p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          <span className={cn(
                            "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize",
                            STATUS_STYLES[item.status],
                          )}>
                            <StatusIcon className="h-2.5 w-2.5" />
                            {item.status}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{formatRelative(item.date)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick actions row */}
          <div className="org-animate-in" style={{ animationDelay: "320ms" }}>
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-widest px-0.5">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.title}
                    type="button"
                    onClick={() => navigate(action.route)}
                    className="group flex flex-col items-start gap-3 rounded-2xl border border-border/60 bg-card/60 p-4 text-left transition-colors hover:border-primary/30 hover:bg-primary/5"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors group-hover:bg-primary/15 group-hover:text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium leading-none">{action.title}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">{action.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar column */}
        <div className="space-y-4 xl:col-span-5">

          {/* Signature progress card */}
          <div
            className="org-animate-in rounded-2xl border border-border/70 bg-card/60 p-5"
            style={{ animationDelay: "240ms" }}
          >
            <h2 className="text-base font-semibold">Signature Progress</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Completed vs pending e-signatures</p>

            <div className="mt-5 flex items-center gap-6">
              {/* Ring */}
              <div className="relative shrink-0">
                <ProgressRing value={totalSigned} total={signatureTotal} size={84} stroke={8} />
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-lg font-semibold leading-none tabular-nums">
                    {signatureTotal === 0 ? "—" : `${Math.round((totalSigned / signatureTotal) * 100)}%`}
                  </span>
                </div>
              </div>

              {/* Legend */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
                  <div>
                    <p className="text-xs font-medium">{totalSigned} completed</p>
                    <p className="text-[11px] text-muted-foreground">Signed contracts</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-400" />
                  <div>
                    <p className="text-xs font-medium">{stats.pendingSignatures} pending</p>
                    <p className="text-[11px] text-muted-foreground">Awaiting signature</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-border/60" />
                  <div>
                    <p className="text-xs font-medium">{signatureTotal} total</p>
                    <p className="text-[11px] text-muted-foreground">All e-signatures</p>
                  </div>
                </div>
              </div>
            </div>

            {stats.pendingSignatures > 0 && (
              <button
                type="button"
                onClick={() => navigate(tenantPortalPath(tenantSlug, "pending-signatures"))}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 py-2.5 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-100 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-300"
              >
                Review pending signatures
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Summary card */}
          <div
            className="org-animate-in rounded-2xl border border-border/70 bg-card/60 p-5"
            style={{ animationDelay: "280ms" }}
          >
            <h2 className="text-base font-semibold">Your Summary</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">All-time totals across your portal</p>

            <div className="mt-4 space-y-2">
              {[
                { label: "Total Quotes", value: stats.quotes, icon: Quote, color: "text-violet-500" },
                { label: "Total Contracts", value: stats.contracts, icon: FileSignature, color: "text-blue-500" },
                { label: "Total Documents", value: stats.documents, icon: FileStack, color: "text-emerald-500" },
              ].map((row) => {
                const Icon = row.icon;
                const max = Math.max(stats.quotes, stats.contracts, stats.documents, 1);
                const pct = Math.round((row.value / max) * 100);
                return (
                  <div key={row.label} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Icon className={cn("h-3.5 w-3.5 shrink-0", row.color)} />
                        <span className="text-xs text-muted-foreground">{row.label}</span>
                      </div>
                      <span className="text-xs font-semibold tabular-nums">{row.value}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full transition-all duration-700", row.color.replace("text-", "bg-"))}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Help / support nudge */}
          <div
            className="org-animate-in rounded-2xl border border-border/70 bg-card/60 p-5"
            style={{ animationDelay: "320ms" }}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">Need help?</p>
                <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                  Contact your account manager if you have questions about any quotes, contracts, or documents.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default PortalDashboard;