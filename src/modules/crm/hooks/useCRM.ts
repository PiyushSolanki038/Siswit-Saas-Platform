import { getErrorMessage } from "@/core/utils/errors";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/core/api/client";
import type { Database } from "@/core/api/types";
import { useModuleScope } from "@/core/hooks/useModuleScope";
import { usePlanLimits } from "@/core/hooks/usePlanLimits";
import { useCreateNotification } from "@/core/hooks/useCreateNotification";
import type {
  Account,
  Activity,
  ActivityType,
  Contact,
  Lead,
  LeadSource,
  LeadStatus,
  Opportunity,
  OpportunityStage,
  Product,
  Quote,
  QuoteItem,
  QuoteStatus,
} from "@/core/types/crm";
import {
  applyModuleMutationScope,
  applyModuleReadScope,
  buildModuleCreatePayload,
  requireOrganizationScope,
  type ModuleScopeContext,
} from "@/core/utils/module-scope";
import { softDeleteRecord } from "@/core/utils/soft-delete";
import { safeWriteAuditLog } from "@/core/utils/audit";

type LeadRow = Database["public"]["Tables"]["leads"]["Row"];
type LeadInsert = Database["public"]["Tables"]["leads"]["Insert"];
type LeadUpdate = Database["public"]["Tables"]["leads"]["Update"];
type LeadRowWithCreatedBy = LeadRow & { created_by?: string | null };

type AccountRow = Database["public"]["Tables"]["accounts"]["Row"];
type AccountInsert = Database["public"]["Tables"]["accounts"]["Insert"];
type AccountUpdate = Database["public"]["Tables"]["accounts"]["Update"];
type AccountRowWithCreatedBy = AccountRow & { created_by?: string | null };

type ContactRow = Database["public"]["Tables"]["contacts"]["Row"];
type ContactInsert = Database["public"]["Tables"]["contacts"]["Insert"];
type ContactUpdate = Database["public"]["Tables"]["contacts"]["Update"];
type ContactRowWithCreatedBy = ContactRow & { created_by?: string | null };

type OpportunityRow = Database["public"]["Tables"]["opportunities"]["Row"];
type OpportunityInsert = Database["public"]["Tables"]["opportunities"]["Insert"];
type OpportunityUpdate = Database["public"]["Tables"]["opportunities"]["Update"];
type OpportunityRowWithCreatedBy = OpportunityRow & { created_by?: string | null };

type ActivityRow = Database["public"]["Tables"]["activities"]["Row"];
type ActivityInsert = Database["public"]["Tables"]["activities"]["Insert"];
type ActivityUpdate = Database["public"]["Tables"]["activities"]["Update"];
type ActivityRowWithCreatedBy = ActivityRow & { created_by?: string | null };

type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type ProductInsert = Database["public"]["Tables"]["products"]["Insert"];

type QuoteRow = Database["public"]["Tables"]["quotes"]["Row"];
type QuoteInsert = Database["public"]["Tables"]["quotes"]["Insert"];
type QuoteUpdate = Database["public"]["Tables"]["quotes"]["Update"];

type QuoteItemRow = Database["public"]["Tables"]["quote_line_items"]["Row"];
type QuoteItemInsert = Database["public"]["Tables"]["quote_line_items"]["Insert"];

interface DashboardStats {
  totalLeads: number;
  totalAccounts: number;
  openOpportunities: number;
  totalQuotes: number;
  opportunitiesByStage: Record<string, number>;
  pipelineValue: number;
  expectedRevenue: number;
  wonDeals: number;
  wonValue: number;
  winRate: number;
}

const LEAD_STATUSES: LeadStatus[] = ["new", "contacted", "qualified", "unqualified", "converted"];
const LEAD_SOURCES: LeadSource[] = [
  "website",
  "referral",
  "cold_call",
  "advertisement",
  "social_media",
  "trade_show",
  "other",
];
const OPPORTUNITY_STAGES: OpportunityStage[] = [
  "new",
  "qualified",
  "proposal",
  "negotiation",
  "closed_won",
  "closed_lost",
];
const ACTIVITY_TYPES: ActivityType[] = ["call", "email", "meeting", "task", "note"];
const QUOTE_STATUSES: QuoteStatus[] = [
  "draft",
  "pending_approval",
  "approved",
  "rejected",
  "sent",
  "accepted",
  "expired",
];


function asLeadStatus(value: string | null | undefined): LeadStatus {
  if (value && LEAD_STATUSES.includes(value as LeadStatus)) {
    return value as LeadStatus;
  }
  return "new";
}

function asLeadSource(value: string | null | undefined): LeadSource | undefined {
  if (value && LEAD_SOURCES.includes(value as LeadSource)) {
    return value as LeadSource;
  }
  return undefined;
}

function asOpportunityStage(value: string | null | undefined): OpportunityStage {
  if (value && OPPORTUNITY_STAGES.includes(value as OpportunityStage)) {
    return value as OpportunityStage;
  }
  return "new";
}

function asActivityType(value: string | null | undefined): ActivityType {
  if (value && ACTIVITY_TYPES.includes(value as ActivityType)) {
    return value as ActivityType;
  }
  return "task";
}

function asQuoteStatus(value: string | null | undefined): QuoteStatus {
  if (value && QUOTE_STATUSES.includes(value as QuoteStatus)) {
    return value as QuoteStatus;
  }
  return "draft";
}

function mapLead(row: LeadRowWithCreatedBy): Lead {
  return {
    id: row.id,
    first_name: row.first_name ?? "",
    last_name: row.last_name ?? "",
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    company: row.company ?? undefined,
    job_title: row.title ?? undefined,
    status: asLeadStatus(row.lead_status),
    source: asLeadSource(row.lead_source),
    website: row.website ?? undefined,
    converted_at: row.converted_at ?? undefined,
    converted_account_id: row.converted_to_account_id ?? undefined,
    converted_contact_id: row.converted_to_contact_id ?? undefined,
    converted_opportunity_id: row.converted_to_opportunity_id ?? undefined,
    owner_id: row.owner_id ?? undefined,
    created_by: row.created_by ?? row.owner_id ?? undefined,
    created_at: row.created_at ?? new Date().toISOString(),
    updated_at: row.updated_at ?? new Date().toISOString(),
  };
}

