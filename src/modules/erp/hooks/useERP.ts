import { getErrorMessage } from "@/core/utils/errors";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/core/api/client";
import type { Database } from "@/core/api/types";
import { useModuleScope } from "@/core/hooks/useModuleScope";
import type {
  FinancialRecord,
  InventoryItem,
  ProductionOrder,
  PurchaseOrder,
  PurchaseOrderItem,
  Supplier,
} from "@/core/types/erp";
import {
  applyModuleMutationScope,
  applyModuleReadScope,
  buildModuleCreatePayload,
  requireOrganizationScope,
  type ModuleScopeContext,
} from "@/core/utils/module-scope";
import { softDeleteRecord } from "@/core/utils/soft-delete";
import { safeWriteAuditLog } from "@/core/utils/audit";

type SupplierRow = Database["public"]["Tables"]["suppliers"]["Row"];
type SupplierInsert = Database["public"]["Tables"]["suppliers"]["Insert"];
type SupplierUpdate = Database["public"]["Tables"]["suppliers"]["Update"];

type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type ProductInsert = Database["public"]["Tables"]["products"]["Insert"];

type InventoryRow = Database["public"]["Tables"]["inventory_items"]["Row"];
type InventoryInsert = Database["public"]["Tables"]["inventory_items"]["Insert"];
type InventoryUpdate = Database["public"]["Tables"]["inventory_items"]["Update"];
type InventoryWithProduct = InventoryRow & { product: ProductRow | null };

type PurchaseOrderRow = Database["public"]["Tables"]["purchase_orders"]["Row"];
type PurchaseOrderInsert = Database["public"]["Tables"]["purchase_orders"]["Insert"];
type PurchaseOrderUpdate = Database["public"]["Tables"]["purchase_orders"]["Update"];
type PurchaseOrderWithSupplier = PurchaseOrderRow & { supplier: SupplierRow | null };

type PurchaseOrderItemRow = Database["public"]["Tables"]["purchase_order_items"]["Row"];
type PurchaseOrderItemInsert = Database["public"]["Tables"]["purchase_order_items"]["Insert"];

type ProductionOrderRow = Database["public"]["Tables"]["production_orders"]["Row"];
type ProductionOrderInsert = Database["public"]["Tables"]["production_orders"]["Insert"];
type ProductionOrderUpdate = Database["public"]["Tables"]["production_orders"]["Update"];
type ProductionOrderWithProduct = ProductionOrderRow & { product: ProductRow | null };

type FinancialRecordRow = Database["public"]["Tables"]["financial_records"]["Row"];
type FinancialRecordInsert = Database["public"]["Tables"]["financial_records"]["Insert"];
type FinancialRecordUpdate = Database["public"]["Tables"]["financial_records"]["Update"];


function mapSupplier(row: SupplierRow): Supplier {
  return {
    id: row.id,
    name: row.name,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    website: row.website ?? undefined,
    address: row.address ?? undefined,
    city: row.city ?? undefined,
    state: row.state ?? undefined,
    country: row.country ?? undefined,
    postal_code: row.zip ?? undefined,
    payment_terms: row.payment_terms ?? undefined,
    rating: row.rating ?? undefined,
    is_active: row.is_active ?? true,
    created_by: row.created_by ?? undefined,
    created_at: row.created_at ?? new Date().toISOString(),
    updated_at: row.updated_at ?? new Date().toISOString(),
  };
}

function mapInventoryItem(row: InventoryWithProduct): InventoryItem {
  const product = row.product;
  const quantityOnHand = row.quantity_on_hand ?? 0;
  const reorderPoint = row.reorder_point ?? null;
  let status: InventoryItem["status"] = "in_stock";
  if (quantityOnHand <= 0) status = "out_of_stock";
  else if (reorderPoint !== null && quantityOnHand <= reorderPoint) status = "low_stock";

  return {
    id: row.id,
    sku: product?.sku ?? `INV-${row.id.slice(0, 8)}`,
    name: product?.name ?? "Inventory Item",
    description: product?.description ?? undefined,
    category: product?.family ?? undefined,
    quantity_on_hand: row.quantity_on_hand ?? undefined,
    quantity_reserved: row.quantity_reserved ?? undefined,
    quantity_available: row.quantity_available ?? undefined,
    reorder_level: row.reorder_point ?? undefined,
    reorder_quantity: row.reorder_quantity ?? undefined,
    unit_cost: row.average_cost ?? product?.cost ?? undefined,
    warehouse_location: row.warehouse_location ?? undefined,
    status,
    created_at: row.created_at ?? new Date().toISOString(),
    updated_at: row.updated_at ?? new Date().toISOString(),
  };
}

