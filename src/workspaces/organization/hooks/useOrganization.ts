import { useContext } from "react";
import { OrganizationContext, type OrganizationContextType } from "@/core/hooks/organization-context";
import { type ModuleType, type Organization } from "@/core/types/organization";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/core/api/client";
import { useAuth } from "@/core/auth/useAuth";
import { safeWriteAuditLog } from "@/core/utils/audit";
import { toast } from "sonner";

export function useOrganization() {
  const ctx = useContext(OrganizationContext) as OrganizationContextType;
  if (!ctx) {
    throw new Error("useOrganization must be used inside OrganizationProvider");
  }
  return ctx;
}

export function useUpdateOrganization() {
  const { organization, refreshOrganization } = useOrganization();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (updates: Partial<Organization>) => {
      if (!organization?.id) throw new Error("No active organization");

      const { error } = await supabase
        .from("organizations")
        .update(updates)
        .eq("id", organization.id);

      if (error) throw error;

      await refreshOrganization();

      if (user?.id) {
        void safeWriteAuditLog({
          action: "organization_updated",
          entityType: "organization",
          entityId: organization.id,
          organizationId: organization.id,
          userId: user.id,
          newValues: updates,
        });
      }
    },
    onSuccess: () => {
      toast.success("Organization settings updated");
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error("Failed to update organization: " + errorMessage);
    },
  });
}

export function useOrganizationModuleAccess(module: ModuleType) {
  const { hasModule, subscription, organization } = useOrganization();

  return {
    hasAccess: hasModule(module),
    isEnabled: subscription ? hasModule(module) : false,
    isLoading: !subscription && !organization,
    module,
  };
}