function mapAccount(row: AccountRowWithCreatedBy): Account {
  return {
    id: row.id,
    name: row.name,
    industry: row.industry ?? undefined,
    website: row.website ?? undefined,
    phone: row.phone ?? undefined,
    email: row.domain ?? undefined,
    address: row.billing_address ?? undefined,
    city: row.billing_city ?? undefined,
    state: row.billing_state ?? undefined,
    country: row.billing_country ?? undefined,
    postal_code: row.billing_zip ?? undefined,
    annual_revenue: row.annual_revenue ?? undefined,
    employee_count: row.number_of_employees ?? undefined,
    description: row.description ?? undefined,
    owner_id: row.owner_id ?? undefined,
    created_by: row.created_by ?? row.owner_id ?? undefined,
    created_at: row.created_at ?? new Date().toISOString(),
    updated_at: row.updated_at ?? new Date().toISOString(),
  };
}

function mapContact(row: ContactRowWithCreatedBy): Contact {
  return {
    id: row.id,
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    mobile: row.mobile_phone ?? undefined,
    job_title: row.job_title ?? undefined,
    department: row.department ?? undefined,
    account_id: row.account_id ?? undefined,
    address: row.address ?? undefined,
    city: row.city ?? undefined,
    state: row.state ?? undefined,
    country: row.country ?? undefined,
    postal_code: row.zip ?? undefined,
    owner_id: row.owner_id ?? undefined,
    created_by: row.created_by ?? row.owner_id ?? undefined,
    created_at: row.created_at ?? new Date().toISOString(),
    updated_at: row.updated_at ?? new Date().toISOString(),
  };
}

function mapOpportunity(row: OpportunityRowWithCreatedBy): Opportunity {
  return {
    id: row.id,
    name: row.name,
    account_id: row.account_id ?? undefined,
    contact_id: row.contact_id ?? undefined,
    stage: asOpportunityStage(row.stage),
    amount: row.amount ?? undefined,
    probability: row.probability ?? undefined,
    expected_revenue: row.expected_revenue ?? undefined,
    close_date: row.close_date ?? undefined,
    lead_source: asLeadSource(row.lead_source),
    next_step: row.next_step ?? undefined,
    is_closed: row.is_closed ?? undefined,
    is_won: row.is_won ?? undefined,
    owner_id: row.owner_id ?? undefined,
    created_by: row.created_by ?? row.owner_id ?? undefined,
    created_at: row.created_at ?? new Date().toISOString(),
    updated_at: row.updated_at ?? new Date().toISOString(),
  };
}

function mapActivity(row: ActivityRowWithCreatedBy): Activity {
  const isCompleted = row.status === "completed" || Boolean(row.completed_at);

  const related = {
    lead_id: row.related_to_type === "lead" ? row.related_to_id ?? undefined : undefined,
    account_id: row.related_to_type === "account" ? row.related_to_id ?? undefined : undefined,
    contact_id: row.related_to_type === "contact" ? row.related_to_id ?? undefined : undefined,
    opportunity_id: row.related_to_type === "opportunity" ? row.related_to_id ?? undefined : undefined,
  };

  return {
    id: row.id,
    type: asActivityType(row.type),
    subject: row.subject ?? "",
    description: row.description ?? undefined,
    due_date: row.due_date ?? undefined,
    completed_at: row.completed_at ?? undefined,
    is_completed: isCompleted,
    priority: row.priority ?? undefined,
    owner_id: row.owner_id ?? undefined,
    created_by: row.created_by ?? row.owner_id ?? undefined,
    created_at: row.created_at ?? new Date().toISOString(),
    updated_at: row.updated_at ?? new Date().toISOString(),
    ...related,
  };
}

function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku ?? undefined,
    description: row.description ?? undefined,
    category: row.family ?? undefined,
    unit_price: row.list_price ?? 0,
    is_active: row.is_active ?? true,
    created_at: row.created_at ?? new Date().toISOString(),
    updated_at: row.updated_at ?? new Date().toISOString(),
  };
}

function mapQuote(row: QuoteRow): Quote {
  return {
    id: row.id,
    quote_number: row.quote_number,
    opportunity_id: row.opportunity_id ?? undefined,
    account_id: row.account_id ?? undefined,
    contact_id: row.contact_id ?? undefined,
    status: asQuoteStatus(row.status),
    subtotal: row.subtotal ?? undefined,
    discount_percent: row.discount_percent ?? undefined,
    tax_percent: row.tax_percent ?? undefined,
    tax_amount: row.tax_amount ?? undefined,
    total: row.total_amount ?? undefined,
    approved_by: row.approved_by ?? undefined,
    approved_at: row.approved_at ?? undefined,
    owner_id: row.owner_id ?? undefined,
    created_at: row.created_at ?? new Date().toISOString(),
    updated_at: row.updated_at ?? new Date().toISOString(),
  };
}

function mapQuoteItem(row: QuoteItemRow): QuoteItem {
  return {
    id: row.id,
    quote_id: row.quote_id,
    product_id: row.product_id ?? undefined,
    product_name: row.product_name ?? "",
    description: row.description ?? undefined,
    quantity: row.quantity ?? 0,
    unit_price: row.unit_price ?? 0,
    discount_percent: row.discount_percent ?? undefined,
    total: row.total ?? undefined,
    sort_order: row.sort_order ?? undefined,
    created_at: row.created_at ?? new Date().toISOString(),
  };
}

function resolveActivityRelation(activity: Partial<Activity>): { relatedType: string | null; relatedId: string | null } {
  if (activity.opportunity_id) {
    return { relatedType: "opportunity", relatedId: activity.opportunity_id };
  }
  if (activity.lead_id) {
    return { relatedType: "lead", relatedId: activity.lead_id };
  }
  if (activity.account_id) {
    return { relatedType: "account", relatedId: activity.account_id };
  }
  if (activity.contact_id) {
    return { relatedType: "contact", relatedId: activity.contact_id };
  }
  return { relatedType: null, relatedId: null };
}

async function ensureQuoteAccessible(quoteId: string, scope: ModuleScopeContext) {
  const query = supabase.from("quotes").select("id").eq("id", quoteId);
  const scoped = applyModuleReadScope(query, scope, { ownerColumns: ["owner_id"], hasSoftDelete: true });
  const result = await scoped.maybeSingle();
  if (result.error || !result.data) {
    throw new Error("Quote not found or not accessible");
  }
}

// ===== LEADS =====
export function useLeads() {
  const { scope, enabled, tenantId, userId } = useModuleScope();

  return useQuery({
    queryKey: ["leads", tenantId, userId],
    enabled,
    queryFn: async () => {
      const scopedQuery = applyModuleReadScope(
        supabase.from("leads").select("*"),
        scope,
        { ownerColumns: ["owner_id"], hasSoftDelete: false },
      );

      const { data, error } = await scopedQuery.order("created_at", { ascending: false });
      if (error) throw error;

      return (data ?? []).map((row) => mapLead(row as LeadRow));
    },
  });
}

