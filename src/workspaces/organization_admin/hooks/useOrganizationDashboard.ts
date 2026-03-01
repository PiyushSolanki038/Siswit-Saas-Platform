import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../../core/api/client";
import { useTenant } from "../../../core/tenant/useTenant";

export function useOrganizationDashboard() {
    const { tenant } = useTenant();
    const tenantId = tenant?.id;

    return useQuery({
        queryKey: ["organization-dashboard", tenantId],
        queryFn: async () => {
            if (!tenantId) throw new Error("No tenant ID");

            const [
                { count: leadsCount },
                { count: contractsCount },
                { count: quotesCount },
                { count: ordersCount },
                { data: recentOpportunities },
                { data: recentContracts },
                { data: recentActivities },
                { data: recentLeads },
                { data: auditLogs },
                { data: allLeads },
                { data: allContracts },
                { data: allQuotes },
            ] = (await Promise.all([
                supabase.from("leads").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId),
                supabase.from("contracts").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId),
                supabase.from("quotes").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId),
                supabase.from("purchase_orders").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId),

                supabase.from("opportunities")
                    .select("id, name, stage, amount, close_date")
                    .eq("tenant_id", tenantId)
                    .order("created_at", { ascending: false })
                    .limit(4),

                supabase.from("contracts")
                    .select("id, name, status, total_value, end_date")
                    .eq("tenant_id", tenantId)
                    .order("created_at", { ascending: false })
                    .limit(4),

                supabase.from("activities")
                    .select("id, subject, type, start_time, assigned_to_id")
                    .eq("tenant_id", tenantId)
                    .order("start_time", { ascending: false })
                    .limit(4),

                supabase.from("leads")
                    .select("id, first_name, last_name, company, email, status, created_at")
                    .eq("tenant_id", tenantId)
                    .order("created_at", { ascending: false })
                    .limit(10),

                supabase.from("audit_logs")
                    .select("id, action, entity_type, created_at, user_id")
                    .eq("tenant_id", tenantId)
                    .order("created_at", { ascending: false })
                    .limit(5),

                // For charts
                supabase.from("leads").select("status, created_at").eq("tenant_id", tenantId),
                supabase.from("contracts").select("status, created_at").eq("tenant_id", tenantId),
                supabase.from("quotes").select("status, created_at").eq("tenant_id", tenantId),
            ])) as { data: Record<string, unknown>[] | null; count: number | null }[];

            return {
                kpis: {
                    leads: leadsCount || 0,
                    contracts: contractsCount || 0,
                    quotes: quotesCount || 0,
                    orders: ordersCount || 0,
                },
                lists: {
                    opportunities: recentOpportunities || [],
                    contracts: recentContracts || [],
                    activities: recentActivities || [],
                    leads: recentLeads || [],
                    auditLogs: auditLogs || [],
                },
                charts: {
                    leads: allLeads || [],
                    contracts: allContracts || [],
                    quotes: allQuotes || [],
                }
            };
        },
        enabled: !!tenantId,
    });
}