function mapPurchaseOrder(row: PurchaseOrderWithSupplier): PurchaseOrder {
  return {
    id: row.id,
    po_number: row.po_number ?? undefined,
    supplier_id: row.supplier_id ?? "",
    status: (row.status ?? "draft") as PurchaseOrder["status"],
    order_date: row.order_date ?? undefined,
    due_date: row.expected_delivery_date ?? undefined,
    expected_delivery_date: row.expected_delivery_date ?? undefined,
    actual_delivery_date: row.actual_delivery_date ?? undefined,
    subtotal: row.subtotal ?? undefined,
    tax_amount: row.tax_amount ?? undefined,
    shipping_cost: row.shipping_amount ?? undefined,
    total: row.total_amount ?? undefined,
    notes: row.notes ?? undefined,
    created_by: row.created_by ?? undefined,
    created_at: row.created_at ?? new Date().toISOString(),
    updated_at: row.updated_at ?? new Date().toISOString(),
    supplier: row.supplier ? mapSupplier(row.supplier) : undefined,
  };
}

function mapPurchaseOrderItem(row: PurchaseOrderItemRow): PurchaseOrderItem {
  return {
    id: row.id,
    purchase_order_id: row.purchase_order_id ?? "",
    inventory_item_id: row.product_id ?? undefined,
    item_name: row.product_name ?? "Item",
    description: row.description ?? undefined,
    quantity: row.quantity_ordered ?? 0,
    unit_cost: row.unit_price ?? 0,
    total: row.total_price ?? undefined,
    created_at: row.created_at ?? new Date().toISOString(),
  };
}

function mapProductionOrder(row: ProductionOrderWithProduct): ProductionOrder {
  const product = row.product;

  return {
    id: row.id,
    production_order_number: row.order_number ?? undefined,
    inventory_item_id: row.product_id ?? undefined,
    status: (row.status ?? "planned") as ProductionOrder["status"],
    quantity_ordered: row.quantity_to_produce ?? undefined,
    quantity_produced: row.quantity_produced ?? undefined,
    start_date: row.start_date ?? undefined,
    due_date: row.end_date ?? undefined,
    completion_date: row.actual_end_date ?? undefined,
    notes: row.notes ?? undefined,
    created_by: row.created_by ?? undefined,
    created_at: row.created_at ?? new Date().toISOString(),
    updated_at: row.updated_at ?? new Date().toISOString(),
    inventory_item: product
      ? {
        id: product.id,
        sku: product.sku ?? "",
        name: product.name,
        quantity_on_hand: product.quantity_on_hand ?? undefined,
        quantity_reserved: product.quantity_reserved ?? undefined,
        quantity_available: product.quantity_available ?? undefined,
        created_at: product.created_at ?? new Date().toISOString(),
        updated_at: product.updated_at ?? new Date().toISOString(),
      }
      : undefined,
  };
}

function mapFinancialRecord(row: FinancialRecordRow): FinancialRecord {
  return {
    id: row.id,
    transaction_date: row.record_date ?? undefined,
    type: row.record_type as FinancialRecord["type"],
    category: row.category ?? undefined,
    description: row.description ?? undefined,
    amount: row.amount ?? undefined,
    reference_id: row.reference_number ?? undefined,
    reference_type: row.reference_type ?? undefined,
    status: row.status ?? undefined,
    notes: row.notes ?? undefined,
    created_by: row.created_by ?? undefined,
    created_at: row.created_at ?? new Date().toISOString(),
    updated_at: row.updated_at ?? new Date().toISOString(),
  };
}

async function ensurePurchaseOrderAccessible(purchaseOrderId: string, scope: ModuleScopeContext) {
  const query = supabase.from("purchase_orders").select("id").eq("id", purchaseOrderId);
  const scoped = applyModuleReadScope(query, scope, { ownerColumns: ["created_by"] });
  const result = await scoped.maybeSingle();
  if (result.error || !result.data) {
    throw new Error("Purchase order not found or not accessible");
  }
}