export function useCreateLead() {
  const queryClient = useQueryClient();
  const { scope, tenantId, userId } = useModuleScope();
  const { checkLimit, incrementUsage } = usePlanLimits();

  return useMutation({
    mutationFn: async (lead: Omit<Partial<Lead>, "id" | "created_at" | "updated_at">) => {
      const limitCheck = await checkLimit("leads");
      if (!limitCheck.allowed) {
        throw new Error(
          `Lead limit reached (${limitCheck.current_count}/${limitCheck.max_allowed}). Please upgrade your plan.`
        );
      }

      const payload = buildModuleCreatePayload<LeadInsert>(
        {
          first_name: lead.first_name || "",
          last_name: lead.last_name || "",
          email: lead.email ?? null,
          phone: lead.phone ?? null,
          company: lead.company ?? null,
          title: lead.job_title ?? null,
          lead_status: lead.status ?? "new",
          lead_source: lead.source ?? null,
          website: lead.website ?? null,
        },
        scope,
      );

      const { data, error } = await supabase.from("leads").insert(payload).select().single();
      if (error) throw error;

      incrementUsage("leads").catch((err) => {
        console.error("Failed to increment leads usage:", err);
        toast.error("Failed to update usage tracking. Please contact support.");
      });

      void safeWriteAuditLog({
        action: "lead_create",
        entityType: "lead",
        entityId: data.id,
        tenantId,
        userId,
        newValues: data,
      });

      return mapLead(data as LeadRow);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead created successfully");
    },
    onError: (error: unknown) => {
      toast.error("Error creating lead: " + getErrorMessage(error));
    },
  });
}

export function useUpdateLead() {
  const queryClient = useQueryClient();
  const { scope, tenantId, userId } = useModuleScope();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Lead> & { id: string }) => {
      const payload: LeadUpdate = {
        updated_at: new Date().toISOString(),
      };

      if (updates.first_name !== undefined) payload.first_name = updates.first_name;
      if (updates.last_name !== undefined) payload.last_name = updates.last_name;
      if (updates.email !== undefined) payload.email = updates.email ?? null;
      if (updates.phone !== undefined) payload.phone = updates.phone ?? null;
      if (updates.company !== undefined) payload.company = updates.company ?? null;
      if (updates.job_title !== undefined) payload.title = updates.job_title ?? null;
      if (updates.status !== undefined) payload.lead_status = updates.status;
      if (updates.source !== undefined) payload.lead_source = updates.source ?? null;
      if (updates.website !== undefined) payload.website = updates.website ?? null;
      if (updates.owner_id !== undefined) payload.owner_id = updates.owner_id ?? null;

      const scopedQuery = applyModuleMutationScope(
        supabase.from("leads").update(payload).eq("id", id),
        scope,
        ["owner_id"],
      );

      const { data, error } = await scopedQuery.select().single();
      if (error) throw error;

      void safeWriteAuditLog({
        action: "lead_update",
        entityType: "lead",
        entityId: id,
        tenantId,
        userId,
        newValues: { ...payload },
      });

      return mapLead(data as LeadRow);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead updated successfully");
    },
    onError: (error: unknown) => {
      toast.error("Error updating lead: " + getErrorMessage(error));
    },
  });
}

