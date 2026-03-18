import { useMemo } from "react";
import { useAuth } from "@/core/auth/useAuth";
import { useOrganization } from "@/workspaces/organization/hooks/useOrganization";

export function usePortalScope() {
  const { user } = useAuth();
  const { organization, organizationLoading, memberships } = useOrganization();

  const membership = useMemo(() => {
    if (!organization?.id || !user?.id) {
      return null;
    }

    return (
      memberships.find(
        (item) =>
          item.organization_id === organization.id &&
          item.user_id === user.id &&
          item.is_active,
      ) ?? null
    );
  }, [memberships, organization?.id, user?.id]);

  const portalEmail = useMemo(() => {
    const membershipEmail = membership?.email?.trim();
    if (membershipEmail) {
      return membershipEmail;
    }

    const userEmail = user?.email?.trim();
    return userEmail || null;
  }, [membership?.email, user?.email]);

  return {
    organizationId: organization?.id ?? null,
    organizationLoading,
    portalEmail,
    userId: user?.id ?? null,
    isReady: Boolean(!organizationLoading && organization?.id && user?.id),
  };
}