// ===== SUPPLIERS =====
export function useSuppliers() {
  const { scope, enabled, tenantId, userId } = useModuleScope();

  return useQuery({
    queryKey: ["suppliers", tenantId, userId],
    enabled,
    queryFn: async () => {
      const scopedQuery = applyModuleReadScope(
        supabase.from("suppliers").select("*"),
        scope,
        { ownerColumns: ["created_by"], hasSoftDelete: false },
      );

      const { data, error } = await scopedQuery.neq("is_active", false).order("name");
      if (error) throw error;

      return (data ?? []).map((row) => mapSupplier(row as SupplierRow));
    },
  });
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();
  const { scope, tenantId, userId } = useModuleScope();

  return useMutation({
    mutationFn: async (supplier: Omit<Partial<Supplier>, "id" | "created_at" | "updated_at">) => {
      const payload = buildModuleCreatePayload<SupplierInsert>(
        {
          name: supplier.name || "",
          email: supplier.email ?? null,
          phone: supplier.phone ?? null,
          website: supplier.website ?? null,
          address: supplier.address ?? null,
          city: supplier.city ?? null,
          state: supplier.state ?? null,
          country: supplier.country ?? null,
          zip: supplier.postal_code ?? null,
          payment_terms: supplier.payment_terms ?? null,
          rating: supplier.rating ?? null,
          is_active: supplier.is_active ?? true,
        },
        scope,
        { ownerColumn: "created_by" },
      );

      const { data, error } = await supabase.from("suppliers").insert(payload).select().single();
      if (error) throw error;

      void safeWriteAuditLog({
        action: "supplier_create",
        entityType: "supplier",
        entityId: data.id,
        tenantId,
        userId,
        newValues: data,
      });

      return mapSupplier(data as SupplierRow);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Supplier created successfully");
    },
    onError: (error: unknown) => {
      toast.error("Error creating supplier: " + getErrorMessage(error));
    },
  });
}

export function useUpdateSupplier() {
  const queryClient = useQueryClient();
  const { scope, tenantId, userId } = useModuleScope();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Supplier> & { id: string }) => {
      const payload: SupplierUpdate = {
        updated_at: new Date().toISOString(),
      };

      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.email !== undefined) payload.email = updates.email ?? null;
      if (updates.phone !== undefined) payload.phone = updates.phone ?? null;
      if (updates.website !== undefined) payload.website = updates.website ?? null;
      if (updates.address !== undefined) payload.address = updates.address ?? null;
      if (updates.city !== undefined) payload.city = updates.city ?? null;
      if (updates.state !== undefined) payload.state = updates.state ?? null;
      if (updates.country !== undefined) payload.country = updates.country ?? null;
      if (updates.postal_code !== undefined) payload.zip = updates.postal_code ?? null;
      if (updates.payment_terms !== undefined) payload.payment_terms = updates.payment_terms ?? null;
      if (updates.rating !== undefined) payload.rating = updates.rating ?? null;
      if (updates.is_active !== undefined) payload.is_active = updates.is_active ?? null;

      const scopedQuery = applyModuleMutationScope(
        supabase.from("suppliers").update(payload).eq("id", id),
        scope,
        ["created_by"],
      );

      const { data, error } = await scopedQuery.select().single();
      if (error) throw error;

      void safeWriteAuditLog({
        action: "supplier_update",
        entityType: "supplier",
        entityId: id,
        tenantId,
        userId,
        newValues: { ...payload },
      });

      return mapSupplier(data as SupplierRow);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Supplier updated successfully");
    },
    onError: (error: unknown) => {
      toast.error("Error updating supplier: " + getErrorMessage(error));
    },
  });
}

