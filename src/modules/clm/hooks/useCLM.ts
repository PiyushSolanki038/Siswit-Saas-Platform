import { getErrorMessage } from "@/core/utils/errors";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/core/api/client";
import type { Database } from "@/core/api/types";
import { useModuleScope } from "@/core/hooks/useModuleScope";
import type { Contract, ContractScan, ContractTemplate, ESignature, CLMDashboardStats } from "@/core/types/clm";
import { canReadAllTenantRows, isOwnerScopedRole } from "@/core/types/roles";
import {
  applyModuleMutationScope,
  applyModuleReadScope,
  buildModuleCreatePayload,
  requireOrganizationScope,
  type ModuleScopeContext,
} from "@/core/utils/module-scope";
import { softDeleteRecord } from "@/core/utils/soft-delete";
import { safeWriteAuditLog } from "@/core/utils/audit";
import { enqueueContractExpiryAlert, enqueueEmailSendJob, enqueueReminderJob, safeEnqueueJob } from "@/core/utils/jobs";

type ContractTemplateInsert = Database["public"]["Tables"]["contract_templates"]["Insert"] & {
  is_active?: boolean | null;
  is_public?: boolean | null;
};
type ContractInsert = Database["public"]["Tables"]["contracts"]["Insert"] & {
  opportunity_id?: string | null;
  contact_id?: string | null;
};
type ContractScanInsert = Database["public"]["Tables"]["contract_scans"]["Insert"] & {
  file_path?: string | null;
  content_type?: string | null;
  file_size?: number | null;
  ocr_text?: string | null;
  scan_date?: string | null;
  created_by?: string | null;
};
type ContractESignatureRow = Database["public"]["Tables"]["contract_esignatures"]["Row"];

function mapESignature(
  row: Pick<
    ContractESignatureRow,
    "id" | "contract_id" | "signer_email" | "signer_name" | "status" | "signed_at" | "created_at" | "updated_at"
  >,
): ESignature {
  return {
    id: row.id,
    contract_id: row.contract_id,
    recipient_email: row.signer_email ?? "",
    recipient_name: row.signer_name ?? "",
    status: (row.status ?? "pending") as ESignature["status"],
    signed_at: row.signed_at ?? undefined,
    created_at: row.created_at ?? new Date().toISOString(),
    updated_at: row.updated_at ?? row.created_at ?? new Date().toISOString(),
  };
}

async function ensureContractAccessible(contractId: string, scope: ModuleScopeContext) {
  const query = supabase.from("contracts").select("id").eq("id", contractId);
  const scoped = applyModuleReadScope(query, scope, { ownerColumns: ["owner_id"], hasSoftDelete: true });
  const result = await scoped.maybeSingle();
  if (result.error || !result.data) {
    throw new Error("Contract not found or not accessible");
  }
}

// ===== CONTRACT TEMPLATES =====
export function useContractTemplates() {
  const { scope, enabled, tenantId, userId } = useModuleScope();

  return useQuery({
    queryKey: ["contract_templates", tenantId, userId],
    enabled,
    queryFn: async () => {
      const scopedQuery = applyModuleReadScope(
        supabase.from("contract_templates").select("*"),
        scope,
        { ownerColumns: ["created_by"], hasSoftDelete: true },
      );

      const { data, error } = await scopedQuery.order("name");
      if (error) throw error;
      return (data ?? []) as ContractTemplate[];
    },
  });
}

export function useCreateContractTemplate() {
  const queryClient = useQueryClient();
  const { scope, tenantId, userId } = useModuleScope();

  return useMutation({
    mutationFn: async (template: Omit<Partial<ContractTemplate>, "id" | "created_at" | "updated_at">) => {
      const payload = buildModuleCreatePayload<ContractTemplateInsert>(
        {
          name: template.name || "",
          type: template.type || "",
          content: template.content || "",
          is_active: template.is_active ?? true,
          is_public: template.is_public ?? false,
        },
        scope,
        { ownerColumn: "created_by", createdByColumn: "created_by" },
      );

      const { data, error } = await supabase.from("contract_templates").insert(payload).select().single();
      if (error) throw error;

      void safeWriteAuditLog({
        action: "contract_template_create",
        entityType: "contract_template",
        entityId: data.id,
        tenantId,
        userId,
        newValues: data,
      });

      return data as ContractTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract_templates"] });
      toast.success("Contract template created successfully");
    },
    onError: (error: unknown) => {
      toast.error("Error creating contract template: " + getErrorMessage(error));
    },
  });
}

