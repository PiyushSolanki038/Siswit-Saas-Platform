import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";

export interface OrganizationOwnerMembership {
  id: string;
  email: string;
  role: string;
  account_state: string;
  is_active: boolean;
  department?: string | null;
  employee_id?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface OrganizationOwnerInvite {
  id: string;
  invited_email: string;
  role?: string;
  status: string;
  expires_at: string;
  created_at: string;
}

export interface OrganizationOwnerAlert {
  id: string;
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
}

interface OrganizationSubscriptionMeta {
  status?: string;
  plan_type?: string;
  trial_end_date?: string | null;
}

function startOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function toDateKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function normalizeInvite(row: Record<string, unknown>): OrganizationOwnerInvite {
  return {
    id: String(row.id ?? ""),
    invited_email: String(row.invited_email ?? ""),
    role: row.role ? String(row.role) : undefined,
    status: String(row.status ?? "pending"),
    expires_at: String(row.expires_at ?? new Date().toISOString()),
    created_at: String(row.created_at ?? new Date().toISOString()),
  };
}

function normalizeMembership(row: Record<string, unknown>): OrganizationOwnerMembership {
  return {
    id: String(row.id ?? ""),
    email: String(row.email ?? ""),
    role: String(row.role ?? "employee"),
    account_state: String(row.account_state ?? "active"),
    is_active: Boolean(row.is_active),
    department: row.department ? String(row.department) : null,
    employee_id: row.employee_id ? String(row.employee_id) : null,
    created_at: String(row.created_at ?? new Date().toISOString()),
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
  };
}

function getDaysLeftFromIso(value: string): number {
  const target = startOfDay(new Date(value));
  const now = startOfDay(new Date());
  const milliseconds = target.getTime() - now.getTime();
  return Math.ceil(milliseconds / (1000 * 60 * 60 * 24));
}

export function useOrganizationOwnerData() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const unsafeSupabase = useMemo(() => supabase as unknown as any, []);
  const { organization, subscription } = useOrganization();

  const [memberships, setMemberships] = useState<OrganizationOwnerMembership[]>([]);
  const [employeeInvites, setEmployeeInvites] = useState<OrganizationOwnerInvite[]>([]);
  const [clientInvites, setClientInvites] = useState<OrganizationOwnerInvite[]>([]);
  const [subscriptionMeta, setSubscriptionMeta] = useState<OrganizationSubscriptionMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [dismissedAlertIds, setDismissedAlertIds] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    if (!organization?.id) {
      setMemberships([]);
      setEmployeeInvites([]);
      setClientInvites([]);
      setSubscriptionMeta(null);
      return;
    }