export function useDeleteSupplier() {
  const queryClient = useQueryClient();
  const { scope, tenantId, userId } = useModuleScope();

  return useMutation({
    mutationFn: async (id: string) => {
      const access = await applyModuleMutationScope(
        supabase.from("suppliers").select("id").eq("id", id),
        scope,
        ["created_by"],
      ).maybeSingle();

      if (access.error || !access.data) {
        throw new Error("Supplier not found or not accessible");
      }

      const deleted = await softDeleteRecord({
        table: "suppliers",
        id,
        userId,
        organizationId: tenantId || "",
      });
      if (!deleted) throw new Error("Failed to delete supplier");

      void safeWriteAuditLog({
        action: "supplier_delete",
        entityType: "supplier",
        entityId: id,
        tenantId,
        userId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Supplier moved to recycle bin");
    },
    onError: (error: unknown) => {
      toast.error("Error deleting supplier: " + getErrorMessage(error));
    },
  });
}

// ===== INVENTORY ITEMS =====
export function useInventoryItems() {
  const { scope, enabled, tenantId, userId } = useModuleScope();

  return useQuery({
    queryKey: ["inventory_items", tenantId, userId],
    enabled,
    queryFn: async () => {
      const scopedQuery = applyModuleReadScope(
        supabase.from("inventory_items").select("*, product:products(*)"),
        scope,
        { ownerColumns: [], hasSoftDelete: false },
      );

      const { data, error } = await scopedQuery.order("created_at", { ascending: false });
      if (error) throw error;

      return (data ?? []).map((row) => mapInventoryItem(row as InventoryWithProduct));
    },
  });
}

export function useCreateInventoryItem() {
  const queryClient = useQueryClient();
  const { scope, tenantId, userId } = useModuleScope();

  return useMutation({
    mutationFn: async (item: Omit<Partial<InventoryItem>, "id" | "created_at" | "updated_at" | "quantity_available">) => {
      const { organizationId: requiredOrganizationId } = requireOrganizationScope(scope);
      const itemWithOptionalProduct = item as Omit<typeof item, never> & { product_id?: string | null };
      let productId = itemWithOptionalProduct.product_id ?? null;

      if (!productId) {
        const productPayload = buildModuleCreatePayload<ProductInsert>(
          {
            name: item.name || "Inventory Product",
            sku: item.sku || `SKU-${Date.now()}`,
            description: item.description ?? null,
            family: item.category ?? null,
            list_price: item.unit_cost ?? 0,
            cost: item.unit_cost ?? 0,
            is_active: true,
          },
          scope,
          { ownerColumn: null },
        );

        const productResult = await supabase.from("products").insert(productPayload).select("id").single();
        if (productResult.error || !productResult.data) throw productResult.error ?? new Error("Failed to create product");
        productId = productResult.data.id;
      }

      const quantityOnHand = item.quantity_on_hand ?? 0;
      const quantityReserved = item.quantity_reserved ?? 0;

      const payload: InventoryInsert = {
        organization_id: requiredOrganizationId,
        product_id: productId,
        quantity_on_hand: quantityOnHand,
        quantity_reserved: quantityReserved,
        quantity_available: quantityOnHand - quantityReserved,
        reorder_point: item.reorder_level ?? null,
        reorder_quantity: item.reorder_quantity ?? null,
        average_cost: item.unit_cost ?? null,
        warehouse_location: item.warehouse_location ?? null,
      };

      const { data, error } = await supabase.from("inventory_items").insert(payload).select("*, product:products(*)").single();
      if (error) throw error;

      void safeWriteAuditLog({
        action: "inventory_item_create",
        entityType: "inventory_item",
        entityId: data.id,
        tenantId,
        userId,
        newValues: data,
      });

      return mapInventoryItem(data as InventoryWithProduct);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory_items"] });
      toast.success("Inventory item created successfully");
    },
    onError: (error: unknown) => {
      toast.error("Error creating inventory item: " + getErrorMessage(error));
    },
  });
}

export function useUpdateInventoryItem() {
  const queryClient = useQueryClient();
  const { scope, tenantId, userId } = useModuleScope();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<InventoryItem> & { id: string }) => {
      const payload: InventoryUpdate = {
        updated_at: new Date().toISOString(),
      };

      if (updates.quantity_on_hand !== undefined) payload.quantity_on_hand = updates.quantity_on_hand ?? null;
      if (updates.quantity_reserved !== undefined) payload.quantity_reserved = updates.quantity_reserved ?? null;
      if (updates.quantity_available !== undefined) payload.quantity_available = updates.quantity_available ?? null;
      if (updates.reorder_level !== undefined) payload.reorder_point = updates.reorder_level ?? null;
      if (updates.reorder_quantity !== undefined) payload.reorder_quantity = updates.reorder_quantity ?? null;
      if (updates.unit_cost !== undefined) payload.average_cost = updates.unit_cost ?? null;
      if (updates.warehouse_location !== undefined) payload.warehouse_location = updates.warehouse_location ?? null;

      const scopedQuery = applyModuleMutationScope(
        supabase.from("inventory_items").update(payload).eq("id", id),
        scope,
        [],
      );

      const { data, error } = await scopedQuery.select("*, product:products(*)").single();
      if (error) throw error;

      void safeWriteAuditLog({
        action: "inventory_item_update",
        entityType: "inventory_item",
        entityId: id,
        tenantId,
        userId,
        newValues: { ...payload },
      });

      return mapInventoryItem(data as InventoryWithProduct);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory_items"] });
      toast.success("Inventory item updated successfully");
    },
    onError: (error: unknown) => {
      toast.error("Error updating inventory item: " + getErrorMessage(error));
    },
  });
}

