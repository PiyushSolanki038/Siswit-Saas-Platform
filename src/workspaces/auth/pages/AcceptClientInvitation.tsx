import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/ui/shadcn/button";
import { Input } from "@/ui/shadcn/input";
import { useAuth } from "@/core/auth/useAuth";
import { useToast } from "@/core/hooks/use-toast";
import { supabase } from "@/core/api/client";

function hashToken(token: string): Promise<string> {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)).then((digest) => {
    const bytes = new Uint8Array(digest);
    return Array.from(bytes)
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("");
  });
}

export default function AcceptClientInvitation() {
  const [params] = useSearchParams();
  const token = useMemo(() => params.get("token") ?? "", [params]);

  const { acceptClientInvitation, loading } = useAuth();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [organizationCode, setOrganizationCode] = useState("");

  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!token) return;

      const tokenHash = await hashToken(token);
      const { data } = await supabase
        .from("client_invitations")
        .select("invited_email, organization:organizations(name, org_code)")
        .eq("token_hash", tokenHash)
        .maybeSingle();

      if (!data) return;

      setEmail(data.invited_email ?? "");
      setOrganizationName(data.organization?.name ?? "");
      setOrganizationCode(data.organization?.org_code ?? "");
    };

    void load();
  }, [token]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

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

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-lg border rounded-xl p-6 space-y-4">
          <h1 className="text-2xl font-semibold">Invitation accepted</h1>
          <p className="text-sm text-muted-foreground">Verify your email and sign in to access your client portal.</p>
          <Button asChild>
            <Link to="/auth/sign-in">Go to sign in</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <form onSubmit={onSubmit} className="w-full max-w-xl border rounded-xl p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Accept client invitation</h1>

        <Input value={email} readOnly placeholder="Email" />
        <Input value={organizationName} readOnly placeholder="Organization" />
        <Input value={organizationCode} readOnly placeholder="Organization Code" />

        <Input placeholder="Full Name" value={fullName} onChange={(event) => setFullName(event.target.value)} required />
        <Input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          minLength={12}
        />
        <Input
          type="password"
          placeholder="Confirm Password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
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
            "Create Client Account"
          )}
        </Button>
      </form>
    </div>
  );
}
