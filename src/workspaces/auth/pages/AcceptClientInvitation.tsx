import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Hash, Loader2 } from "lucide-react";
import { Button } from "@/ui/shadcn/button";
import { useAuth } from "@/core/auth/useAuth";
import { useToast } from "@/core/hooks/use-toast";
import { supabase } from "@/core/api/client";
import {
  InvitationFormRow,
  InvitationInput,
  InvitationShell,
  InvitationStatusPanel,
  InvitationSummaryCard,
  type InvitationSummaryItem,
} from "@/workspaces/auth/components/InvitationShell";

type InvitationState = "loading" | "valid" | "missing" | "invalid" | "expired";

const primaryButtonClassName =
  "h-12 rounded-2xl border-0 bg-[linear-gradient(90deg,#8d58ff_0%,#a865ff_52%,#877bff_100%)] px-6 text-white shadow-[0_18px_40px_rgba(141,88,255,0.34)] transition hover:brightness-110";

const secondaryButtonClassName =
  "h-12 rounded-2xl border-white/10 bg-white/[0.06] px-6 text-white transition hover:bg-white/10 hover:text-white";

const submitButtonClassName =
  "h-14 w-full rounded-[20px] border-0 bg-[linear-gradient(90deg,#8d58ff_0%,#a865ff_52%,#877bff_100%)] text-base font-semibold text-white shadow-[0_20px_44px_rgba(141,88,255,0.34)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:brightness-100";

export default function AcceptClientInvitation() {
  const [params] = useSearchParams();
  const token = useMemo(() => params.get("token") ?? "", [params]);

  const { acceptClientInvitation, loading } = useAuth();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [organizationCode, setOrganizationCode] = useState("");
  const [invitationState, setInvitationState] = useState<InvitationState>(token ? "loading" : "missing");
  const [invitationError, setInvitationError] = useState("");

  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!token) {
        setInvitationState("missing");
        setInvitationError("Invitation token is missing from the link.");
        return;
      }

      setInvitationState("loading");
      setInvitationError("");

      try {
        const { data, error } = await supabase.rpc("get_client_invitation_details", {
          p_token: token,
        });

        if (error || !data) {
          setInvitationState("invalid");
          setInvitationError("This invitation link is invalid.");
          return;
        }

        const invitation = Array.isArray(data) ? data[0] : data;

        if (!invitation) {
          setInvitationState("invalid");
          setInvitationError("This invitation link is invalid.");
          return;
        }

        if (invitation.status !== "pending") {
          if (invitation.status === "expired") {
            setInvitationState("expired");
            setInvitationError("This invitation has expired.");
            return;
          }

          setInvitationState("invalid");
          setInvitationError("This invitation is no longer valid.");
          return;
        }

        if (new Date(invitation.expires_at).getTime() < Date.now()) {
          setInvitationState("expired");
          setInvitationError("This invitation has expired.");
          return;
        }

        setEmail(invitation.invited_email ?? "");
        setOrganizationName(invitation.organization_name ?? "");
        setOrganizationCode(invitation.organization_code ?? "");
        setInvitationState("valid");
      } catch {
        setInvitationState("invalid");
        setInvitationError("Unable to validate invitation link.");
      }
    };

    void load();
  }, [token]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (invitationState !== "valid") {
      toast({ variant: "destructive", title: "Invalid link", description: "Please use a valid invitation link." });
      return;
    }

    if (!token) {
      toast({ variant: "destructive", title: "Invalid link", description: "Invitation token is missing." });
      return;
    }

    if (password !== confirmPassword) {
      toast({ variant: "destructive", title: "Password mismatch", description: "Passwords must match." });
      return;
    }

    setSubmitting(true);

    const { error } = await acceptClientInvitation({
      token,
      fullName,
      password,
    });

    setSubmitting(false);

    if (error) {
      toast({ variant: "destructive", title: "Unable to accept invitation", description: error });
      return;
    }

    setSubmitted(true);
  };

  const organizationLabel = organizationName.trim() || "SISWIT";
  const invitationSummaryItems = useMemo<InvitationSummaryItem[]>(() => {
    if (!organizationCode) return [];

    return [
      {
        icon: Hash,
        label: "Workspace Code:",
        value: organizationCode,
      },
    ];
  }, [organizationCode]);

  if (invitationState === "loading") {
    return (
      <InvitationShell
        badge="Invitation"
        title="Validating invitation"
        description="Please wait while we verify your invitation link."
      >
        <InvitationStatusPanel
          centered
          icon={<Loader2 className="h-6 w-6 animate-spin text-[#d8b3ff]" />}
          title="Checking your access"
          description="We are validating the invitation and preparing your portal setup."
        />
      </InvitationShell>
    );
  }

  if (submitted) {
    return (
      <InvitationShell
        badge="Invitation Accepted"
        title="Portal access ready"
        description={`Your invitation for ${organizationLabel} has been accepted. Verify your email, then sign in.`}
      >
        <InvitationStatusPanel
          centered
          icon={<CheckCircle2 className="h-6 w-6 text-emerald-300" />}
          title="Invitation accepted"
          description="Verify your email and sign in to access your client portal."
          actions={
            <Button asChild className={primaryButtonClassName}>
              <Link to="/auth/sign-in">Go to sign in</Link>
            </Button>
          }
        />
      </InvitationShell>
    );
  }

  if (invitationState !== "valid") {
    const title = invitationState === "expired" ? "Invitation expired" : "Invalid invitation";

    return (
      <InvitationShell badge="Invitation" title={title} description={invitationError || "This invitation link cannot be used."}>
        <InvitationStatusPanel
          icon={<AlertTriangle className="h-6 w-6 text-rose-300" />}
          title={title}
          description={invitationError || "This invitation link cannot be used."}
          actions={
            <>
              <Button asChild className={primaryButtonClassName}>
                <Link to="/auth/sign-in">Go to sign in</Link>
              </Button>
              <Button variant="outline" asChild className={secondaryButtonClassName}>
                <Link to="/">Back to home</Link>
              </Button>
            </>
          }
        />
      </InvitationShell>
    );
  }

  return (
    <InvitationShell
      badge="Invitation"
      title="Accept Invitation"
      description={`Set up your shared portal access for ${organizationLabel}.`}
    >
      <div className="space-y-8">
        <InvitationSummaryCard
          organizationName={organizationLabel}
          subtitle="Client portal invitation"
          items={invitationSummaryItems}
          email={email}
        />

        <div className="space-y-5">
          <div className="space-y-1">
            <h2 className="text-3xl font-semibold tracking-tight text-white">Create Your Account</h2>
            <p className="text-sm text-white/60">Finish your portal setup to continue.</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <InvitationFormRow label="Full Name">
              <InvitationInput
                placeholder="Sahil Rajput"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required
                autoComplete="name"
              />
            </InvitationFormRow>

            <InvitationFormRow label="Password">
              <InvitationInput
                type="password"
                placeholder="Create a secure password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={12}
                autoComplete="new-password"
              />
            </InvitationFormRow>

            <InvitationFormRow label="Confirm Password">
              <InvitationInput
                type="password"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                minLength={12}
                autoComplete="new-password"
              />
            </InvitationFormRow>

            <Button className={submitButtonClassName} type="submit" disabled={submitting || loading}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Accept Invitation & Access Portal"
              )}
            </Button>
          </form>

          <p className="text-sm text-white/60">
            Already have an account?{" "}
            <Link to="/auth/sign-in" className="font-semibold text-[#ddbaff] transition hover:text-white hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </InvitationShell>
  );
}