export function useDeleteLead() {
  const queryClient = useQueryClient();
  const { scope, tenantId, userId } = useModuleScope();
  const { decrementUsage } = usePlanLimits();

  return useMutation({
    mutationFn: async (id: string) => {
      const access = await applyModuleMutationScope(
        supabase.from("leads").select("id").eq("id", id),
        scope,
        ["owner_id"],
      ).maybeSingle();

      if (access.error || !access.data) {
        throw new Error("Lead not found or not accessible");
      }

      const { error: deleteError } = await applyModuleMutationScope(
        supabase.from("leads").delete().eq("id", id),
        scope,
        ["owner_id"],
      );
      if (deleteError) throw deleteError;

      decrementUsage("leads").catch((err) => {
        console.error("Failed to decrement leads usage:", err);
        toast.error("Failed to update usage tracking. Please contact support.");
      });

      void safeWriteAuditLog({
        action: "lead_delete",
        entityType: "lead",
        entityId: id,
        tenantId,
        userId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead deleted successfully");
    },
    onError: (error: unknown) => {
      toast.error("Error deleting lead: " + getErrorMessage(error));
    },
  });
}

// ===== ACCOUNTS =====
export function useAccounts() {
  const { scope, enabled, tenantId, userId } = useModuleScope();

  return useQuery({
    queryKey: ["accounts", tenantId, userId],
    enabled,
    queryFn: async () => {
      const scopedQuery = applyModuleReadScope(
        supabase.from("accounts").select("*"),
        scope,
        { ownerColumns: ["owner_id"], hasSoftDelete: false },
      );

      const { data, error } = await scopedQuery.order("created_at", { ascending: false });
      if (error) throw error;

      return (data ?? []).map((row) => mapAccount(row as AccountRow));
    },
  });
}

export function useCreateAccount() {
  const queryClient = useQueryClient();
  const { scope, tenantId, userId } = useModuleScope();
  const { checkLimit, incrementUsage } = usePlanLimits();

  return useMutation({
    mutationFn: async (account: Omit<Partial<Account>, "id" | "created_at" | "updated_at">) => {
      const limitCheck = await checkLimit("accounts");
      if (!limitCheck.allowed) {
        throw new Error(
          `Account limit reached (${limitCheck.current_count}/${limitCheck.max_allowed}). Please upgrade your plan.`
        );
      }

      const payload = buildModuleCreatePayload<AccountInsert>(
        {
          name: account.name || "",
          industry: account.industry ?? null,
          website: account.website ?? null,
          phone: account.phone ?? null,
          domain: account.email ?? null,
          annual_revenue: account.annual_revenue ?? null,
          number_of_employees: account.employee_count ?? null,
          billing_address: account.address ?? null,
          billing_city: account.city ?? null,
          billing_state: account.state ?? null,
          billing_country: account.country ?? null,
          billing_zip: account.postal_code ?? null,
          description: account.description ?? null,
        },
        scope,
      );

      const { data, error } = await supabase.from("accounts").insert(payload).select().single();
      if (error) throw error;

      incrementUsage("accounts").catch((err) => {
        console.error("Failed to increment accounts usage:", err);
        toast.error("Failed to update usage tracking. Please contact support.");
      });

      void safeWriteAuditLog({
        action: "account_create",
        entityType: "account",
        entityId: data.id,
        tenantId,
        userId,
        newValues: data,
      });

      return mapAccount(data as AccountRow);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Account created successfully");
    },
    onError: (error: unknown) => {
      toast.error("Error creating account: " + getErrorMessage(error));
    },
  });
}

export function useUpdateAccount() {
  const queryClient = useQueryClient();
  const { scope, tenantId, userId } = useModuleScope();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Account> & { id: string }) => {
      const payload: AccountUpdate = {
        updated_at: new Date().toISOString(),
      };

      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.industry !== undefined) payload.industry = updates.industry ?? null;
      if (updates.website !== undefined) payload.website = updates.website ?? null;
      if (updates.phone !== undefined) payload.phone = updates.phone ?? null;
      if (updates.email !== undefined) payload.domain = updates.email ?? null;
      if (updates.annual_revenue !== undefined) payload.annual_revenue = updates.annual_revenue ?? null;
      if (updates.employee_count !== undefined) payload.number_of_employees = updates.employee_count ?? null;
      if (updates.address !== undefined) payload.billing_address = updates.address ?? null;
      if (updates.city !== undefined) payload.billing_city = updates.city ?? null;
      if (updates.state !== undefined) payload.billing_state = updates.state ?? null;
      if (updates.country !== undefined) payload.billing_country = updates.country ?? null;
      if (updates.postal_code !== undefined) payload.billing_zip = updates.postal_code ?? null;
      if (updates.description !== undefined) payload.description = updates.description ?? null;
      if (updates.owner_id !== undefined) payload.owner_id = updates.owner_id ?? null;

      const scopedQuery = applyModuleMutationScope(
        supabase.from("accounts").update(payload).eq("id", id),
        scope,
        ["owner_id"],
      );

      const { data, error } = await scopedQuery.select().single();
      if (error) throw error;

      void safeWriteAuditLog({
        action: "account_update",
        entityType: "account",
        entityId: id,
        tenantId,
        userId,
        newValues: { ...payload },
      });

      return mapAccount(data as AccountRow);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Account updated successfully");
    },
    onError: (error: unknown) => {
      toast.error("Error updating account: " + getErrorMessage(error));
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  const { scope, tenantId, userId } = useModuleScope();
  const { decrementUsage } = usePlanLimits();

  return useMutation({
    mutationFn: async (id: string) => {
      const access = await applyModuleMutationScope(
        supabase.from("accounts").select("id").eq("id", id),
        scope,
        ["owner_id"],
      ).maybeSingle();

      if (access.error || !access.data) {
        throw new Error("Account not found or not accessible");
      }

      const { error: deleteError } = await applyModuleMutationScope(
        supabase.from("accounts").delete().eq("id", id),
        scope,
        ["owner_id"],
      );
      if (deleteError) throw deleteError;

      decrementUsage("accounts").catch((err) => {
        console.error("Failed to decrement accounts usage:", err);
        toast.error("Failed to update usage tracking. Please contact support.");
      });

      void safeWriteAuditLog({
        action: "account_delete",
        entityType: "account",
        entityId: id,
        tenantId,
        userId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Account deleted successfully");
    },
    onError: (error: unknown) => {
      toast.error("Error deleting account: " + getErrorMessage(error));
    },
  });
}

// ===== CONTACTS =====
export function useContacts(accountId?: string) {
  const { scope, enabled, tenantId, userId } = useModuleScope();

  return useQuery({
    queryKey: ["contacts", tenantId, userId, accountId],
    enabled,
    queryFn: async () => {
      let scopedQuery = applyModuleReadScope(
        supabase.from("contacts").select("*"),
        scope,
        { ownerColumns: ["owner_id"], hasSoftDelete: false },
      );

      if (accountId) {
        scopedQuery = scopedQuery.eq("account_id", accountId);
      }

      const { data, error } = await scopedQuery.order("created_at", { ascending: false });
      if (error) throw error;

      return (data ?? []).map((row) => mapContact(row as ContactRow));
    },
  });
}

export function useCreateContact() {
  const queryClient = useQueryClient();
  const { scope, tenantId, userId } = useModuleScope();
  const { checkLimit, incrementUsage } = usePlanLimits();

  return useMutation({
    mutationFn: async (contact: Omit<Partial<Contact>, "id" | "created_at" | "updated_at">) => {
      const limitCheck = await checkLimit("contacts");
      if (!limitCheck.allowed) {
        throw new Error(
          `Contact limit reached (${limitCheck.current_count}/${limitCheck.max_allowed}). Please upgrade your plan.`
        );
      }

      const payload = buildModuleCreatePayload<ContactInsert>(
        {
          first_name: contact.first_name || "",
          last_name: contact.last_name || "",
          email: contact.email ?? null,
          phone: contact.phone ?? null,
          mobile_phone: contact.mobile ?? null,
          job_title: contact.job_title ?? null,
          department: contact.department ?? null,
          account_id: contact.account_id ?? null,
          address: contact.address ?? null,
          city: contact.city ?? null,
          state: contact.state ?? null,
          country: contact.country ?? null,
          zip: contact.postal_code ?? null,
        },
        scope,
      );

      const { data, error } = await supabase.from("contacts").insert(payload).select().single();
      if (error) throw error;

      incrementUsage("contacts").catch((err) => {
        console.error("Failed to increment contacts usage:", err);
        toast.error("Failed to update usage tracking. Please contact support.");
      });

      void safeWriteAuditLog({
        action: "contact_create",
        entityType: "contact",
        entityId: data.id,
        tenantId,
        userId,
        newValues: data,
      });

      return mapContact(data as ContactRow);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success("Contact created successfully");
    },
    onError: (error: unknown) => {
      toast.error("Error creating contact: " + getErrorMessage(error));
    },
  });
}

export function useUpdateContact() {
  const queryClient = useQueryClient();
  const { scope, tenantId, userId } = useModuleScope();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Contact> & { id: string }) => {
      const payload: ContactUpdate = {
        updated_at: new Date().toISOString(),
      };

      if (updates.first_name !== undefined) payload.first_name = updates.first_name;
      if (updates.last_name !== undefined) payload.last_name = updates.last_name;
      if (updates.email !== undefined) payload.email = updates.email ?? null;
      if (updates.phone !== undefined) payload.phone = updates.phone ?? null;
      if (updates.mobile !== undefined) payload.mobile_phone = updates.mobile ?? null;
      if (updates.job_title !== undefined) payload.job_title = updates.job_title ?? null;
      if (updates.department !== undefined) payload.department = updates.department ?? null;
      if (updates.account_id !== undefined) payload.account_id = updates.account_id ?? null;
      if (updates.address !== undefined) payload.address = updates.address ?? null;
      if (updates.city !== undefined) payload.city = updates.city ?? null;
      if (updates.state !== undefined) payload.state = updates.state ?? null;
      if (updates.country !== undefined) payload.country = updates.country ?? null;
      if (updates.postal_code !== undefined) payload.zip = updates.postal_code ?? null;
      if (updates.owner_id !== undefined) payload.owner_id = updates.owner_id ?? null;

      const scopedQuery = applyModuleMutationScope(
        supabase.from("contacts").update(payload).eq("id", id),
        scope,
        ["owner_id"],
      );

      const { data, error } = await scopedQuery.select().single();
      if (error) throw error;

      void safeWriteAuditLog({
        action: "contact_update",
        entityType: "contact",
        entityId: id,
        tenantId,
        userId,
        newValues: { ...payload },
      });

      return mapContact(data as ContactRow);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success("Contact updated successfully");
    },
    onError: (error: unknown) => {
      toast.error("Error updating contact: " + getErrorMessage(error));
    },
  });
}

