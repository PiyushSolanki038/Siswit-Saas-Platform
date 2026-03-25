import { getErrorMessage } from "@/core/utils/errors";
import { useState } from "react";
import {
  Plus,
  Search,
  Loader2,
  ShoppingCart,
  MoreHorizontal,
  Pencil,
  Trash2,
  Calendar,
  AlertTriangle
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/core/api/client";
import { useAuth } from "@/core/auth/useAuth";
import { useCRUD } from "@/core/rbac/usePermissions";

// UI Components
import { Button } from "@/ui/shadcn/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/shadcn/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/shadcn/table";
import { Badge } from "@/ui/shadcn/badge";
import { Input } from "@/ui/shadcn/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/ui/shadcn/sheet";
import { Label } from "@/ui/shadcn/label";
import { useToast } from "@/core/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/ui/shadcn/dropdown-menu";

// NEW: Proper Alert System imports
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/ui/shadcn/alert-dialog";

interface PurchaseOrderRow {
  id: string;
  order_number: string;
  po_number?: string | null;
  vendor_id: string | null;
  total_amount: number | null;
  status: string;
  order_date: string | null;
  expected_delivery_date: string | null;
  accounts: { name: string } | null;
}

interface PurchaseOrderFormInput {
  id?: string;
  order_number: string;
  po_number?: string;
  vendor_id: string;
  total_amount: number;
  status: string;
  order_date: string;
  expected_delivery_date: string | null;
}

interface VendorOption {
  id: string;
  name: string;
}


// Status Colors Helper
const STATUS_STYLES: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 border-slate-200",
  pending: "bg-amber-100 text-amber-700 border-amber-200",
  ordered: "bg-blue-100 text-blue-700 border-blue-200",
  received: "bg-emerald-100 text-emerald-700 border-emerald-200",
  cancelled: "bg-red-100 text-red-700 border-red-200",
};
import { PlanLimitBanner } from "@/ui/plan-limit-banner";
import { ExportButton } from "@/ui/export-button";
import { useSearch } from "@/core/hooks/useSearch";
import { SearchBar } from "@/ui/search-bar";
import { FilterBar } from "@/ui/filter-bar";

const PO_FILTERS = [
  {
    key: "status",
    label: "Status",
    options: [
      { label: "Draft", value: "draft" },
      { label: "Submitted", value: "submitted" },
      { label: "Approved", value: "approved" },
      { label: "Received", value: "received" },
      { label: "Cancelled", value: "cancelled" },
    ],
  },
];

