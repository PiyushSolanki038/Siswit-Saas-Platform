import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/core/api/client";
import { useOrganization } from "@/workspaces/organization/hooks/useOrganization";
import { toast } from "sonner";

interface BillingInfo {
  customer_id: string | null;
  billing_email: string | null;
  billing_contact_name: string | null;
  plan_type: string | null;
  status: string | null;
  subscription_start_date: string | null;
  subscription_end_date: string | null;
}

export function useBillingInfo() {
  const { organization } = useOrganization();
  const organizationId = organization?.id;

  return useQuery({
    queryKey: ["billing_info", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      if (!organizationId) return null;

      const { data, error } = await (supabase.rpc as any)("get_billing_info", {
        p_organization_id: organizationId,
      });

      if (error) {
        console.error("Failed to fetch billing info:", error);
        throw error;
      }

      return (data as unknown as BillingInfo) ?? null;
    },
  });
}

export function useCreateBillingCustomer() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async ({ email, name }: { email: string; name: string }) => {
      if (!organization?.id) throw new Error("No organization");

      const { data, error } = await (supabase.rpc as any)("create_billing_customer", {
        p_organization_id: organization.id,
        p_email: email,
        p_name: name,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing_info"] });
      toast.success("Billing account created successfully");
    },
    onError: (error) => {
      toast.error("Failed to create billing account");
      console.error(error);
    },
  });
}
