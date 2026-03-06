import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../../core/api/client";
import { useTenant } from "../../../core/tenant/useTenant";

interface DashboardKPIs {
    leads: number;
    contracts: number;
    quotes: number;
    orders: number;
}

interface DashboardOpportunity {
    id: string;
    name: string | null;
    stage: string | null;
    amount: number | null;
    close_date: string | null;
}

interface DashboardContract {
    id: string;
    name: string | null;
    status: string | null;
    total_value: number | null;
    end_date: string | null;
}

interface DashboardActivity {
    id: string;
    subject: string | null;
    type: string | null;
    start_time: string | null;
    assigned_to_id: string | null;
}

interface DashboardLead {
    id: string;
    first_name: string | null;
    last_name: string | null;
    company: string | null;
    email: string | null;
    status: string | null;
    created_at: string | null;
}

interface DashboardAuditLog {
    id: string;
    action: string | null;
    entity_type: string | null;
    created_at: string | null;
    user_id: string | null;
}

interface DashboardChartItem {
    status: string | null;
    created_at: string | null;
}

export interface DashboardData {
    kpis: DashboardKPIs;
    lists: {
        opportunities: DashboardOpportunity[];
        contracts: DashboardContract[];
        activities: DashboardActivity[];
        leads: DashboardLead[];
        auditLogs: DashboardAuditLog[];
    };
    charts: {
        leads: DashboardChartItem[];
        contracts: DashboardChartItem[];
        quotes: DashboardChartItem[];
    };
}

export function useOrganizationDashboard() {
    const { tenant } = useTenant();
    const tenantId = tenant?.id;

    return useQuery<DashboardData>({
        queryKey: ["organization-dashboard", tenantId],
        queryFn: async (): Promise<DashboardData> => {
            if (!tenantId) throw new Error("No tenant ID");

            const [
                leadsCountResult,
                contractsCountResult,
                quotesCountResult,
                ordersCountResult,
                opportunitiesResult,
                contractsResult,
                activitiesResult,
                leadsResult,
                auditLogsResult,
                allLeadsResult,
                allContractsResult,
                allQuotesResult,
            ] = await Promise.all([
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
            ]);

            return {
                kpis: {
                    leads: leadsCountResult.count || 0,
                    contracts: contractsCountResult.count || 0,
                    quotes: quotesCountResult.count || 0,
                    orders: ordersCountResult.count || 0,
                },
                lists: {
                    opportunities: (opportunitiesResult.data || []) as unknown as DashboardOpportunity[],
                    contracts: (contractsResult.data || []) as unknown as DashboardContract[],
                    activities: (activitiesResult.data || []) as unknown as DashboardActivity[],
                    leads: (leadsResult.data || []) as unknown as DashboardLead[],
                    auditLogs: (auditLogsResult.data || []) as unknown as DashboardAuditLog[],
                },
                charts: {
                    leads: (allLeadsResult.data || []) as unknown as DashboardChartItem[],
                    contracts: (allContractsResult.data || []) as unknown as DashboardChartItem[],
                    quotes: (allQuotesResult.data || []) as unknown as DashboardChartItem[],
                }
            };
        },
        enabled: !!tenantId,
    });
}

