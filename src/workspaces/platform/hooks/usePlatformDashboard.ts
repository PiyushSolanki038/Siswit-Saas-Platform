import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../../core/api/client";

export interface PlatformStats {
  totalOrganizations: number;
  totalUsers: number;
  mrr: number;
  activeSessions: number;
}

export interface PlatformRecentOrganization {
  name: string;
  slug: string;
  plan: string;
  status: string;
  users: number;
}

export interface PlatformDashboardData {
  stats: PlatformStats;
  recentOrganizations: PlatformRecentOrganization[];
}

export function usePlatformDashboard() {
  return useQuery<PlatformDashboardData>({
    queryKey: ["platform-dashboard"],
    queryFn: async (): Promise<PlatformDashboardData> => {
      const [
        organizationsCount,
        usersCount,
        organizationsData,
        subscriptionsData
      ] = await Promise.all([
        supabase.from("organizations").select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("organizations")
          .select("name, slug, status, max_users")
          .order("created_at", { ascending: false })
          .limit(4),
        supabase.from("organization_subscriptions").select("plan_type, status")
      ]);

      // Map plan types to MRR values for platform estimation
      const planPricing: Record<string, number> = {
        'foundation': 799,
        'growth': 1399,
        'commercial': 2299,
        'enterprise': 3799,
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
        totalOrganizations: organizationsCount.count || 0,
        totalUsers: usersCount.count || 0,
        mrr: mrr,
        activeSessions: 0 // Requires real session tracking; do not fake
      };

      const recentOrganizations: PlatformRecentOrganization[] = (organizationsData.data || []).map(org => ({
        name: org.name || "Unnamed Organization",
        slug: org.slug || "",
        plan: "Foundation",
        status: org.status || "active",
        users: org.max_users || 0
      }));

      return { stats, recentOrganizations };
    },
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
  });
}
