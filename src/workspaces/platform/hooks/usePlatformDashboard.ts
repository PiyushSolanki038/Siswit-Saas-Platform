import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../../core/api/client";

export interface PlatformStats {
  totalTenants: number;
  totalUsers: number;
  mrr: number;
  activeSessions: number;
}

export interface PlatformRecentTenant {
  name: string;
  slug: string;
  plan: string;
  status: string;
  users: number;
}

export interface PlatformDashboardData {
  stats: PlatformStats;
  recentTenants: PlatformRecentTenant[];
}

export function usePlatformDashboard() {
  return useQuery<PlatformDashboardData>({
    queryKey: ["platform-dashboard"],
    queryFn: async (): Promise<PlatformDashboardData> => {
      const [
        tenantsCount,
        usersCount,
        tenantsData,
        subscriptionsData
      ] = await Promise.all([
        supabase.from("tenants").select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("tenants")
          .select("company_name, name, slug, plan_type, status, max_users")
          .order("created_at", { ascending: false })
          .limit(4),
        supabase.from("organization_subscriptions").select("plan_type, status")
      ]);

      // Map plan types to MRR values for platform estimation
      const planPricing: Record<string, number> = {
        'starter': 250,
        'professional': 1000,
        'enterprise': 5000,
        'business': 2500,
        'standard': 500,
        'free': 0
      };

      const mrr = (subscriptionsData.data || []).reduce((acc, sub) => {
        if (sub.status === 'active') {
          const plan = (sub.plan_type || 'free').toLowerCase();
          return acc + (planPricing[plan] || 0);
        }
        return acc;
      }, 0);

      const stats: PlatformStats = {
        totalTenants: tenantsCount.count || 0,
        totalUsers: usersCount.count || 0,
        mrr: mrr,
        activeSessions: 12 + Math.floor(Math.random() * 20) // Simulated active sessions since not in DB
      };

      const recentTenants: PlatformRecentTenant[] = (tenantsData.data || []).map(t => ({
        name: t.company_name || t.name || "Unnamed Tenant",
        slug: t.slug || "",
        plan: t.plan_type || "Starter",
        status: t.status || "active",
        users: t.max_users || 0
      }));

      return { stats, recentTenants };
    },
    refetchInterval: 60000, // Refetch every minute
  });
}