export function useUpdateContractTemplate() {
  const queryClient = useQueryClient();
  const { scope, tenantId, userId } = useModuleScope();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ContractTemplate> & { id: string }) => {
      const scopedQuery = applyModuleMutationScope(
        supabase
          .from("contract_templates")
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq("id", id),
        scope,
        ["created_by"],
      );

      const { data, error } = await scopedQuery.select().single();
      if (error) throw error;

      void safeWriteAuditLog({
        action: "contract_template_update",
        entityType: "contract_template",
        entityId: id,
        tenantId,
        userId,
        newValues: updates,
      });

      return data as ContractTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract_templates"] });
      toast.success("Contract template updated successfully");
    },
    onError: (error: unknown) => {
      toast.error("Error updating contract template: " + getErrorMessage(error));
    },
  });
}

export function useDeleteContractTemplate() {
  const queryClient = useQueryClient();
  const { scope, tenantId, userId } = useModuleScope();

  return useMutation({
    mutationFn: async (id: string) => {
      const accessQuery = applyModuleMutationScope(
        supabase.from("contract_templates").select("id").eq("id", id),
        scope,
        ["created_by"],
      );

      const accessResult = await accessQuery.maybeSingle();
      if (accessResult.error || !accessResult.data) {
        throw new Error("Template not found or not accessible");
      }

      const deleted = await softDeleteRecord({
        table: "contract_templates",
        id,
        userId,
        organizationId: tenantId || "",
      });

      if (!deleted) throw new Error("Failed to delete template");

      void safeWriteAuditLog({
        action: "contract_template_delete",
        entityType: "contract_template",
        entityId: id,
        tenantId,
        userId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract_templates"] });
      toast.success("Contract template moved to recycle bin");
    },
    onError: (error: unknown) => {
      toast.error("Error deleting contract template: " + getErrorMessage(error));
    },
  });
}

// ===== CONTRACTS =====
export function useContracts() {
  const { scope, enabled, tenantId, userId } = useModuleScope();

  return useQuery({
    queryKey: ["contracts", tenantId, userId],
    enabled,
    queryFn: async () => {
      const scopedQuery = applyModuleReadScope(
        supabase.from("contracts").select("*, accounts(name), contacts(first_name, last_name)"),
        scope,
        { ownerColumns: ["owner_id"], hasSoftDelete: false },
      );

      const { data, error } = await scopedQuery.order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Contract[];
    },
  });
}

export function useContract(id: string) {
  const { scope, enabled, tenantId, userId } = useModuleScope();

  return useQuery({
    queryKey: ["contract", id, tenantId, userId],
    enabled: enabled && Boolean(id),
    queryFn: async () => {
      const scopedQuery = applyModuleReadScope(
        supabase.from("contracts").select("*").eq("id", id),
        scope,
        { ownerColumns: ["owner_id"], hasSoftDelete: false },
      );

      const { data, error } = await scopedQuery.single();
      if (error) throw error;
      return data as Contract;
    },
  });
}

export function useCreateContract() {
  const queryClient = useQueryClient();
  const { scope, tenantId, userId } = useModuleScope();

  return useMutation({
    mutationFn: async (contract: Omit<Partial<Contract>, "id" | "created_at" | "updated_at">) => {
      const payload = buildModuleCreatePayload<ContractInsert>(
        {
          name: contract.name || "",
          contract_number: contract.contract_number || `CTR-${Date.now()}`,
          template_id: contract.template_id,
          opportunity_id: contract.opportunity_id,
          quote_id: contract.quote_id,
          account_id: contract.account_id,
          contact_id: contract.contact_id,
          status: contract.status || "draft",
          content: contract.content,
          start_date: contract.start_date,
          end_date: contract.end_date,
          value: contract.value,
        },
        scope,
        { createdByColumn: "created_by" },
      );

      const { data, error } = await supabase.from("contracts").insert(payload).select().single();
      if (error) throw error;

      if (tenantId && data.end_date) {
        const endDate = new Date(data.end_date);
        const now = new Date();
        const msPerDay = 1000 * 60 * 60 * 24;
        const daysUntilExpiry = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / msPerDay));
        void safeEnqueueJob(enqueueContractExpiryAlert, {
          tenantId,
          contractId: data.id,
          contractName: data.name,
          daysUntilExpiry,
          createdBy: userId,
        });
      }

      void safeWriteAuditLog({
        action: "contract_create",
        entityType: "contract",
        entityId: data.id,
        tenantId,
        userId,
        newValues: data,
      });

      return data as Contract;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      toast.success("Contract created successfully");
    },
    onError: (error: unknown) => {
      toast.error("Error creating contract: " + getErrorMessage(error));
    },
  });
}