export function useDeleteContact() {
  const queryClient = useQueryClient();
  const { scope, tenantId, userId } = useModuleScope();
  const { decrementUsage } = usePlanLimits();

  return useMutation({
    mutationFn: async (id: string) => {
      const access = await applyModuleMutationScope(
        supabase.from("contacts").select("id").eq("id", id),
        scope,
        ["owner_id"],
      ).maybeSingle();

      if (access.error || !access.data) {
        throw new Error("Contact not found or not accessible");
      }

      const { error: deleteError } = await applyModuleMutationScope(
        supabase.from("contacts").delete().eq("id", id),
        scope,
        ["owner_id"],
      );
      if (deleteError) throw deleteError;

      decrementUsage("contacts").catch((err) => {
        console.error("Failed to decrement contacts usage:", err);
        toast.error("Failed to update usage tracking. Please contact support.");
      });

      void safeWriteAuditLog({
        action: "contact_delete",
        entityType: "contact",
        entityId: id,
        tenantId,
        userId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success("Contact deleted successfully");
    },
    onError: (error: unknown) => {
      toast.error("Error deleting contact: " + getErrorMessage(error));
    },
  });
}

// ===== OPPORTUNITIES =====
export function useOpportunities(accountId?: string) {
  const { scope, enabled, tenantId, userId } = useModuleScope();

  return useQuery({
    queryKey: ["opportunities", tenantId, userId, accountId],
    enabled,
    queryFn: async () => {
      let scopedQuery = applyModuleReadScope(
        supabase.from("opportunities").select("*"),
        scope,
        { ownerColumns: ["owner_id"], hasSoftDelete: false },
      );

      if (accountId) {
        scopedQuery = scopedQuery.eq("account_id", accountId);
      }

      const { data, error } = await scopedQuery.order("created_at", { ascending: false });
      if (error) throw error;

      return (data ?? []).map((row) => mapOpportunity(row as OpportunityRow));
    },
  });
}

export function useCreateOpportunity() {
  const queryClient = useQueryClient();
  const { scope, tenantId, userId } = useModuleScope();
  const { checkLimit, incrementUsage } = usePlanLimits();
  const { notify } = useCreateNotification();

  return useMutation({
    mutationFn: async (opportunity: Omit<Partial<Opportunity>, "id" | "created_at" | "updated_at" | "expected_revenue">) => {
      const limitCheck = await checkLimit("opportunities");
      if (!limitCheck.allowed) {
        throw new Error(
          `Opportunity limit reached (${limitCheck.current_count}/${limitCheck.max_allowed}). Please upgrade your plan.`
        );
      }

      const amount = opportunity.amount ?? 0;
      const probability = opportunity.probability ?? 0;

      const payload = buildModuleCreatePayload<OpportunityInsert>(
        {
          name: opportunity.name || "",
          account_id: opportunity.account_id ?? null,
          contact_id: opportunity.contact_id ?? null,
          stage: opportunity.stage ?? "new",
          amount,
          probability,
          expected_revenue: (amount * probability) / 100,
          close_date: opportunity.close_date ?? null,
          lead_source: opportunity.lead_source ?? null,
          next_step: opportunity.description ?? opportunity.next_step ?? null,
          is_closed: false,
          is_won: false,
        },
        scope,
      );

      const { data, error } = await supabase.from("opportunities").insert(payload).select().single();
      if (error) throw error;

      incrementUsage("opportunities").catch((err) => {
        console.error("Failed to increment opportunities usage:", err);
        toast.error("Failed to update usage tracking. Please contact support.");
      });

      void safeWriteAuditLog({
        action: "opportunity_create",
        entityType: "opportunity",
        entityId: data.id,
        tenantId,
        userId,
        newValues: data,
      });

      return mapOpportunity(data as OpportunityRow);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      toast.success("Opportunity created successfully");

      if (tenantId) {
        notify({
          userId: data.owner_id || userId || "",
          organizationId: tenantId,
          type: "member_joined", // Placeholder for opportunity_created
          title: "New Opportunity",
          message: `${data.name} added to pipeline`,
          link: `/${tenantId}/app/crm/opportunities`,
        });
      }
    },
    onError: (error: unknown) => {
      toast.error("Error creating opportunity: " + getErrorMessage(error));
    },
  });
}

export function useUpdateOpportunity() {
  const queryClient = useQueryClient();
  const { scope, tenantId, userId } = useModuleScope();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Opportunity> & { id: string }) => {
      const payload: OpportunityUpdate = {
        updated_at: new Date().toISOString(),
      };

      const amount = updates.amount;
      const probability = updates.probability;

      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.account_id !== undefined) payload.account_id = updates.account_id ?? null;
      if (updates.contact_id !== undefined) payload.contact_id = updates.contact_id ?? null;
      if (updates.stage !== undefined) payload.stage = updates.stage;
      if (updates.amount !== undefined) payload.amount = updates.amount ?? null;
      if (updates.probability !== undefined) payload.probability = updates.probability ?? null;
      if (updates.close_date !== undefined) payload.close_date = updates.close_date ?? null;
      if (updates.lead_source !== undefined) payload.lead_source = updates.lead_source ?? null;
      if (updates.description !== undefined || updates.next_step !== undefined) {
        payload.next_step = updates.description ?? updates.next_step ?? null;
      }
      if (updates.is_closed !== undefined) payload.is_closed = updates.is_closed ?? null;
      if (updates.is_won !== undefined) payload.is_won = updates.is_won ?? null;
      if (updates.owner_id !== undefined) payload.owner_id = updates.owner_id ?? null;

      if (amount !== undefined || probability !== undefined) {
        const safeAmount = amount ?? 0;
        const safeProbability = probability ?? 0;
        payload.expected_revenue = (safeAmount * safeProbability) / 100;
      }

      const scopedQuery = applyModuleMutationScope(
        supabase.from("opportunities").update(payload).eq("id", id),
        scope,
        ["owner_id"],
      );

      const { data, error } = await scopedQuery.select().single();
      if (error) throw error;

      void safeWriteAuditLog({
        action: "opportunity_update",
        entityType: "opportunity",
        entityId: id,
        tenantId,
        userId,
        newValues: { ...payload },
      });

      return mapOpportunity(data as OpportunityRow);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      toast.success("Opportunity updated successfully");
    },
    onError: (error: unknown) => {
      toast.error("Error updating opportunity: " + getErrorMessage(error));
    },
  });
}