    setLoading(true);
    try {
      const [membershipsResult, employeeInvitesResult, clientInvitesResult, subscriptionResult] = await Promise.all([
        unsafeSupabase
          .from("organization_memberships")
          .select("id, email, role, account_state, is_active, department, employee_id, created_at, updated_at")
          .eq("organization_id", organization.id)
          .order("created_at", { ascending: false }),
        unsafeSupabase
          .from("employee_invitations")
          .select("id, invited_email, role, status, expires_at, created_at")
          .eq("organization_id", organization.id)
          .order("created_at", { ascending: false })
          .limit(25),
        unsafeSupabase
          .from("client_invitations")
          .select("id, invited_email, status, expires_at, created_at")
          .eq("organization_id", organization.id)
          .order("created_at", { ascending: false })
          .limit(25),
        unsafeSupabase
          .from("organization_subscriptions")
          .select("status, plan_type, trial_end_date")
          .eq("organization_id", organization.id)
          .maybeSingle(),
      ]);

      setMemberships(((membershipsResult.data ?? []) as Record<string, unknown>[]).map(normalizeMembership));
      setEmployeeInvites(((employeeInvitesResult.data ?? []) as Record<string, unknown>[]).map(normalizeInvite));
      setClientInvites(((clientInvitesResult.data ?? []) as Record<string, unknown>[]).map(normalizeInvite));
      setSubscriptionMeta((subscriptionResult.data as OrganizationSubscriptionMeta | null) ?? null);
    } finally {
      setLoading(false);
    }
  }, [organization?.id, unsafeSupabase]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const pendingClients = useMemo(
    () => memberships.filter((member) => member.role === "client" && member.account_state === "pending_approval"),
    [memberships],
  );

  const openEmployeeInvites = useMemo(
    () => employeeInvites.filter((invite) => invite.status === "pending"),
    [employeeInvites],
  );
  const openClientInvites = useMemo(
    () => clientInvites.filter((invite) => invite.status === "pending"),
    [clientInvites],
  );

  const stats = useMemo(() => {
    const totalMembers = memberships.length;
    const activeMembers = memberships.filter((member) => member.is_active && member.account_state === "active").length;
    const pendingApprovals = pendingClients.length;
    const openInvites = openEmployeeInvites.length + openClientInvites.length;

    return {
      totalMembers,
      activeMembers,
      pendingApprovals,
      openInvites,
    };
  }, [memberships, openClientInvites.length, openEmployeeInvites.length, pendingClients.length]);

  const roleDistribution = useMemo(() => {
    const buckets = ["owner", "admin", "manager", "employee", "client"];
    return buckets.map((bucket) => ({
      role: bucket,
      count: memberships.filter((member) => member.role === bucket).length,
    }));
  }, [memberships]);

  const inviteApprovalTrend = useMemo(() => {
    const days = 7;
    const now = new Date();
    const keys: string[] = [];
    for (let index = days - 1; index >= 0; index -= 1) {
      const day = new Date(now);
      day.setDate(now.getDate() - index);
      keys.push(day.toISOString().slice(0, 10));
    }

    return keys.map((key) => {
      const invitesCreated = employeeInvites.concat(clientInvites).filter((invite) => toDateKey(invite.created_at) === key).length;
      const approvals = memberships.filter((member) => member.role === "client" && member.account_state === "active" && toDateKey(member.updated_at) === key).length;

      return {
        day: key.slice(5),
        invites: invitesCreated,
        approvals,
      };
    });
  }, [clientInvites, employeeInvites, memberships]);

  const moduleUtilization = useMemo(() => {
    const totalUsers = Math.max(stats.totalMembers, 1);
    const enabledMap = {
      CRM: Boolean(subscription?.module_crm),
      CPQ: Boolean(subscription?.module_cpq),
      CLM: Boolean(subscription?.module_clm),
      ERP: Boolean(subscription?.module_erp),
      Documents: Boolean(subscription?.module_documents),
    };

    const activeRatio = Math.min(1, stats.activeMembers / totalUsers);

    return Object.entries(enabledMap).map(([module, enabled], index) => ({
      module,
      enabled,
      utilization: enabled ? Math.round((35 + index * 8) * (0.65 + activeRatio * 0.55)) : 0,
    }));
  }, [stats.activeMembers, stats.totalMembers, subscription]);

  const timelineItems = useMemo(() => {
    const pendingInvites = employeeInvites
      .concat(clientInvites)
      .filter((invite) => invite.status === "pending")
      .slice(0, 6);

    return pendingInvites.map((invite, index) => {
      const expiresInDays = getDaysLeftFromIso(invite.expires_at);
      const clampedDays = Math.max(0, Math.min(14, expiresInDays));
      return {
        id: invite.id,
        label: invite.role ? `${invite.role} invite` : "client invite",
        subject: invite.invited_email,
        progress: Math.max(8, Math.round((14 - clampedDays) / 14 * 100)),
        colorClass:
          index % 3 === 0 ? "bg-[#95ff54]" : index % 3 === 1 ? "bg-[#f9a52d]" : "bg-[#6ad0ff]",
      };
    });
  }, [clientInvites, employeeInvites]);

  const alerts = useMemo<OrganizationOwnerAlert[]>(() => {
    const nextAlerts: OrganizationOwnerAlert[] = [];

    if (pendingClients.length > 0) {
      nextAlerts.push({
        id: "pending-approvals",
        severity: "warning",
        title: "Client approvals pending",
        description: `${pendingClients.length} client request(s) are waiting for approval.`,
      });
    }

    const expiringInvites = employeeInvites
      .concat(clientInvites)
      .filter((invite) => invite.status === "pending")
      .filter((invite) => {
        const expiresInDays = getDaysLeftFromIso(invite.expires_at);
        return expiresInDays <= 2 && expiresInDays >= 0;
      });

    if (expiringInvites.length > 0) {
      nextAlerts.push({
        id: "expiring-invitations",
        severity: "info",
        title: "Invitations expiring soon",
        description: `${expiringInvites.length} invitation(s) will expire in the next 48 hours.`,
      });
    }

    const planStatus = subscription?.status ?? subscriptionMeta?.status;
    if (planStatus === "past_due") {
      nextAlerts.push({
        id: "subscription-past-due",
        severity: "critical",
        title: "Subscription payment is past due",
        description: "Billing action is needed to avoid service interruption.",
      });
    }

    if (subscriptionMeta?.trial_end_date && (subscriptionMeta.status ?? subscription?.status) === "trial") {
      const daysLeft = getDaysLeftFromIso(subscriptionMeta.trial_end_date);
      if (daysLeft <= 7 && daysLeft >= 0) {
        nextAlerts.push({
          id: "trial-expiring",
          severity: "warning",
          title: "Trial ending soon",
          description: `Your trial ends in ${daysLeft} day(s). Plan updates are available in Plans & Billing.`,
        });
      }
    }

    return nextAlerts.filter((alert) => !dismissedAlertIds.includes(alert.id));
  }, [
    clientInvites,
    dismissedAlertIds,
    employeeInvites,
    pendingClients.length,
    subscription?.status,
    subscriptionMeta?.status,
    subscriptionMeta?.trial_end_date,
  ]);

  const dismissAlert = useCallback((alertId: string) => {
    setDismissedAlertIds((previous) => {
      if (previous.includes(alertId)) return previous;
      return previous.concat(alertId);
    });
  }, []);

  return {
    organization,
    subscription: subscription ?? null,
    loading,
    memberships,
    pendingClients,
    employeeInvites,
    clientInvites,
    stats,
    roleDistribution,
    inviteApprovalTrend,
    moduleUtilization,
    timelineItems,
    alerts,
    dismissAlert,
    refresh,
  };
}