export function useUpdateContract() {
  const queryClient = useQueryClient();
  const { scope, tenantId, userId } = useModuleScope();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Contract> & { id: string }) => {
      const scopedQuery = applyModuleMutationScope(
        supabase
          .from("contracts")
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq("id", id),
        scope,
        ["owner_id"],
      );

      const { data, error } = await scopedQuery.select().single();
      if (error) throw error;

      if (tenantId && updates.end_date) {
        const endDate = new Date(updates.end_date);
        const now = new Date();
        const msPerDay = 1000 * 60 * 60 * 24;
        const daysUntilExpiry = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / msPerDay));
        void safeEnqueueJob(enqueueContractExpiryAlert, {
          tenantId,
          contractId: id,
          contractName: data.name,
          daysUntilExpiry,
          createdBy: userId,
        });
      }

      void safeWriteAuditLog({
        action: "contract_update",
        entityType: "contract",
        entityId: id,
        tenantId,
        userId,
        newValues: updates,
      });

      return data as Contract;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["contract"] });
      toast.success("Contract updated successfully");
    },
    onError: (error: unknown) => {
      toast.error("Error updating contract: " + getErrorMessage(error));
    },
  });
}

export function useDeleteContract() {
  const queryClient = useQueryClient();
  const { scope, tenantId, userId } = useModuleScope();

  return useMutation({
    mutationFn: async (id: string) => {
      const accessQuery = applyModuleMutationScope(
        supabase.from("contracts").select("id").eq("id", id),
        scope,
        ["owner_id"],
      );

      const accessResult = await accessQuery.maybeSingle();
      if (accessResult.error || !accessResult.data) {
        throw new Error("Contract not found or not accessible");
      }

      const deleted = await softDeleteRecord({
        table: "contracts",
        id,
        userId,
        organizationId: tenantId || "",
      });

      if (!deleted) throw new Error("Failed to delete contract");

      void safeWriteAuditLog({
        action: "contract_delete",
        entityType: "contract",
        entityId: id,
        tenantId,
        userId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      toast.success("Contract moved to recycle bin");
    },
    onError: (error: unknown) => {
      toast.error("Error deleting contract: " + getErrorMessage(error));
    },
  });
}

// ===== E-SIGNATURES =====
export function useESignatures(contractId: string) {
  const { scope, enabled, tenantId, userId } = useModuleScope();

  return useQuery({
    queryKey: ["esignatures", contractId, tenantId, userId],
    enabled: enabled && Boolean(contractId),
    queryFn: async () => {
      const { organizationId: requiredOrganizationId, userId: requiredUserId } = requireOrganizationScope(scope);
      let query = supabase
        .from("contract_esignatures")
        .select("id, contract_id, signer_email, signer_name, status, signed_at, created_at, updated_at, contract:contracts!inner(id, organization_id, owner_id)")
        .eq("contract_id", contractId)
        .eq("contract.organization_id", requiredOrganizationId);

      if (!canReadAllTenantRows(scope.role) && isOwnerScopedRole(scope.role)) {
        query = query.eq("contract.owner_id", requiredUserId);
      }

      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []).map((item) => mapESignature(item));
    },
  });
}

export function useCreateESignature() {
  const queryClient = useQueryClient();
  const { scope, tenantId, userId } = useModuleScope();

  return useMutation({
    mutationFn: async (sig: Omit<Partial<ESignature>, "id" | "created_at" | "updated_at">) => {
      const contractId = sig.contract_id || "";
      await ensureContractAccessible(contractId, scope);

      const { organizationId: requiredOrganizationId } = requireOrganizationScope(scope);
      const payload = {
        contract_id: contractId,
        organization_id: requiredOrganizationId,
        tenant_id: requiredOrganizationId,
        signer_email: sig.recipient_email || "",
        signer_name: sig.recipient_name || "",
        status: sig.status || "pending",
        sent_at: new Date().toISOString(),
      };

      const { data, error } = await supabase.from("contract_esignatures").insert(payload).select().single();
      if (error) throw error;

      if (tenantId && sig.recipient_email) {
        void safeEnqueueJob(enqueueEmailSendJob, {
          tenantId,
          to: sig.recipient_email,
          template: "contract_signature_request",
          payload: {
            contract_id: contractId,
            recipient_name: sig.recipient_name,
          },
          createdBy: userId,
        });

        void safeEnqueueJob(enqueueReminderJob, {
          tenantId,
          recipientEmail: sig.recipient_email,
          entityType: "contract_signature",
          entityId: data.id,
          createdBy: userId,
        });
      }

      void safeWriteAuditLog({
        action: "contract_esignature_create",
        entityType: "contract_esignature",
        entityId: data.id,
        tenantId,
        userId,
        newValues: data,
      });

      return mapESignature(data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["esignatures", variables.contract_id] });
      toast.success("E-signature request sent successfully");
    },
    onError: (error: unknown) => {
      toast.error("Error sending e-signature request: " + getErrorMessage(error));
    },
  });
}

