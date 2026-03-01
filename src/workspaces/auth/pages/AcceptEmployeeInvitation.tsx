import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/ui/shadcn/button";
import { Input } from "@/ui/shadcn/input";
import { useAuth } from "@/core/auth/useAuth";
import { useToast } from "@/core/hooks/use-toast";
import { supabase } from "@/core/api/client";

type InvitationState = "loading" | "valid" | "missing" | "invalid" | "expired";

function hashToken(token: string): Promise<string> {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)).then((digest) => {
    const bytes = new Uint8Array(digest);
    return Array.from(bytes)
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("");
  });
}

export default function AcceptEmployeeInvitation() {
  const [params] = useSearchParams();
  const token = useMemo(() => params.get("token") ?? "", [params]);

  const { acceptEmployeeInvitation, loading } = useAuth();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [organizationCode, setOrganizationCode] = useState("");
  const [invitationState, setInvitationState] = useState<InvitationState>(token ? "loading" : "missing");
  const [invitationError, setInvitationError] = useState("");

  const [fullName, setFullName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
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
        const tokenHash = await hashToken(token);
        const { data } = await supabase
          .from("employee_invitations")
          .select("invited_email, role, expires_at, status, organization:organizations(name, org_code)")
          .eq("token_hash", tokenHash)
          .maybeSingle();

        if (!data) {
          setInvitationState("invalid");
          setInvitationError("This invitation link is invalid.");
          return;
        }

        if (data.status !== "pending") {
          if (data.status === "expired") {
            setInvitationState("expired");
            setInvitationError("This invitation has expired.");
            return;
          }

          setInvitationState("invalid");
          setInvitationError("This invitation is no longer valid.");
          return;
        }

        if (new Date(data.expires_at).getTime() < Date.now()) {
          setInvitationState("expired");
          setInvitationError("This invitation has expired.");
          return;
        }

        setEmail(data.invited_email ?? "");
        setRole(data.role ?? "");
        setOrganizationName(data.organization?.name ?? "");
        setOrganizationCode(data.organization?.org_code ?? "");
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

    const { error } = await acceptEmployeeInvitation({
      token,
      fullName,
      employeeId,
      password,
    });

    setSubmitting(false);

    if (error) {
      toast({ variant: "destructive", title: "Unable to accept invitation", description: error });
      return;
    }

    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-lg border rounded-xl p-6 space-y-4">
          <h1 className="text-2xl font-semibold">Invitation accepted</h1>
          <p className="text-sm text-muted-foreground">Verify your email and sign in to access your workspace.</p>
          <Button asChild>
            <Link to="/auth/sign-in">Go to sign in</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (invitationState === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-lg border rounded-xl p-6 space-y-4 text-center">
          <Loader2 className="h-6 w-6 mx-auto animate-spin text-primary" />
          <h1 className="text-2xl font-semibold">Validating invitation</h1>
          <p className="text-sm text-muted-foreground">Please wait while we verify your invitation link.</p>
        </div>
      </div>
    );
  }

  if (invitationState !== "valid") {
    const title = invitationState === "expired" ? "Invitation expired" : "Invalid invitation";

    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-lg border rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-destructive/10 p-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <h1 className="text-2xl font-semibold">{title}</h1>
          </div>
          <p className="text-sm text-muted-foreground">{invitationError || "This invitation link cannot be used."}</p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/auth/sign-in">Go to sign in</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/">Back to home</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <form onSubmit={onSubmit} className="w-full max-w-xl border rounded-xl p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Accept employee invitation</h1>

        <Input value={email} readOnly placeholder="Email" />
        <Input value={role} readOnly placeholder="Role" />
        <Input value={organizationName} readOnly placeholder="Organization" />
        <Input value={organizationCode} readOnly placeholder="Organization Code" />

        <Input placeholder="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        <Input placeholder="Employee ID (optional)" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} />
        <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={12} />
        <Input
          type="password"
          placeholder="Confirm Password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={12}
        />

        <Button className="w-full" type="submit" disabled={submitting || loading}>
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Creating account...
            </>
          ) : (
            "Create Employee Account"
          )}
        </Button>
      </form>
    </div>
  );
}