export function useDeleteOpportunity() {
  const queryClient = useQueryClient();
  const { scope, tenantId, userId } = useModuleScope();
  const { decrementUsage } = usePlanLimits();

  return useMutation({
    mutationFn: async (id: string) => {
      const access = await applyModuleMutationScope(
        supabase.from("opportunities").select("id").eq("id", id),
        scope,
        ["owner_id"],
      ).maybeSingle();

      if (access.error || !access.data) {
        throw new Error("Opportunity not found or not accessible");
      }

      const { error: deleteError } = await applyModuleMutationScope(
        supabase.from("opportunities").delete().eq("id", id),
        scope,
        ["owner_id"],
      );
      if (deleteError) throw deleteError;

      decrementUsage("opportunities").catch((err) => {
        console.error("Failed to decrement opportunities usage:", err);
        toast.error("Failed to update usage tracking. Please contact support.");
      });

      void safeWriteAuditLog({
        action: "opportunity_delete",
        entityType: "opportunity",
        entityId: id,
        tenantId,
        userId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      toast.success("Opportunity deleted successfully");
    },
    onError: (error: unknown) => {
      toast.error("Error deleting opportunity: " + getErrorMessage(error));
    },
  });
}

// ===== ACTIVITIES =====
export function useActivities(filters?: { opportunityId?: string; leadId?: string; accountId?: string }) {
  const { scope, enabled, tenantId, userId } = useModuleScope();

  return useQuery({
    queryKey: ["activities", tenantId, userId, filters],
    enabled,
    queryFn: async () => {
      let scopedQuery = applyModuleReadScope(
        supabase.from("activities").select("*"),
        scope,
        { ownerColumns: ["owner_id"], hasSoftDelete: false },
      );

      if (filters?.opportunityId) {
        scopedQuery = scopedQuery.eq("related_to_type", "opportunity").eq("related_to_id", filters.opportunityId);
      }
      if (filters?.leadId) {
        scopedQuery = scopedQuery.eq("related_to_type", "lead").eq("related_to_id", filters.leadId);
      }
      if (filters?.accountId) {
        scopedQuery = scopedQuery.eq("related_to_type", "account").eq("related_to_id", filters.accountId);
      }

      const { data, error } = await scopedQuery.order("created_at", { ascending: false });
      if (error) throw error;

      return (data ?? []).map((row) => mapActivity(row as ActivityRow));
    },
  });
}

export function useCreateActivity() {
  const queryClient = useQueryClient();
  const { scope, tenantId, userId } = useModuleScope();

  return useMutation({
    mutationFn: async (activity: Omit<Partial<Activity>, "id" | "created_at" | "updated_at">) => {
      const { relatedType, relatedId } = resolveActivityRelation(activity);
      const isCompleted = Boolean(activity.is_completed);

      const payload = buildModuleCreatePayload<ActivityInsert>(
        {
          type: activity.type ?? "task",
          subject: activity.subject || "",
          description: activity.description ?? null,
          due_date: activity.due_date ?? null,
          priority: activity.priority ?? "medium",
          related_to_type: relatedType,
          related_to_id: relatedId,
          status: isCompleted ? "completed" : "open",
          completed_at: isCompleted ? new Date().toISOString() : null,
        },
        scope,
      );

      const { data, error } = await supabase.from("activities").insert(payload).select().single();
      if (error) throw error;

      void safeWriteAuditLog({
        action: "activity_create",
        entityType: "activity",
        entityId: data.id,
        tenantId,
        userId,
        newValues: data,
      });

      return mapActivity(data as ActivityRow);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      toast.success("Activity created successfully");
    },
    onError: (error: unknown) => {
      toast.error("Error creating activity: " + getErrorMessage(error));
    },
  });
}

export function useUpdateActivity() {
  const queryClient = useQueryClient();
  const { scope, tenantId, userId } = useModuleScope();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Activity> & { id: string }) => {
      const relation = resolveActivityRelation(updates);
      const payload: ActivityUpdate = {
        updated_at: new Date().toISOString(),
      };

      if (updates.type !== undefined) payload.type = updates.type;
      if (updates.subject !== undefined) payload.subject = updates.subject;
      if (updates.description !== undefined) payload.description = updates.description ?? null;
      if (updates.due_date !== undefined) payload.due_date = updates.due_date ?? null;
      if (updates.priority !== undefined) payload.priority = updates.priority ?? null;
      if (updates.owner_id !== undefined) payload.owner_id = updates.owner_id ?? null;
      if (relation.relatedType !== null || relation.relatedId !== null) {
        payload.related_to_type = relation.relatedType;
        payload.related_to_id = relation.relatedId;
      }
      if (updates.is_completed !== undefined) {
        payload.status = updates.is_completed ? "completed" : "open";
        payload.completed_at = updates.is_completed ? new Date().toISOString() : null;
      }

      const scopedQuery = applyModuleMutationScope(
        supabase.from("activities").update(payload).eq("id", id),
        scope,
        ["owner_id"],
      );

      const { data, error } = await scopedQuery.select().single();
      if (error) throw error;

      void safeWriteAuditLog({
        action: "activity_update",
        entityType: "activity",
        entityId: id,
        tenantId,
        userId,
        newValues: { ...payload },
      });

      return mapActivity(data as ActivityRow);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      toast.success("Activity updated successfully");
    },
    onError: (error: unknown) => {
      toast.error("Error updating activity: " + getErrorMessage(error));
    },
  });
}