export function useDeleteInventoryItem() {
  const queryClient = useQueryClient();
  const { scope, tenantId, userId } = useModuleScope();

  return useMutation({
    mutationFn: async (id: string) => {
      const access = await applyModuleMutationScope(
        supabase.from("inventory_items").select("id").eq("id", id),
        scope,
        [],
      ).maybeSingle();

      if (access.error || !access.data) {
        throw new Error("Inventory item not found or not accessible");
      }

      const deleted = await softDeleteRecord({
        table: "inventory_items",
        id,
        userId,
        organizationId: tenantId || "",
      });
      if (!deleted) throw new Error("Failed to delete inventory item");

      void safeWriteAuditLog({
        action: "inventory_item_delete",
        entityType: "inventory_item",
        entityId: id,
        tenantId,
        userId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory_items"] });
      toast.success("Inventory item moved to recycle bin");
    },
    onError: (error: unknown) => {
      toast.error("Error deleting inventory item: " + getErrorMessage(error));
    },
  });
}

// ===== PURCHASE ORDERS =====
export function usePurchaseOrders() {
  const { scope, enabled, tenantId, userId } = useModuleScope();

  return useQuery({
    queryKey: ["purchase_orders", tenantId, userId],
    enabled,
    queryFn: async () => {
      const scopedQuery = applyModuleReadScope(
        supabase.from("purchase_orders").select("*, supplier:suppliers(*)"),
        scope,
        { ownerColumns: ["created_by"] },
      );

      const { data, error } = await scopedQuery.order("created_at", { ascending: false });
      if (error) throw error;

      return (data ?? []).map((row) => mapPurchaseOrder(row as PurchaseOrderWithSupplier));
    },
  });
}

export function usePurchaseOrder(id: string) {
  const { scope, enabled, tenantId, userId } = useModuleScope();

  return useQuery({
    queryKey: ["purchase_order", id, tenantId, userId],
    enabled: enabled && Boolean(id),
    queryFn: async () => {
      const scopedQuery = applyModuleReadScope(
        supabase.from("purchase_orders").select("*, supplier:suppliers(*)").eq("id", id),
        scope,
        { ownerColumns: ["created_by"] },
      );

      const { data, error } = await scopedQuery.single();
      if (error) throw error;

      const { organizationId: requiredOrganizationId } = requireOrganizationScope(scope);
      const { data: items, error: itemsError } = await supabase
        .from("purchase_order_items")
        .select("*")
        .eq("purchase_order_id", id)
        .eq("organization_id", requiredOrganizationId)
        .is("deleted_at", null)
        .order("created_at");
      if (itemsError) throw itemsError;

      return {
        ...mapPurchaseOrder(data as PurchaseOrderWithSupplier),
        items: (items ?? []).map((item) => mapPurchaseOrderItem(item as PurchaseOrderItemRow)),
      } as PurchaseOrder;
    },
  });
}

export function useCreatePurchaseOrder() {
  const queryClient = useQueryClient();
  const { scope, tenantId, userId } = useModuleScope();

  return useMutation({
    mutationFn: async (po: Omit<Partial<PurchaseOrder>, "id" | "created_at" | "updated_at">) => {
      const payload = buildModuleCreatePayload<PurchaseOrderInsert>(
        {
          po_number: po.po_number || `PO-${Date.now()}`,
          supplier_id: po.supplier_id || null,
          status: po.status ?? "draft",
          order_date: po.order_date ?? new Date().toISOString(),
          expected_delivery_date: po.expected_delivery_date ?? po.due_date ?? null,
          payment_terms: po.notes ?? null,
          notes: po.notes ?? null,
          subtotal: po.subtotal ?? 0,
          tax_amount: po.tax_amount ?? 0,
          shipping_amount: po.shipping_cost ?? 0,
          total_amount: po.total ?? 0,
        },
        scope,
        { ownerColumn: "created_by" },
      );

      const { data, error } = await supabase.from("purchase_orders").insert(payload).select("*, supplier:suppliers(*)").single();
      if (error) throw error;

      void safeWriteAuditLog({
        action: "purchase_order_create",
        entityType: "purchase_order",
        entityId: data.id,
        tenantId,
        userId,
        newValues: data,
      });

      return mapPurchaseOrder(data as PurchaseOrderWithSupplier);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });
      toast.success("Purchase order created successfully");
    },
    onError: (error: unknown) => {
      toast.error("Error creating purchase order: " + getErrorMessage(error));
    },
  });
}

export function useUpdatePurchaseOrder() {
  const queryClient = useQueryClient();
  const { scope, tenantId, userId } = useModuleScope();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PurchaseOrder> & { id: string }) => {
      const payload: PurchaseOrderUpdate = {
        updated_at: new Date().toISOString(),
      };

      if (updates.po_number !== undefined) payload.po_number = updates.po_number;
      if (updates.supplier_id !== undefined) payload.supplier_id = updates.supplier_id ?? null;
      if (updates.status !== undefined) payload.status = updates.status ?? null;
      if (updates.order_date !== undefined) payload.order_date = updates.order_date ?? null;
      if (updates.expected_delivery_date !== undefined || updates.due_date !== undefined) {
        payload.expected_delivery_date = updates.expected_delivery_date ?? updates.due_date ?? null;
      }
      if (updates.subtotal !== undefined) payload.subtotal = updates.subtotal ?? null;
      if (updates.tax_amount !== undefined) payload.tax_amount = updates.tax_amount ?? null;
      if (updates.shipping_cost !== undefined) payload.shipping_amount = updates.shipping_cost ?? null;
      if (updates.total !== undefined) payload.total_amount = updates.total ?? null;
      if (updates.notes !== undefined) payload.notes = updates.notes ?? null;

      const scopedQuery = applyModuleMutationScope(
        supabase.from("purchase_orders").update(payload).eq("id", id),
        scope,
        ["created_by"],
      );

      const { data, error } = await scopedQuery.select("*, supplier:suppliers(*)").single();
      if (error) throw error;

      void safeWriteAuditLog({
        action: "purchase_order_update",
        entityType: "purchase_order",
        entityId: id,
        tenantId,
        userId,
        newValues: { ...payload },
      });

      return mapPurchaseOrder(data as PurchaseOrderWithSupplier);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });
      queryClient.invalidateQueries({ queryKey: ["purchase_order"] });
      toast.success("Purchase order updated successfully");
    },
    onError: (error: unknown) => {
      toast.error("Error updating purchase order: " + getErrorMessage(error));
    },
  });
}