export function useUpdateESignature() {
  const queryClient = useQueryClient();
  const { scope, tenantId, userId } = useModuleScope();

  return useMutation({
    mutationFn: async ({ id, contract_id, ...updates }: Partial<ESignature> & { id: string; contract_id?: string }) => {
      let contractId = contract_id ?? null;
      if (!contractId) {
        const lookup = await supabase.from("contract_esignatures").select("contract_id").eq("id", id).maybeSingle();
        if (lookup.error || !lookup.data?.contract_id) {
          throw new Error("E-signature not found or not accessible");
        }
        contractId = lookup.data.contract_id;
      }

      await ensureContractAccessible(contractId, scope);

      const payload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (updates.status) payload.status = updates.status;
      if (updates.signed_at) payload.signed_at = updates.signed_at;

      const scopedQuery = applyModuleMutationScope(
        supabase.from("contract_esignatures").update(payload).eq("id", id),
        scope,
        [],
      );

      const { data, error } = await scopedQuery.select().single();
      if (error) throw error;

      void safeWriteAuditLog({
        action: "contract_esignature_update",
        entityType: "contract_esignature",
        entityId: id,
        tenantId,
        userId,
        newValues: payload,
      });

      return mapESignature(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["esignatures"] });
      toast.success("E-signature updated successfully");
    },
    onError: (error: unknown) => {
      toast.error("Error updating e-signature: " + getErrorMessage(error));
    },
  });
}

// ===== CONTRACT SCANS =====
export function useContractScans(contractId: string) {
  const { scope, enabled, tenantId, userId } = useModuleScope();

  return useQuery({
    queryKey: ["contract_scans", contractId, tenantId, userId],
    enabled: enabled && Boolean(contractId),
    queryFn: async () => {
      await ensureContractAccessible(contractId, scope);

      const scopedQuery = applyModuleReadScope(
        supabase.from("contract_scans").select("*").eq("contract_id", contractId),
        scope,
        { ownerColumns: ["created_by"], hasSoftDelete: true },
      );

      const { data, error } = await scopedQuery.order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ContractScan[];
    },
  });
}

