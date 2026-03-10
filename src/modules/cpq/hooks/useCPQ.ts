import { getErrorMessage } from "@/core/utils/errors";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/core/api/client";
import type { Database } from "@/core/api/types";
import { useModuleScope } from "@/core/hooks/useModuleScope";
import type { Product, Quote, QuoteItem, QuoteStatus } from "@/core/types/cpq";
import { canReadAllTenantRows, isOwnerScopedRole } from "@/core/types/roles";
import {
  applyModuleMutationScope,
  applyModuleReadScope,
  buildModuleCreatePayload,
  requireOrganizationScope,
} from "@/core/utils/module-scope";
import { softDeleteRecord } from "@/core/utils/soft-delete";
import { safeWriteAuditLog } from "@/core/utils/audit";

type ProductInsert = Database["public"]["Tables"]["products"]["Insert"];
type QuoteInsert = Database["public"]["Tables"]["quotes"]["Insert"];
type QuoteLineItemInsert = Database["public"]["Tables"]["quote_line_items"]["Insert"];


// ===== QUOTE STATUS VALIDATION =====
const QUOTE_STATUS_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  draft: ["pending_approval", "cancelled"],
  pending_approval: ["approved", "rejected", "cancelled"],
  approved: ["sent", "cancelled"],
  sent: ["accepted", "rejected", "expired", "cancelled"],
  accepted: [],
  rejected: [],
  expired: [],
  cancelled: [],
};

function validateQuoteStatusTransition(currentStatus: string, nextStatus: string) {
  const allowedNextStatuses = QUOTE_STATUS_TRANSITIONS[currentStatus as QuoteStatus] ?? [];
  if (!allowedNextStatuses.includes(nextStatus as QuoteStatus)) {
    throw new Error(`Invalid quote status transition from "${currentStatus}" to "${nextStatus}"`);
  }
}

// ===== QUOTE CALCULATION HELPERS =====
function calculateQuoteItemTotal(item: Partial<QuoteItem>) {
  const quantity = Number(item.quantity ?? 0);
  const unitPrice = Number(item.unit_price ?? 0);
  const discountPercent = Number(item.discount_percent ?? 0);

  const lineSubtotal = quantity * unitPrice;
  const discountAmount = (lineSubtotal * discountPercent) / 100;

  return Math.max(0, lineSubtotal - discountAmount);
}

function calculateQuoteTotals(
  items: Partial<QuoteItem>[],
  discountPercent = 0,
  taxPercent = 0,
) {
  const subtotal = items.reduce((sum, item) => sum + calculateQuoteItemTotal(item), 0);
  const quoteDiscountAmount = (subtotal * Number(discountPercent || 0)) / 100;
  const taxableAmount = subtotal - quoteDiscountAmount;
  const taxAmount = (taxableAmount * Number(taxPercent || 0)) / 100;
  const totalAmount = taxableAmount + taxAmount;

  return {
    subtotal,
    discountAmount: quoteDiscountAmount,
    taxAmount,
    totalAmount,
  };
}