export function useDeletePurchaseOrder() {
  const queryClient = useQueryClient();
  const { scope, tenantId, userId } = useModuleScope();

  return useMutation({
    mutationFn: async (id: string) => {
      await ensurePurchaseOrderAccessible(id, scope);

      const childResult = await supabase
        .from("purchase_order_items")
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: userId,
        })
        .eq("purchase_order_id", id)
        .is("deleted_at", null);
      if (childResult.error) throw childResult.error;

      const deleted = await softDeleteRecord({
        table: "purchase_orders",
        id,
        userId,
        organizationId: tenantId || "",
      });
      if (!deleted) throw new Error("Failed to delete purchase order");

      void safeWriteAuditLog({
        action: "purchase_order_delete",
        entityType: "purchase_order",
        entityId: id,
        tenantId,
        userId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });
      toast.success("Purchase order moved to recycle bin");
    },
    onError: (error: unknown) => {
      toast.error("Error deleting purchase order: " + getErrorMessage(error));
    },
  });
}

// ===== PURCHASE ORDER ITEMS =====
export function useCreatePurchaseOrderItem() {
  const queryClient = useQueryClient();
  const { scope, tenantId, userId } = useModuleScope();

  return useMutation({
    mutationFn: async (item: {
      purchase_order_id: string;
      item_name: string;
      unit_cost: number;
      quantity?: number;
      inventory_item_id?: string;
      description?: string;
    }) => {
      await ensurePurchaseOrderAccessible(item.purchase_order_id, scope);
      const { organizationId: requiredOrganizationId } = requireOrganizationScope(scope);
      const quantity = item.quantity ?? 1;
      const unitCost = item.unit_cost ?? 0;

      const payload: PurchaseOrderItemInsert = {
        purchase_order_id: item.purchase_order_id,
        organization_id: requiredOrganizationId,
        tenant_id: requiredOrganizationId,
        product_id: item.inventory_item_id ?? null,
        product_name: item.item_name,
        description: item.description ?? null,
        quantity_ordered: quantity,
        unit_price: unitCost,
        total_price: quantity * unitCost,
      };

      const { data, error } = await supabase.from("purchase_order_items").insert(payload).select().single();
      if (error) throw error;

      void safeWriteAuditLog({
        action: "purchase_order_item_create",
        entityType: "purchase_order_item",
        entityId: data.id,
        tenantId,
        userId,
        newValues: data,
      });

      return mapPurchaseOrderItem(data as PurchaseOrderItemRow);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });
      queryClient.invalidateQueries({ queryKey: ["purchase_order"] });
      toast.success("Purchase order item added successfully");
    },
    onError: (error: unknown) => {
      toast.error("Error adding purchase order item: " + getErrorMessage(error));
    },
  });
}

export function useDeletePurchaseOrderItem() {
  const queryClient = useQueryClient();
  const { scope, tenantId, userId } = useModuleScope();

  return useMutation({
    mutationFn: async (id: string) => {
      const itemResult = await supabase
        .from("purchase_order_items")
        .select("id, purchase_order_id")
        .eq("id", id)
        .eq("organization_id", tenantId || "") // S-10: scope to current org
        .maybeSingle();

      if (itemResult.error || !itemResult.data) {
        throw new Error("Purchase order item not found");
      }

      await ensurePurchaseOrderAccessible(itemResult.data.purchase_order_id ?? "", scope);

      const deleted = await softDeleteRecord({
        table: "purchase_order_items",
        id,
        userId,
        organizationId: tenantId || "",
      });
      if (!deleted) throw new Error("Failed to delete purchase order item");

      void safeWriteAuditLog({
        action: "purchase_order_item_delete",
        entityType: "purchase_order_item",
        entityId: id,
        tenantId,
        userId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });
      queryClient.invalidateQueries({ queryKey: ["purchase_order"] });
      toast.success("Purchase order item moved to recycle bin");
    },
    onError: (error: unknown) => {
      toast.error("Error removing purchase order item: " + getErrorMessage(error));
    },
  });
}