export function useDeleteActivity() {
  const queryClient = useQueryClient();
  const { scope, tenantId, userId } = useModuleScope();

  return useMutation({
    mutationFn: async (id: string) => {
      const access = await applyModuleMutationScope(
        supabase.from("activities").select("id").eq("id", id),
        scope,
        ["owner_id"],
      ).maybeSingle();

      if (access.error || !access.data) {
        throw new Error("Activity not found or not accessible");
      }

      const { error: deleteError } = await applyModuleMutationScope(
        supabase.from("activities").delete().eq("id", id),
        scope,
        ["owner_id"],
      );
      if (deleteError) throw deleteError;

      void safeWriteAuditLog({
        action: "activity_delete",
        entityType: "activity",
        entityId: id,
        tenantId,
        userId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      toast.success("Activity deleted successfully");
    },
    onError: (error: unknown) => {
      toast.error("Error deleting activity: " + getErrorMessage(error));
    },
  });
}

// ===== PRODUCTS =====
export function useProducts() {
  const { scope, enabled, tenantId, userId } = useModuleScope();

  return useQuery({
    queryKey: ["products", tenantId, userId],
    enabled,
    queryFn: async () => {
      const scopedQuery = applyModuleReadScope(
        supabase.from("products").select("*").eq("is_active", true),
        scope,
        { ownerColumns: [] },
      );

      const { data, error } = await scopedQuery.order("name");
      if (error) throw error;

      return (data ?? []).map((row) => mapProduct(row as ProductRow));
    },
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  const { scope, tenantId, userId } = useModuleScope();

  return useMutation({
    mutationFn: async (product: Omit<Partial<Product>, "id" | "created_at" | "updated_at">) => {
      const payload = buildModuleCreatePayload<ProductInsert>(
        {
          name: product.name || "",
          description: product.description ?? null,
          category: product.category ?? null,
          price: product.unit_price ?? 0,
          cost: product.cost_price ?? 0,
          sku: product.sku || `SKU-${Date.now()}`,
          is_active: product.is_active ?? true,
        },
        scope,
        { ownerColumn: null },
      );

      const { data, error } = await supabase.from("products").insert(payload).select().single();
      if (error) throw error;

      void safeWriteAuditLog({
        action: "product_create",
        entityType: "product",
        entityId: data.id,
        tenantId,
        userId,
        newValues: data,
      });

      return mapProduct(data as ProductRow);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product created successfully");
    },
    onError: (error: unknown) => {
      toast.error("Error creating product: " + getErrorMessage(error));
    },
  });
}

// ===== QUOTES =====
export function useQuotes() {
  const { scope, enabled, tenantId, userId } = useModuleScope();

  return useQuery({
    queryKey: ["quotes", tenantId, userId],
    enabled,
    queryFn: async () => {
      const scopedQuery = applyModuleReadScope(
        supabase.from("quotes").select("*"),
        scope,
        { ownerColumns: ["owner_id"], hasSoftDelete: false },
      );

      const { data, error } = await scopedQuery.order("created_at", { ascending: false });
      if (error) throw error;

      return (data ?? []).map((row) => mapQuote(row as QuoteRow));
    },
  });
}

export function useQuote(id: string) {
  const { scope, enabled, tenantId, userId } = useModuleScope();

  return useQuery({
    queryKey: ["quote", id, tenantId, userId],
    enabled: enabled && Boolean(id),
    queryFn: async () => {
      const scopedQuoteQuery = applyModuleReadScope(
        supabase.from("quotes").select("*").eq("id", id),
        scope,
        { ownerColumns: ["owner_id"], hasSoftDelete: false },
      );
      const { data, error } = await scopedQuoteQuery.single();
      if (error) throw error;

      const { organizationId: requiredOrganizationId } = requireOrganizationScope(scope);
      const { data: items, error: itemsError } = await supabase
        .from("quote_line_items")
        .select("*")
        .eq("quote_id", id)
        .eq("organization_id", requiredOrganizationId)
        .is("deleted_at", null)
        .order("sort_order");
      if (itemsError) throw itemsError;

      return {
        ...mapQuote(data as QuoteRow),
        items: (items ?? []).map((item) => mapQuoteItem(item as QuoteItemRow)),
      } as Quote;
    },
  });
}

export function useCreateQuote() {
  const queryClient = useQueryClient();
  const { scope, tenantId, userId } = useModuleScope();

  return useMutation({
    mutationFn: async (quote: Omit<Partial<Quote>, "id" | "created_at" | "updated_at">) => {
      const payload = buildModuleCreatePayload<QuoteInsert>(
        {
          quote_number: quote.quote_number || `QT-${Date.now()}`,
          opportunity_id: quote.opportunity_id ?? null,
          account_id: quote.account_id ?? null,
          contact_id: quote.contact_id ?? null,
          status: quote.status ?? "draft",
          subtotal: quote.subtotal ?? 0,
          discount_percent: quote.discount_percent ?? 0,
          tax_percent: quote.tax_percent ?? 0,
          tax_amount: quote.tax_amount ?? 0,
          total_amount: quote.total ?? 0,
          expiration_date: quote.valid_until ?? null,
          payment_terms: quote.terms ?? null,
          notes: quote.notes ?? null,
        },
        scope,
      );

      const { data, error } = await supabase.from("quotes").insert(payload).select().single();
      if (error) throw error;

      void safeWriteAuditLog({
        action: "quote_create",
        entityType: "quote",
        entityId: data.id,
        tenantId,
        userId,
        newValues: data,
      });

      return mapQuote(data as QuoteRow);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      toast.success("Quote created successfully");
    },
    onError: (error: unknown) => {
      toast.error("Error creating quote: " + getErrorMessage(error));
    },
  });
}

export function useUpdateQuote() {
  const queryClient = useQueryClient();
  const { scope, tenantId, userId } = useModuleScope();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Quote> & { id: string }) => {
      const payload: QuoteUpdate = {
        updated_at: new Date().toISOString(),
      };

      if (updates.quote_number !== undefined) payload.quote_number = updates.quote_number;
      if (updates.opportunity_id !== undefined) payload.opportunity_id = updates.opportunity_id ?? null;
      if (updates.account_id !== undefined) payload.account_id = updates.account_id ?? null;
      if (updates.contact_id !== undefined) payload.contact_id = updates.contact_id ?? null;
      if (updates.status !== undefined) payload.status = updates.status;
      if (updates.subtotal !== undefined) payload.subtotal = updates.subtotal ?? null;
      if (updates.discount_percent !== undefined) payload.discount_percent = updates.discount_percent ?? null;
      if (updates.tax_percent !== undefined) payload.tax_percent = updates.tax_percent ?? null;
      if (updates.total !== undefined) payload.total_amount = updates.total ?? null;
      if (updates.valid_until !== undefined) payload.expiration_date = updates.valid_until ?? null;
      if (updates.terms !== undefined) payload.payment_terms = updates.terms ?? null;
      if (updates.notes !== undefined) payload.notes = updates.notes ?? null;
      if (updates.owner_id !== undefined) payload.owner_id = updates.owner_id ?? null;

      const scopedQuery = applyModuleMutationScope(
        supabase.from("quotes").update(payload).eq("id", id),
        scope,
        ["owner_id"],
      );

      const { data, error } = await scopedQuery.select().single();
      if (error) throw error;

      void safeWriteAuditLog({
        action: "quote_update",
        entityType: "quote",
        entityId: id,
        tenantId,
        userId,
        newValues: { ...payload },
      });

      return mapQuote(data as QuoteRow);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["quote", variables.id] });
      toast.success("Quote updated successfully");
    },
    onError: (error: unknown) => {
      toast.error("Error updating quote: " + getErrorMessage(error));
    },
  });
}