// ===== PRODUCTS =====
export function useProducts() {
  const { scope, enabled, tenantId } = useModuleScope();

  return useQuery({
    queryKey: ["products", tenantId],
    enabled,
    queryFn: async () => {
      const { organizationId: requiredOrganizationId } = requireOrganizationScope(scope);
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("organization_id", requiredOrganizationId)
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("name");

      if (error) throw error;
      return (data ?? []).map((item) => ({
        ...item,
        unit_price: item.list_price ?? 0,
      })) as Product[];
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
          description: product.description,
          category: product.category,
          list_price: product.unit_price || 0,
          cost_price: product.cost_price,
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

      return {
        ...data,
        unit_price: data.list_price,
      } as Product;
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

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  const { scope, tenantId, userId } = useModuleScope();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Product> & { id: string }) => {
      const payload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.description !== undefined) payload.description = updates.description;
      if (updates.category !== undefined) payload.category = updates.category;
      if (updates.unit_price !== undefined) payload.list_price = updates.unit_price;
      if (updates.cost_price !== undefined) payload.cost_price = updates.cost_price;
      if (updates.sku !== undefined) payload.sku = updates.sku;
      if (updates.is_active !== undefined) payload.is_active = updates.is_active;

      const scopedQuery = applyModuleMutationScope(
        supabase.from("products").update(payload).eq("id", id),
        scope,
        [],
      );

      const { data, error } = await scopedQuery.select().single();
      if (error) throw error;

      void safeWriteAuditLog({
        action: "product_update",
        entityType: "product",
        entityId: id,
        tenantId,
        userId,
        newValues: payload,
      });

      return {
        ...data,
        unit_price: data.list_price,
      } as Product;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product updated successfully");
    },
    onError: (error: unknown) => {
      toast.error("Error updating product: " + getErrorMessage(error));
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  const { scope, tenantId, userId } = useModuleScope();

  return useMutation({
    mutationFn: async (id: string) => {
      const accessQuery = applyModuleMutationScope(
        supabase.from("products").select("id").eq("id", id),
        scope,
        [],
      );
      const accessResult = await accessQuery.maybeSingle();
      if (accessResult.error || !accessResult.data) {
        throw new Error("Product not found or not accessible");
      }

      const deleted = await softDeleteRecord({
        table: "products",
        id,
        userId,
        organizationId: tenantId || "",
      });
      if (!deleted) throw new Error("Failed to delete product");

      void safeWriteAuditLog({
        action: "product_delete",
        entityType: "product",
        entityId: id,
        tenantId,
        userId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product moved to recycle bin");
    },
    onError: (error: unknown) => {
      toast.error("Error deleting product: " + getErrorMessage(error));
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
        supabase
          .from("quotes")
          .select("*, accounts(id, name), contacts(id, first_name, last_name, email, phone), opportunities(id, name)"),
        scope,
        { ownerColumns: ["owner_id"], hasSoftDelete: false },
      );

      const { data, error } = await scopedQuery.order("created_at", { ascending: false });
      if (error) throw error;

      return (data ?? []).map((row) => ({
        ...row,
        total: row.total_amount,
        valid_until: row.expiration_date,
      })) as Quote[];
    },
  });
}

export function useQuote(id: string) {
  const { scope, enabled, tenantId, userId } = useModuleScope();

  return useQuery({
    queryKey: ["quote", id, tenantId, userId],
    enabled: enabled && Boolean(id),
    queryFn: async () => {
      const scopedQuery = applyModuleReadScope(
        supabase
          .from("quotes")
          .select("*, accounts(id, name, billing_address, billing_city, billing_state, billing_zip, billing_country), contacts(id, first_name, last_name, email, phone), opportunities(id, name)")
          .eq("id", id),
        scope,
        { ownerColumns: ["owner_id"], hasSoftDelete: false },
      );

      const { data, error } = await scopedQuery.single();
      if (error) throw error;

      return {
        ...data,
        total: data.total_amount,
        valid_until: data.expiration_date,
      } as Quote;
    },
  });
}

export function useCreateQuote() {
  const queryClient = useQueryClient();
  const { scope, tenantId, userId } = useModuleScope();

  return useMutation({
    mutationFn: async (quote: Omit<Partial<Quote>, "id" | "created_at" | "updated_at"> & { items?: QuoteItem[] }) => {
      const { items, ...quoteData } = quote;

      // Compute totals from items safely
      const safeItems = items ?? [];
      const computed = calculateQuoteTotals(
        safeItems,
        Number(quoteData.discount_percent || 0),
        Number(quoteData.tax_percent || 0),
      );

      const payload = buildModuleCreatePayload<QuoteInsert>(
        {
          account_id: quoteData.account_id || null,
          contact_id: quoteData.contact_id || null,
          opportunity_id: quoteData.opportunity_id || null,
          status: quoteData.status || "draft",
          expiration_date: quoteData.valid_until || null,
          payment_terms: quoteData.terms,
          notes: quoteData.notes,
          subtotal: computed.subtotal,
          discount_percent: quoteData.discount_percent || 0,
          discount_amount: computed.discountAmount,
          tax_percent: quoteData.tax_percent || 0,
          tax_amount: computed.taxAmount,
          total_amount: computed.totalAmount,
          quote_number: quoteData.quote_number || `QT-${Date.now()}`,
        },
        scope,
      );

      const { data, error } = await supabase.from("quotes").insert(payload).select().single();
      if (error) throw error;

      if (items && items.length > 0) {
        const { organizationId: requiredOrganizationId } = requireOrganizationScope(scope);
        const itemPayload: QuoteLineItemInsert[] = items.map((item, index) => ({
          quote_id: data.id,
          organization_id: requiredOrganizationId,
          tenant_id: requiredOrganizationId,
          product_id: item.product_id,
          product_name: item.product_name,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_percent: item.discount_percent,
          total: calculateQuoteItemTotal(item),
          sort_order: index,
        }));

        const itemsResult = await supabase.from("quote_line_items").insert(itemPayload);
        if (itemsResult.error) throw itemsResult.error;
      }

      void safeWriteAuditLog({
        action: "quote_create",
        entityType: "quote",
        entityId: data.id,
        tenantId,
        userId,
        newValues: data,
      });

      return {
        ...data,
        total: data.total_amount,
        valid_until: data.expiration_date,
      } as Quote;
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
      // Validate status transition before building payload.
      if (updates.status !== undefined) {
        const { data: currentQuote } = await applyModuleReadScope(
          supabase.from("quotes").select("status").eq("id", id),
          scope,
          { ownerColumns: ["owner_id"], hasSoftDelete: false },
        ).single();

        if (currentQuote) {
          validateQuoteStatusTransition(currentQuote.status ?? "draft", updates.status);
        }
      }

      const payload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      const shouldRecomputeTotals =
        updates.discount_percent !== undefined ||
        updates.tax_percent !== undefined;

      if (updates.status !== undefined) payload.status = updates.status;
      if (updates.valid_until !== undefined) payload.expiration_date = updates.valid_until;
      if (updates.terms !== undefined) payload.payment_terms = updates.terms;
      if (updates.notes !== undefined) payload.notes = updates.notes;
      if (updates.account_id !== undefined) payload.account_id = updates.account_id;
      if (updates.contact_id !== undefined) payload.contact_id = updates.contact_id;
      if (updates.opportunity_id !== undefined) payload.opportunity_id = updates.opportunity_id;
      if (updates.discount_percent !== undefined) payload.discount_percent = updates.discount_percent;
      if (updates.tax_percent !== undefined) payload.tax_percent = updates.tax_percent;

      const scopedQuery = applyModuleMutationScope(
        supabase.from("quotes").update(payload).eq("id", id),
        scope,
        ["owner_id"],
      );

      const { data, error } = await scopedQuery.select().single();
      if (error) throw error;

      if (shouldRecomputeTotals) {
        const { error: recomputeError } = await supabase.rpc("recompute_quote_totals", { p_quote_id: id });
        if (recomputeError) throw recomputeError;
      }

      void safeWriteAuditLog({
        action: "quote_update",
        entityType: "quote",
        entityId: id,
        tenantId,
        userId,
        newValues: payload,
      });

      return {
        ...data,
        total: data.total_amount,
        valid_until: data.expiration_date,
      } as Quote;
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

export function useDeleteQuote() {
  const queryClient = useQueryClient();
  const { scope, tenantId, userId } = useModuleScope();

  return useMutation({
    mutationFn: async (id: string) => {
      const { organizationId: requiredOrganizationId } = requireOrganizationScope(scope);
      const quoteAccessResult = await applyModuleReadScope(
        supabase.from("quotes").select("id").eq("id", id),
        scope,
        { ownerColumns: ["owner_id"], hasSoftDelete: false },
      ).maybeSingle();
      if (quoteAccessResult.error || !quoteAccessResult.data) {
        throw new Error("Quote not found or not accessible");
      }

      const { error: childError } = await supabase
        .from("quote_line_items")
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: userId,
        })
        .eq("quote_id", id)
        .eq("organization_id", requiredOrganizationId)
        .is("deleted_at", null);
      if (childError) throw childError;

      const deleted = await softDeleteRecord({
        table: "quotes",
        id,
        userId,
        organizationId: tenantId || "",
      });
      if (!deleted) throw new Error("Failed to delete quote");

      void safeWriteAuditLog({
        action: "quote_delete",
        entityType: "quote",
        entityId: id,
        tenantId,
        userId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      toast.success("Quote moved to recycle bin");
    },
    onError: (error: unknown) => {
      toast.error("Error deleting quote: " + getErrorMessage(error));
    },
  });
}

// ===== QUOTE ITEMS =====
export function useQuoteItems(quoteId: string) {
  const { scope, enabled, tenantId, userId } = useModuleScope();

  return useQuery({
    queryKey: ["quote_line_items", quoteId, tenantId, userId],
    enabled: enabled && Boolean(quoteId),
    queryFn: async () => {
      const { organizationId: requiredOrganizationId, userId: requiredUserId } = requireOrganizationScope(scope);
      let query = supabase
        .from("quote_line_items")
        .select("*, quote:quotes!inner(id, organization_id, owner_id)")
        .eq("quote_id", quoteId)
        .eq("quote.organization_id", requiredOrganizationId)
        .is("deleted_at", null);

      if (!canReadAllTenantRows(scope.role) && isOwnerScopedRole(scope.role)) {
        query = query.eq("quote.owner_id", requiredUserId);
      }

      const { data, error } = await query.order("sort_order");

      if (error) throw error;
      return (data ?? []) as QuoteItem[];
    },
  });
}

export function useCreateQuoteItem() {
  const queryClient = useQueryClient();
  const { scope, tenantId, userId } = useModuleScope();

  return useMutation({
    mutationFn: async (item: Omit<Partial<QuoteItem>, "id" | "created_at" | "updated_at">) => {
      const quoteId = item.quote_id || "";
      const quoteAccessResult = await applyModuleReadScope(
        supabase.from("quotes").select("id").eq("id", quoteId),
        scope,
        { ownerColumns: ["owner_id"], hasSoftDelete: false },
      ).maybeSingle();
      if (quoteAccessResult.error || !quoteAccessResult.data) {
        throw new Error("Quote not found or not accessible");
      }

      const { organizationId: requiredOrganizationId } = requireOrganizationScope(scope);
      const { data, error } = await supabase
        .from("quote_line_items")
        .insert({
          quote_id: quoteId,
          organization_id: requiredOrganizationId,
          tenant_id: requiredOrganizationId,
          product_id: item.product_id || null,
          product_name: item.product_name || "",
          description: item.description,
          quantity: item.quantity || 1,
          unit_price: item.unit_price || 0,
          discount_percent: item.discount_percent || 0,
          total: calculateQuoteItemTotal(item),
          sort_order: item.sort_order || 0,
        })
        .select()
        .single();

      if (error) throw error;

      // Totals are recomputed by database trigger.

      void safeWriteAuditLog({
        action: "quote_item_create",
        entityType: "quote_item",
        entityId: data.id,
        tenantId,
        userId,
        newValues: data,
      });

      return data as QuoteItem;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["quote_line_items", variables.quote_id] });
      toast.success("Quote item added successfully");
    },
    onError: (error: unknown) => {
      toast.error("Error adding quote item: " + getErrorMessage(error));
    },
  });
}

export function useUpdateQuoteItem() {
  const queryClient = useQueryClient();
  const { scope, tenantId, userId } = useModuleScope();

  return useMutation({
    mutationFn: async ({ id, quoteId, ...updates }: Partial<QuoteItem> & { id: string; quoteId: string }) => {
      const { organizationId: requiredOrganizationId, userId: requiredUserId } = requireOrganizationScope(scope);
      let currentItemQuery = supabase
        .from("quote_line_items")
        .select("id, quantity, unit_price, discount_percent, quote:quotes!inner(id, organization_id, owner_id)")
        .eq("id", id)
        .eq("quote_id", quoteId)
        .eq("organization_id", requiredOrganizationId)
        .eq("quote.organization_id", requiredOrganizationId);

      if (!canReadAllTenantRows(scope.role) && isOwnerScopedRole(scope.role)) {
        currentItemQuery = currentItemQuery.eq("quote.owner_id", requiredUserId);
      }

      const { data: currentItem, error: currentItemError } = await currentItemQuery.single();
      if (currentItemError || !currentItem) {
        throw currentItemError || new Error("Quote item not found or not accessible");
      }

      const payload: Record<string, unknown> = {};
      if (updates.product_id !== undefined) payload.product_id = updates.product_id;
      if (updates.product_name !== undefined) payload.product_name = updates.product_name;
      if (updates.description !== undefined) payload.description = updates.description;
      if (updates.quantity !== undefined) payload.quantity = updates.quantity;
      if (updates.unit_price !== undefined) payload.unit_price = updates.unit_price;
      if (updates.discount_percent !== undefined) payload.discount_percent = updates.discount_percent;

      // Recompute total if quantity, unit_price, or discount_percent changed
      if (
        updates.quantity !== undefined ||
        updates.unit_price !== undefined ||
        updates.discount_percent !== undefined
      ) {
        const mergedItem = {
          quantity: updates.quantity ?? currentItem.quantity ?? 0,
          unit_price: updates.unit_price ?? currentItem.unit_price ?? 0,
          discount_percent: updates.discount_percent ?? currentItem.discount_percent ?? 0,
        };

        payload.total = calculateQuoteItemTotal(mergedItem);
      }

      if (updates.sort_order !== undefined) payload.sort_order = updates.sort_order;

      const { data, error } = await supabase
        .from("quote_line_items")
        .update(payload)
        .eq("id", id)
        .eq("organization_id", requiredOrganizationId)
        .select()
        .single();

      if (error) throw error;

      // Totals are recomputed by database trigger.

      void safeWriteAuditLog({
        action: "quote_item_update",
        entityType: "quote_item",
        entityId: id,
        tenantId,
        userId,
        newValues: payload,
      });

      return data as QuoteItem;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["quote_line_items", variables.quoteId] });
      toast.success("Quote item updated successfully");
    },
    onError: (error: unknown) => {
      toast.error("Error updating quote item: " + getErrorMessage(error));
    },
  });
}

export function useDeleteQuoteItem() {
  const queryClient = useQueryClient();
  const { scope, tenantId, userId } = useModuleScope();

  return useMutation({
    mutationFn: async ({ id, quoteId }: { id: string; quoteId: string }) => {
      const { organizationId: requiredOrganizationId, userId: requiredUserId } = requireOrganizationScope(scope);
      let accessQuery = supabase
        .from("quote_line_items")
        .select("id, quote:quotes!inner(id, organization_id, owner_id)")
        .eq("id", id)
        .eq("quote_id", quoteId)
        .eq("organization_id", requiredOrganizationId)
        .eq("quote.organization_id", requiredOrganizationId);

      if (!canReadAllTenantRows(scope.role) && isOwnerScopedRole(scope.role)) {
        accessQuery = accessQuery.eq("quote.owner_id", requiredUserId);
      }

      const { data: accessibleItem, error: accessError } = await accessQuery.maybeSingle();
      if (accessError || !accessibleItem) {
        throw accessError || new Error("Quote item not found or not accessible");
      }

      const { error: deleteError } = await supabase
        .from("quote_line_items")
        .delete()
        .eq("id", id)
        .eq("organization_id", requiredOrganizationId);

      if (deleteError) throw new Error("Failed to delete quote item");

      // Totals are recomputed by database trigger.

      void safeWriteAuditLog({
        action: "quote_item_delete",
        entityType: "quote_item",
        entityId: id,
        tenantId,
        userId,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["quote_line_items", variables.quoteId] });
      toast.success("Quote item moved to recycle bin");
    },
    onError: (error: unknown) => {
      toast.error("Error deleting quote item: " + getErrorMessage(error));
    },
  });
}

// ===== UPDATE QUOTE STATUS =====
export function useUpdateQuoteStatus() {
  const queryClient = useQueryClient();
  const { scope, tenantId, userId } = useModuleScope();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: QuoteStatus }) => {
      // First fetch current status to validate transition
      const readQuery = applyModuleReadScope(
        supabase.from("quotes").select("id, status").eq("id", id),
        scope,
        { ownerColumns: ["owner_id"], hasSoftDelete: false },
      );

      const { data: existingQuote, error: readError } = await readQuery.single();
      if (readError || !existingQuote) throw readError || new Error("Quote not found");

      // Validate status transition
      const currentStatus = existingQuote.status ?? "draft";
      validateQuoteStatusTransition(currentStatus, status);

      // Now perform the update
      const scopedQuery = applyModuleMutationScope(
        supabase
          .from("quotes")
          .update({ status, updated_at: new Date().toISOString() })
          .eq("id", id),
        scope,
        ["owner_id"],
      );

      const { data, error } = await scopedQuery.select().single();
      if (error) throw error;

      void safeWriteAuditLog({
        action: "quote_status_update",
        entityType: "quote",
        entityId: id,
        tenantId,
        userId,
        metadata: { status },
      });

      return {
        ...data,
        total: data.total_amount,
        valid_until: data.expiration_date,
      } as Quote;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["quote", variables.id] });
      toast.success("Quote status updated successfully");
    },
    onError: (error: unknown) => {
      toast.error("Error updating quote status: " + getErrorMessage(error));
    },
  });
}


