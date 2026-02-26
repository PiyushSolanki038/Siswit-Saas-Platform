import { useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useOrganizationOwnerData } from "@/hooks/useOrganizationOwnerData";

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid date";
  return date.toLocaleString();
}

export default function OrganizationApprovalsPage() {
  const { approveClientMembership, rejectClientMembership } = useAuth();
  const { organization, loading, pendingClients, refresh } = useOrganizationOwnerData();
  const { toast } = useToast();
  const [workingMembershipId, setWorkingMembershipId] = useState<string | null>(null);

  const handleApprove = async (membershipId: string) => {
    setWorkingMembershipId(membershipId);
    const { error } = await approveClientMembership(membershipId);
    setWorkingMembershipId(null);

    if (error) {
      toast({ variant: "destructive", title: "Approval failed", description: error });
      return;
    }

    toast({ title: "Client approved", description: "Client now has active access." });
    await refresh();
  };

  const handleReject = async (membershipId: string) => {
    setWorkingMembershipId(membershipId);
    const { error } = await rejectClientMembership(membershipId);
    setWorkingMembershipId(null);

    if (error) {
      toast({ variant: "destructive", title: "Rejection failed", description: error });
      return;
    }

    toast({ title: "Client rejected", description: "Client membership was rejected." });
    await refresh();
  };

  if (loading && !organization) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  if (!organization) {
    return (
      <section className="org-panel">
        <h2 className="text-lg font-semibold">No organization found</h2>
        <p className="mt-1 text-sm text-muted-foreground">Sign in with an organization owner or admin account.</p>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section>
        <h1 className="text-3xl font-semibold tracking-tight">Client Approvals</h1>
        <p className="mt-1 text-sm text-muted-foreground">Approve or reject client self-signup membership requests.</p>
      </section>

      <section className="org-panel">
        {pendingClients.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending client approvals.</p>
        ) : (
          <div className="space-y-3">
            {pendingClients.map((membership) => (
              <article
                key={membership.id}
                className="flex flex-col gap-3 rounded-xl border border-border/70 bg-background/80 px-4 py-3 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-medium">{membership.email}</p>
                  <p className="text-sm text-muted-foreground">Requested {formatDate(membership.created_at)}</p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-warning/15 px-2 py-1 text-xs font-medium text-warning">
                    {membership.account_state}
                  </span>
                  <Button
                    size="sm"
                    onClick={() => void handleApprove(membership.id)}
                    disabled={workingMembershipId === membership.id}
                  >
                    <CheckCircle2 className="mr-1 h-4 w-4" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => void handleReject(membership.id)}
                    disabled={workingMembershipId === membership.id}
                  >
                    <XCircle className="mr-1 h-4 w-4" />
                    Reject
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