export function useCreateQuoteItem() {
  const queryClient = useQueryClient();
  const { scope, tenantId, userId } = useModuleScope();

  return useMutation({
    mutationFn: async (item: Omit<Partial<QuoteItem>, "id" | "created_at">) => {
      const quoteId = item.quote_id || "";
      await ensureQuoteAccessible(quoteId, scope);

      const { organizationId: requiredOrganizationId } = requireOrganizationScope(scope);
      const payload: QuoteItemInsert = {
        quote_id: quoteId,
        organization_id: requiredOrganizationId,
        tenant_id: requiredOrganizationId,
        product_id: item.product_id ?? null,
        product_name: item.product_name || "",
        description: item.description ?? null,
        quantity: item.quantity ?? 1,
        unit_price: item.unit_price ?? 0,
        discount_percent: item.discount_percent ?? 0,
        line_total: item.total ?? 0,
        sort_order: item.sort_order ?? 0,
      };

      const { data, error } = await supabase.from("quote_line_items").insert(payload).select().single();
      if (error) throw error;

      void safeWriteAuditLog({
        action: "quote_item_create",
        entityType: "quote_item",
        entityId: data.id,
        tenantId,
        userId,
        newValues: data,
      });

      return mapQuoteItem(data as QuoteItemRow);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["quote"] });
      toast.success("Quote item added successfully");
    },
    onError: (error: unknown) => {
      toast.error("Error adding quote item: " + getErrorMessage(error));
    },
  });
}

export function useDeleteQuoteItem() {
  const queryClient = useQueryClient();
  const { scope, tenantId, userId } = useModuleScope();

  return useMutation({
    mutationFn: async (id: string) => {
      const { organizationId: requiredOrganizationId } = requireOrganizationScope(scope);
      const itemResult = await supabase
        .from("quote_line_items")
        .select("id, quote_id, organization_id")
        .eq("id", id)
        .eq("organization_id", requiredOrganizationId)
        .maybeSingle();

      if (itemResult.error || !itemResult.data) {
        throw new Error("Quote item not found or not accessible");
      }

      await ensureQuoteAccessible(itemResult.data.quote_id, scope);

      const deleted = await softDeleteRecord({
        table: "quote_line_items",
        id,
        userId,
        organizationId: tenantId || "",
      });
      if (!deleted) throw new Error("Failed to delete quote item");

      void safeWriteAuditLog({
        action: "quote_item_delete",
        entityType: "quote_item",
        entityId: id,
        tenantId,
        userId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["quote"] });
      toast.success("Quote item moved to recycle bin");
    },
    onError: (error: unknown) => {
      toast.error("Error removing quote item: " + getErrorMessage(error));
    },
  });
}

// ===== DASHBOARD STATS =====
export function useDashboardStats() {
  const { scope, enabled, tenantId, userId } = useModuleScope();

  return useQuery({
    queryKey: ["crm_dashboard_stats", tenantId, userId],
    enabled,
    queryFn: async (): Promise<DashboardStats> => {
      const leadsQuery = applyModuleReadScope(
        supabase.from("leads").select("id", { count: "exact", head: true }),
        scope,
        { ownerColumns: ["owner_id"], hasSoftDelete: false },
      );

      const accountsQuery = applyModuleReadScope(
        supabase.from("accounts").select("id", { count: "exact", head: true }),
        scope,
        { ownerColumns: ["owner_id"], hasSoftDelete: false },
      );

      const quotesQuery = applyModuleReadScope(
        supabase.from("quotes").select("id", { count: "exact", head: true }),
        scope,
        { ownerColumns: ["owner_id"], hasSoftDelete: false },
      );

      const opportunitiesQuery = applyModuleReadScope(
        supabase.from("opportunities").select("id, stage, amount, expected_revenue, is_closed, is_won"),
        scope,
        { ownerColumns: ["owner_id"], hasSoftDelete: false },
      );

      const [{ count: leadsCount, error: leadsError }, { count: accountsCount, error: accountsError }, { count: quotesCount, error: quotesError }, { data: oppData, error: oppError }] =
        await Promise.all([leadsQuery, accountsQuery, quotesQuery, opportunitiesQuery]);

      if (leadsError) throw leadsError;
      if (accountsError) throw accountsError;
      if (quotesError) throw quotesError;
      if (oppError) throw oppError;

      const oppRows = (oppData ?? []) as Pick<OpportunityRow, "stage" | "amount" | "expected_revenue" | "is_closed" | "is_won">[];
      const opportunitiesByStage = oppRows.reduce<Record<string, number>>((acc, opp) => {
        const stage = opp.stage ?? "new";
        acc[stage] = (acc[stage] ?? 0) + 1;
        return acc;
      }, {});

      const openOpps = oppRows.filter((row) => row.is_closed !== true);
      const closedOpps = oppRows.filter((row) => row.is_closed === true);
      const wonOpps = oppRows.filter((row) => row.is_won === true);

      const pipelineValue = openOpps.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
      const expectedRevenue = openOpps.reduce((sum, row) => sum + Number(row.expected_revenue ?? 0), 0);
      const wonValue = wonOpps.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
      const winRate = closedOpps.length > 0 ? (wonOpps.length / closedOpps.length) * 100 : 0;

      return {
        totalLeads: leadsCount ?? 0,
        totalAccounts: accountsCount ?? 0,
        openOpportunities: openOpps.length,
        totalQuotes: quotesCount ?? 0,
        opportunitiesByStage,
        pipelineValue,
        expectedRevenue,
        wonDeals: wonOpps.length,
        wonValue,
        winRate,
      };
    },
  });
}