export default function ProcurementPage() {
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // State for managing Edit/Delete selections
  const [editingOrder, setEditingOrder] = useState<PurchaseOrderRow | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<PurchaseOrderRow | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const { canDelete } = useCRUD();

  // 1. FETCH DATA - UPDATED: Filter by current user
  const { data: orders, isLoading } = useQuery({
    queryKey: ["purchase-orders", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user?.id) throw new Error("User not authenticated");
      const { data, error } = await supabase
        .from("purchase_orders")
        .select(`*, accounts (name)`)
        .eq("created_by", user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // 2. CREATE / UPDATE MUTATION - UPDATED: Include user ID
  const upsertOrderMutation = useMutation({
    mutationFn: async (orderData: PurchaseOrderFormInput) => {
      // Clean up the object to remove UI-only fields if necessary
      const payload = { ...orderData, created_by: user?.id };

      if (payload.id) {
        // Update logic
        const { data, error } = await supabase
          .from("purchase_orders")
          .update(payload)
          .eq('id', payload.id)
          .select();
        if (error) throw error;
        return data;
      } else {
        // Insert logic
        const { data, error } = await supabase
          .from("purchase_orders")
          .insert([payload])
          .select();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      toast({
        title: editingOrder ? "Order Updated" : "Order Created",
        description: editingOrder ? "The purchase order details have been saved." : "New purchase order has been logged.",
        className: "bg-green-50 border-green-200"
      });
      setIsSheetOpen(false);
      setEditingOrder(null);
    },
    onError: (err: unknown) => {
      toast({
        title: "Operation Failed",
        description: getErrorMessage(err),
        variant: "destructive"
      });
    }
  });

  // 3. DELETE MUTATION
  const deleteOrderMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("purchase_orders").delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      toast({
        title: "Order Deleted",
        description: "The purchase order has been permanently removed.",
        variant: "default"
      });
      setOrderToDelete(null); // Close alert dialog
    },
    onError: (err: unknown) => {
      toast({
        title: "Delete Failed",
        description: getErrorMessage(err),
        variant: "destructive"
      });
    }
  });

  // Action Handlers
  const handleEditClick = (order: PurchaseOrderRow) => {
    setEditingOrder(order);
    setIsSheetOpen(true);
  };

  const handleCreateClick = () => {
    setEditingOrder(null);
    setIsSheetOpen(true);
  };

  const handleDeleteClick = (order: PurchaseOrderRow) => {
    setOrderToDelete(order); // This triggers the Alert Dialog to open
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { searchQuery, setSearchQuery, activeFilters, setFilter, clearFilters, filteredData, resultCount, totalCount, filterDefs } = useSearch<any>(orders ?? [], {
    searchFields: ["order_number", "status"],
    filterDefs: PO_FILTERS,
  });

  return (
    <div className="space-y-6">
      <PlanLimitBanner resource="suppliers" className="mb-4" />
      <PlanLimitBanner resource="purchase_orders" className="mb-4" />
      {/* Header Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl md:text-3xl font-semibold tracking-tight">Procurement</h1>
          <p className="text-sm text-muted-foreground">Manage vendor purchase orders and supply chain.</p>
        </div>

        {/* EDIT/CREATE SHEET */}
        <div className="flex items-center gap-2">
          <ExportButton data={orders ?? []} filename="siswit-purchase-orders" sheetName="Purchase Orders" isLoading={isLoading} />
          <Sheet open={isSheetOpen} onOpenChange={(open) => { setIsSheetOpen(open); if (!open) setEditingOrder(null); }}>
          <SheetTrigger asChild>
            <Button onClick={handleCreateClick} className="shadow-sm">
              <Plus className="h-4 w-4 mr-2" /> New Purchase Order
            </Button>
          </SheetTrigger>
          <SheetContent className="sm:max-w-md overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{editingOrder ? `Edit ${editingOrder.order_number}` : "New Purchase Order"}</SheetTitle>
              <SheetDescription>
                {editingOrder ? "Make changes to the existing order details." : "Fill out the details below to create a new PO."}
              </SheetDescription>
            </SheetHeader>
            <PurchaseOrderForm
              initialData={editingOrder}
              onSubmit={(data) => upsertOrderMutation.mutate(data)}
              isLoading={upsertOrderMutation.isPending}
            />
          </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search orders..." resultCount={resultCount} totalCount={totalCount} />
          <ExportButton data={filteredData} filename="siswit-purchase-orders" sheetName="Purchase Orders" isLoading={isLoading} />
        </div>
        <FilterBar filters={filterDefs} activeFilters={activeFilters} onFilterChange={setFilter} onClearAll={clearFilters} />
      </div>

      {/* DELETE ALERT DIALOG (The "Proper System") */}
      <AlertDialog open={!!orderToDelete} onOpenChange={(open) => !open && setOrderToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete Purchase Order?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete order <strong>{orderToDelete?.order_number}</strong>?
              <br /><br />
              This action cannot be undone and will remove all associated records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => orderToDelete && deleteOrderMutation.mutate(orderToDelete.id)}
            >
              {deleteOrderMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete Order"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Data Table */}

      <Card className="shadow-sm border-muted/60">
        <CardHeader className="bg-muted/10 pb-4">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            Recent Orders
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>
          ) : filteredData?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Search className="h-10 w-10 mb-2 opacity-20" />
              <p>No orders found.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Delivery Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData?.map((order: any) => (
                  <TableRow key={order.id} className="group hover:bg-muted/5">
                    <TableCell className="font-mono font-medium">{order.order_number}</TableCell>
                    <TableCell>{order.accounts?.name || "Unknown"}</TableCell>
                    <TableCell>
                      {order.expected_delivery_date ? (
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Calendar className="mr-1 h-3 w-3" />
                          {new Date(order.expected_delivery_date).toLocaleDateString()}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="font-semibold">${order.total_amount?.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_STYLES[order.status || "draft"] || ""}>
                        {order.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onClick={() => handleEditClick(order as unknown as PurchaseOrderRow)}>
                            <Pencil className="mr-2 h-4 w-4 text-muted-foreground" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {canDelete() && (
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600 focus:bg-red-50"
                            onClick={() => handleDeleteClick(order as unknown as PurchaseOrderRow)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// SECTION: Form Component
function PurchaseOrderForm({
  onSubmit,
  isLoading,
  initialData,
}: {
  onSubmit: (data: PurchaseOrderFormInput) => void;
  isLoading: boolean;
  initialData?: PurchaseOrderRow | null;
}) {
  const [formData, setFormData] = useState({
    order_number: initialData?.order_number || `PO-${Math.floor(1000 + Math.random() * 9000)}`,
    vendor_id: initialData?.vendor_id || "",
    total_amount: initialData?.total_amount || 0,
    status: initialData?.status || "ordered",
    order_date: initialData?.order_date ? new Date(initialData.order_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    expected_delivery_date: initialData?.expected_delivery_date ? new Date(initialData.expected_delivery_date).toISOString().split('T')[0] : ""
  });

  const { data: vendors } = useQuery({
    queryKey: ["vendors-list"],
    queryFn: async () => {
      const { data } = await supabase.from("accounts").select("id, name");
      return data;
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vendor_id) return;

    // We send 'order_number' AND 'po_number' to ensure backend compatibility
    const payload: PurchaseOrderFormInput = {
      order_number: formData.order_number,
      po_number: formData.order_number,
      vendor_id: formData.vendor_id,
      total_amount: formData.total_amount,
      status: formData.status,
      order_date: formData.order_date,
      expected_delivery_date: formData.expected_delivery_date || null
    };

    if (initialData?.id) {
      payload.id = initialData.id;
    }

    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 pt-6">
      <div className="space-y-2">
        <Label>Order Number</Label>
        <Input
          required
          value={formData.order_number}
          onChange={(e) => setFormData({ ...formData, order_number: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label>Vendor</Label>
        <select
          required
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={formData.vendor_id}
          onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value })}
        >
          <option value="">-- Select Vendor --</option>
          {(vendors as VendorOption[] | null)?.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Order Date</Label>
          <Input
            type="date"
            required
            value={formData.order_date}
            onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Delivery Date</Label>
          <Input
            type="date"
            value={formData.expected_delivery_date}
            onChange={(e) => setFormData({ ...formData, expected_delivery_date: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Total Amount ($)</Label>
        <Input
          type="number"
          step="0.01"
          required
          placeholder="0.00"
          value={formData.total_amount}
          onChange={(e) => setFormData({ ...formData, total_amount: parseFloat(e.target.value) })}
        />
      </div>

      <div className="space-y-2">
        <Label>Status</Label>
        <select
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={formData.status}
          onChange={(e) => setFormData({ ...formData, status: e.target.value })}
        >
          <option value="draft">Draft</option>
          <option value="pending">Pending</option>
          <option value="ordered">Ordered</option>
          <option value="received">Received</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <Button type="submit" className="w-full h-11" disabled={isLoading || !formData.vendor_id}>
        {isLoading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : (initialData ? "Save Changes" : "Create Order")}
      </Button>
    </form>
  );
}