export function useCreateContractScan() {
  const queryClient = useQueryClient();
  const { scope, tenantId, userId } = useModuleScope();

  return useMutation({
    mutationFn: async (scan: Omit<Partial<ContractScan>, "id" | "created_at" | "updated_at">) => {
      const contractId = scan.contract_id || "";
      await ensureContractAccessible(contractId, scope);
      const { organizationId: requiredOrganizationId } = requireOrganizationScope(scope);

      const payload = buildModuleCreatePayload<ContractScanInsert>(
        {
          organization_id: requiredOrganizationId,
          tenant_id: requiredOrganizationId,
          contract_id: contractId,
          file_path: scan.file_path ?? null,
          file_url: scan.file_path ?? null,
          file_name: scan.file_name ?? null,
          content_type: scan.content_type ?? null,
          file_size: scan.file_size ?? null,
          ocr_text: scan.ocr_text ?? null,
          extracted_text: scan.ocr_text ?? null,
          scan_date: scan.scan_date || new Date().toISOString(),
        },
        scope,
        { ownerColumn: "created_by", createdByColumn: "created_by" },
      );

      const { data, error } = await supabase.from("contract_scans").insert(payload).select().single();
      if (error) throw error;

      void safeWriteAuditLog({
        action: "contract_scan_create",
        entityType: "contract_scan",
        entityId: data.id,
        tenantId,
        userId,
        newValues: data,
      });

      return data as ContractScan;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["contract_scans", variables.contract_id] });
      toast.success("Contract scan uploaded successfully");
    },
    onError: (error: unknown) => {
      toast.error("Error uploading contract scan: " + getErrorMessage(error));
    },
  });
}

export function useDeleteContractScan() {
  const queryClient = useQueryClient();
  const { scope, tenantId, userId } = useModuleScope();

  return useMutation({
    mutationFn: async (id: string) => {
      const accessQuery = applyModuleMutationScope(
        supabase.from("contract_scans").select("id").eq("id", id),
        scope,
        ["created_by"],
      );

      const accessResult = await accessQuery.maybeSingle();
      if (accessResult.error || !accessResult.data) {
        throw new Error("Contract scan not found or not accessible");
      }

      const deleted = await softDeleteRecord({
        table: "contract_scans",
        id,
        userId,
        organizationId: tenantId || "",
      });

      if (!deleted) throw new Error("Failed to delete contract scan");

      void safeWriteAuditLog({
        action: "contract_scan_delete",
        entityType: "contract_scan",
        entityId: id,
        tenantId,
        userId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract_scans"] });
      toast.success("Contract scan moved to recycle bin");
    },
    onError: (error: unknown) => {
      toast.error("Error deleting contract scan: " + getErrorMessage(error));
    },
  });
}



// ===== DASHBOARD STATS =====
export function useCLMDashboardStats() {
  const { scope, enabled, tenantId, userId } = useModuleScope();

  return useQuery({
    queryKey: ["clm_dashboard_stats", tenantId, userId],
    enabled,
    queryFn: async (): Promise<CLMDashboardStats> => {
      const contractsQuery = applyModuleReadScope(
        supabase.from("contracts").select("*"),
        scope,
        { ownerColumns: ["owner_id"], hasSoftDelete: false },
      );

      const templatesQuery = applyModuleReadScope(
        supabase.from("contract_templates").select("id", { count: "exact", head: true }),
        scope,
        { ownerColumns: ["created_by"], hasSoftDelete: true },
      );

      const [contractsRes, templatesRes] = await Promise.all([
        contractsQuery.order("created_at", { ascending: false }),
        templatesQuery,
      ]);

      if (contractsRes.error) throw contractsRes.error;
      if (templatesRes.error) throw templatesRes.error;

      const contracts = (contractsRes.data ?? []) as Contract[];
      const totalTemplates = templatesRes.count || 0;
      const totalContracts = contracts.length;
      
      const draftContracts = contracts.filter((c) => c.status === "draft").length;
      const pendingContracts = contracts.filter((c) => 
        c.status === "pending_review" || 
        c.status === "pending_approval" || 
        c.status === "sent"
      ).length;
      const signedContracts = contracts.filter((c) => c.status === "signed").length;
      const expiredContracts = contracts.filter((c) => c.status === "expired").length;
      
      const totalValue = contracts.reduce((sum, c) => sum + (c.value || 0), 0);
      const signRate = totalContracts > 0 ? ((signedContracts / totalContracts) * 100).toFixed(1) : "0";

      const contractsByStatus = contracts.reduce<Record<string, number>>((acc, c) => {
        const status = c.status || "draft";
        acc[status] = (acc[status] ?? 0) + 1;
        return acc;
      }, {});

      return {
        totalTemplates,
        totalContracts,
        draftContracts,
        pendingContracts,
        signedContracts,
        expiredContracts,
        totalValue,
        signRate,
        contractsByStatus,
        recentContracts: contracts.slice(0, 5),
      };
    },
  });
}