// ===== PRODUCTION ORDERS =====
export function useProductionOrders() {
  const { scope, enabled, tenantId, userId } = useModuleScope();

  return useQuery({
    queryKey: ["production_orders", tenantId, userId],
    enabled,
    queryFn: async () => {
      const scopedQuery = applyModuleReadScope(
        supabase.from("production_orders").select("*, product:products(*)"),
        scope,
        { ownerColumns: ["created_by"], hasSoftDelete: false },
      );

      const { data, error } = await scopedQuery.order("created_at", { ascending: false });
      if (error) throw error;

      return (data ?? []).map((row) => mapProductionOrder(row as ProductionOrderWithProduct));
    },
  });
}

export function useCreateProductionOrder() {
  const queryClient = useQueryClient();
  const { scope, tenantId, userId } = useModuleScope();

  return useMutation({
    mutationFn: async (order: Omit<Partial<ProductionOrder>, "id" | "created_at" | "updated_at">) => {
      const payload = buildModuleCreatePayload<ProductionOrderInsert>(
        {
          order_number: order.production_order_number || `PROD-${Date.now()}`,
          product_id: order.inventory_item_id ?? null,
          status: order.status ?? "planned",
          quantity_to_produce: order.quantity_ordered ?? 0,
          quantity_produced: order.quantity_produced ?? 0,
          start_date: order.start_date ?? null,
          end_date: order.due_date ?? null,
          notes: order.notes ?? null,
        },
        scope,
        { ownerColumn: "created_by" },
      );

      const { data, error } = await supabase.from("production_orders").insert(payload).select("*, product:products(*)").single();
      if (error) throw error;

      void safeWriteAuditLog({
        action: "production_order_create",
        entityType: "production_order",
        entityId: data.id,
        tenantId,
        userId,
        newValues: data,
      });

      return mapProductionOrder(data as ProductionOrderWithProduct);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production_orders"] });
      toast.success("Production order created successfully");
    },
    onError: (error: unknown) => {
      toast.error("Error creating production order: " + getErrorMessage(error));
    },
  });
}

export function useUpdateProductionOrder() {
  const queryClient = useQueryClient();
  const { scope, tenantId, userId } = useModuleScope();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ProductionOrder> & { id: string }) => {
      const payload: ProductionOrderUpdate = {
        updated_at: new Date().toISOString(),
      };

      if (updates.production_order_number !== undefined) payload.order_number = updates.production_order_number;
      if (updates.inventory_item_id !== undefined) payload.product_id = updates.inventory_item_id ?? null;
      if (updates.status !== undefined) payload.status = updates.status ?? null;
      if (updates.quantity_ordered !== undefined) payload.quantity_to_produce = updates.quantity_ordered ?? null;
      if (updates.quantity_produced !== undefined) payload.quantity_produced = updates.quantity_produced ?? null;
      if (updates.start_date !== undefined) payload.start_date = updates.start_date ?? null;
      if (updates.due_date !== undefined) payload.end_date = updates.due_date ?? null;
      if (updates.completion_date !== undefined) payload.actual_end_date = updates.completion_date ?? null;
      if (updates.notes !== undefined) payload.notes = updates.notes ?? null;

      const scopedQuery = applyModuleMutationScope(
        supabase.from("production_orders").update(payload).eq("id", id),
        scope,
        ["created_by"],
      );

      const { data, error } = await scopedQuery.select("*, product:products(*)").single();
      if (error) throw error;

      void safeWriteAuditLog({
        action: "production_order_update",
        entityType: "production_order",
        entityId: id,
        tenantId,
        userId,
        newValues: { ...payload },
      });

      return mapProductionOrder(data as ProductionOrderWithProduct);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production_orders"] });
      toast.success("Production order updated successfully");
    },
    onError: (error: unknown) => {
      toast.error("Error updating production order: " + getErrorMessage(error));
    },
  });
}

