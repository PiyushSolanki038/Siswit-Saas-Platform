import { Package, Truck, BarChart3, DollarSign, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/shadcn/card";
import { Button } from "@/ui/shadcn/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/core/api/client";
import { useAuth } from "@/core/auth/useAuth";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { Link } from "react-router-dom";
import { StatsCard } from "@/modules/crm/components/StatsCard";
import { Badge } from "@/ui/shadcn/badge";

// Simplified types to avoid deep type instantiation errors
interface SimpleInventoryItem {
  id: string;
  quantity_on_hand: number;
  reorder_level: number | null;
  products: { unit_price: number } | null;
}

interface SimpleProductionOrder {
  id: string;
  status: string;
}

interface SimplePurchaseOrder {
  id: string;
  status: string;
  total_amount: number | null;
  order_number?: string;
  po_number?: string;
  accounts: { name: string } | null;
}

interface SimpleFinancialRecord {
  id: string;
  transaction_type: string;
  amount: number;
}

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--destructive))",
];

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  pending: "bg-warning/15 text-warning",
  planned: "bg-info/15 text-info",
  in_progress: "bg-info/15 text-info",
  ordered: "bg-primary/15 text-primary",
  completed: "bg-success/15 text-success",
  received: "bg-success/15 text-success",
  cancelled: "bg-destructive/15 text-destructive",
};

export default function ERPDashboard() {
  const { user } = useAuth();
  const { data: stats } = useQuery({
    queryKey: ["erp-stats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user?.id) throw new Error("User not authenticated");
      // 1. Fetch Inventory with Product details - UPDATED: Filter by user
      const { data: inventoryData } = await supabase
        .from("inventory_items")
        .select(`*, products(unit_price)`)
        .eq("created_by", user.id);

      // 2. Fetch Purchase Orders with Vendor names - UPDATED: Filter by user
      const { data: purchaseOrdersData } = await supabase
        .from("purchase_orders")
        .select(`*, accounts(name)`)
        .eq("created_by", user.id)
        .order('created_at', { ascending: false });

      // 3. Fetch Production Orders - UPDATED: Filter by user
      const { data: productionOrdersData } = await supabase
        .from("production_orders")
        .select("*")
        .eq("created_by", user.id);

      // 4. Fetch Financial Records - UPDATED: Filter by user
      const { data: financialRecordsData } = await supabase
        .from("financial_records")
        .select("*")
        .eq("created_by", user.id);

      // Type Casting
      const inventory = (inventoryData || []) as SimpleInventoryItem[];
      const production = (productionOrdersData || []) as SimpleProductionOrder[];
      const procurement = (purchaseOrdersData || []) as SimplePurchaseOrder[];
      const finance = (financialRecordsData || []) as SimpleFinancialRecord[];

      // --- Calculations ---
      const totalInventory = inventory.length;
      // Using 'quantity_on_hand' vs 'reorder_level'
      const lowStockItems = inventory.filter(item => item.quantity_on_hand <= (item.reorder_level || 0)).length;
      
      const inventoryValue = inventory.reduce((sum, item) => {
        const price = item.products?.unit_price || 0;
        return sum + (price * item.quantity_on_hand);
      }, 0);

      const totalRevenue = finance
        .filter(r => r.transaction_type === "income")
        .reduce((sum, r) => sum + Number(r.amount), 0);

      const totalProcurementValue = procurement
        .filter(po => po.status === "ordered" || po.status === "pending")
        .reduce((sum, po) => sum + Number(po.total_amount || 0), 0);

      const productionByStatus = {
        planned: production.filter(po => po.status === "planned").length,
        in_progress: production.filter(po => po.status === "in_progress").length,
        completed: production.filter(po => po.status === "completed").length,
        cancelled: production.filter(po => po.status === "cancelled").length,
      };

      return {
        totalInventory,
        lowStockItems,
        inventoryValue,
        totalProcurementValue,
        totalProduction: production.length,
        completedProduction: productionByStatus.completed,
        pendingProduction: productionByStatus.planned + productionByStatus.in_progress,
        totalRevenue,
        productionByStatus,
        recentOrders: procurement.slice(0, 5),
      };
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", { 
        style: "currency", 
        currency: "USD", 
        notation: "compact", 
        maximumFractionDigits: 1 
    }).format(value);
  };

  const productionStatusData = stats?.productionByStatus
    ? Object.entries(stats.productionByStatus).map(([status, count]) => ({
        name: status.replace(/_/g, " ").charAt(0).toUpperCase() + status.replace(/_/g, " ").slice(1),
        value: count,
      }))
    : [];

  return (
    <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <h1 className="text-xl md:text-3xl font-semibold">ERP Dashboard</h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Manage inventory, procurement, production, and finances
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
            <Button variant="outline" size="sm" asChild>
              <Link to="/dashboard/erp/inventory">Manage Inventory</Link>
            </Button>
            
            {/* FIX 1: Point to main page, not /new (since we use a Sheet now) */}
            <Button size="sm" asChild>
              <Link to="/dashboard/erp/procurement">View Purchase Orders</Link>
            </Button>
          </div>
        </div>

        {/* Top Row Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard title="Inventory Items" value={stats?.totalInventory || 0} icon={Package} />
          <StatsCard title="Inventory Value" value={formatCurrency(stats?.inventoryValue || 0)} icon={BarChart3} />
          <StatsCard title="Low Stock Alert" value={stats?.lowStockItems || 0} icon={AlertCircle} />
          <StatsCard title="Total Income" value={formatCurrency(stats?.totalRevenue || 0)} icon={DollarSign} />
        </div>

        {/* Secondary Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard title="Production Orders" value={stats?.totalProduction || 0} icon={BarChart3} />
          <StatsCard title="Completed" value={stats?.completedProduction || 0} icon={CheckCircle2} />
          <StatsCard title="Active/Planned" value={stats?.pendingProduction || 0} icon={Clock} />
          <StatsCard title="Procurement Pipeline" value={formatCurrency(stats?.totalProcurementValue || 0)} icon={Truck} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Pie Chart */}
          <Card>
            <CardHeader><CardTitle>Production Status</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={productionStatusData} 
                      cx="50%" 
                      cy="50%" 
                      innerRadius={60} 
                      outerRadius={100} 
                      paddingAngle={2} 
                      dataKey="value" 
                      // Simple label to avoid overlap issues
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {productionStatusData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Recent Purchase Orders */}
          <Card>
            <CardHeader><CardTitle>Recent Purchase Orders</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats?.recentOrders?.length ? (
                  stats.recentOrders.map((order: SimplePurchaseOrder) => (
                    <div key={order.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="font-medium">{order.accounts?.name || "Unknown Vendor"}</p>
                        
                        {/* FIX 2: Handle both potential column names */}
                        <p className="text-xs text-muted-foreground">
                            {order.order_number || order.po_number || "No ID"}
                        </p>
                        
                        <p className="text-sm font-semibold">{formatCurrency(order.total_amount || 0)}</p>
                      </div>
                      <Badge className={STATUS_COLORS[order.status] || "bg-secondary text-secondary-foreground"}>
                        {order.status}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-center py-10">No recent orders</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
  );
}