export function useDeleteProductionOrder() {
  const queryClient = useQueryClient();
  const { scope, tenantId, userId } = useModuleScope();

  return useMutation({
    mutationFn: async (id: string) => {
      const access = await applyModuleMutationScope(
        supabase.from("production_orders").select("id").eq("id", id),
        scope,
        ["created_by"],
      ).maybeSingle();

      if (access.error || !access.data) {
        throw new Error("Production order not found or not accessible");
      }

      const deleted = await softDeleteRecord({
        table: "production_orders",
        id,
        userId,
        organizationId: tenantId || "",
      });
      if (!deleted) throw new Error("Failed to delete production order");

      void safeWriteAuditLog({
        action: "production_order_delete",
        entityType: "production_order",
        entityId: id,
        tenantId,
        userId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production_orders"] });
      toast.success("Production order moved to recycle bin");
    },
    onError: (error: unknown) => {
      toast.error("Error deleting production order: " + getErrorMessage(error));
    },
  });
}

// ===== FINANCIAL RECORDS =====
export function useFinancialRecords() {
  const { scope, enabled, tenantId, userId } = useModuleScope();

  return useQuery({
    queryKey: ["financial_records", tenantId, userId],
    enabled,
    queryFn: async () => {
      const scopedQuery = applyModuleReadScope(
        supabase.from("financial_records").select("*"),
        scope,
        { ownerColumns: ["created_by"], hasSoftDelete: false },
      );

      const { data, error } = await scopedQuery.order("record_date", { ascending: false });
      if (error) throw error;

      return (data ?? []).map((row) => mapFinancialRecord(row as FinancialRecordRow));
    },
  });
}

export function useCreateFinancialRecord() {
  const queryClient = useQueryClient();
  const { scope, tenantId, userId } = useModuleScope();

  return useMutation({
    mutationFn: async (record: Omit<Partial<FinancialRecord>, "id" | "created_at" | "updated_at">) => {
      const payload = buildModuleCreatePayload<FinancialRecordInsert>(
        {
          record_date: record.transaction_date ?? new Date().toISOString(),
          record_type: record.type ?? "expense",
          category: record.category ?? null,
          description: record.description ?? null,
          amount: record.amount ?? 0,
          reference_number: record.reference_id ?? null,
          status: record.reference_type ?? null,
          notes: record.notes ?? null,
        },
        scope,
        { ownerColumn: "created_by" },
      );

      const { data, error } = await supabase.from("financial_records").insert(payload).select().single();
      if (error) throw error;

      void safeWriteAuditLog({
        action: "financial_record_create",
        entityType: "financial_record",
        entityId: data.id,
        tenantId,
        userId,
        newValues: data,
      });

      return mapFinancialRecord(data as FinancialRecordRow);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial_records"] });
      toast.success("Financial record created successfully");
    },
    onError: (error: unknown) => {
      toast.error("Error creating financial record: " + getErrorMessage(error));
    },
  });
}

export function useUpdateFinancialRecord() {
  const queryClient = useQueryClient();
  const { scope, tenantId, userId } = useModuleScope();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<FinancialRecord> & { id: string }) => {
      const payload: FinancialRecordUpdate = {
        updated_at: new Date().toISOString(),
      };

      if (updates.transaction_date !== undefined) payload.record_date = updates.transaction_date ?? null;
      if (updates.type !== undefined) payload.record_type = updates.type ?? "expense";
      if (updates.category !== undefined) payload.category = updates.category ?? null;
      if (updates.description !== undefined) payload.description = updates.description ?? null;
      if (updates.amount !== undefined) payload.amount = updates.amount ?? 0;
      if (updates.reference_id !== undefined) payload.reference_number = updates.reference_id ?? null;
      if (updates.reference_type !== undefined) payload.status = updates.reference_type ?? null;
      if (updates.notes !== undefined) payload.notes = updates.notes ?? null;

      const scopedQuery = applyModuleMutationScope(
        supabase.from("financial_records").update(payload).eq("id", id),
        scope,
        ["created_by"],
      );

      const { data, error } = await scopedQuery.select().single();
      if (error) throw error;

      void safeWriteAuditLog({
        action: "financial_record_update",
        entityType: "financial_record",
        entityId: id,
        tenantId,
        userId,
        newValues: { ...payload },
      });

      return mapFinancialRecord(data as FinancialRecordRow);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial_records"] });
      toast.success("Financial record updated successfully");
    },
    onError: (error: unknown) => {
      toast.error("Error updating financial record: " + getErrorMessage(error));
    },
  });
}

export function useDeleteFinancialRecord() {
  const queryClient = useQueryClient();
  const { scope, tenantId, userId } = useModuleScope();

  return useMutation({
    mutationFn: async (id: string) => {
      const access = await applyModuleMutationScope(
        supabase.from("financial_records").select("id").eq("id", id),
        scope,
        ["created_by"],
      ).maybeSingle();

      if (access.error || !access.data) {
        throw new Error("Financial record not found or not accessible");
      }

      const deleted = await softDeleteRecord({
        table: "financial_records",
        id,
        userId,
        organizationId: tenantId || "",
      });
      if (!deleted) throw new Error("Failed to delete financial record");

      void safeWriteAuditLog({
        action: "financial_record_delete",
        entityType: "financial_record",
        entityId: id,
        tenantId,
        userId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial_records"] });
      toast.success("Financial record moved to recycle bin");
    },
    onError: (error: unknown) => {
      toast.error("Error deleting financial record: " + getErrorMessage(error));
    },
  });
}


