import { useState } from "react";
import type { FormEvent } from "react";
import { Copy, Loader2, MailPlus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useOrganizationOwnerData } from "@/hooks/useOrganizationOwnerData";
import { useToast } from "@/hooks/use-toast";

const INVITE_EMAILS_DISABLED = (() => {
  const raw = String(import.meta.env.VITE_DISABLE_INVITE_EMAILS ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
})();

function getFutureIso(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid date";
  return date.toLocaleString();
}

export default function OrganizationInvitationsPage() {
  const { inviteEmployee, inviteClient } = useAuth();
  const { organization, loading, employeeInvites, clientInvites, refresh } = useOrganizationOwnerData();
  const { toast } = useToast();

  const [employeeEmail, setEmployeeEmail] = useState("");
  const [employeeRole, setEmployeeRole] = useState<"admin" | "manager" | "employee">("employee");
  const [customRoleName, setCustomRoleName] = useState("");
  const [employeeMessage, setEmployeeMessage] = useState("");
  const [employeeExpiryDays, setEmployeeExpiryDays] = useState("2");
  const [submittingEmployee, setSubmittingEmployee] = useState(false);

  const [clientEmail, setClientEmail] = useState("");
  const [clientMessage, setClientMessage] = useState("");
  const [clientExpiryDays, setClientExpiryDays] = useState("7");
  const [submittingClient, setSubmittingClient] = useState(false);

  const handleEmployeeInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!organization?.id) return;

    setSubmittingEmployee(true);
    const expiresAt = getFutureIso(Number(employeeExpiryDays || "2"));
    const { error, invitationUrl, emailError } = await inviteEmployee({
      organizationId: organization.id,
      email: employeeEmail.trim(),
      role: employeeRole,
      customRoleName: customRoleName.trim() || null,
      message: employeeMessage.trim() || undefined,
      expiresAt,
    });
    setSubmittingEmployee(false);

    if (error) {
      toast({ variant: "destructive", title: "Employee invite failed", description: error });
      return;
    }

    if (invitationUrl) {
      await navigator.clipboard.writeText(invitationUrl).catch(() => undefined);
    }

    if (emailError) {
      toast({
        variant: "destructive",
        title: "Employee invitation created, but email failed",
        description: `${emailError} You can share the copied invitation link manually.`,
      });
    } else if (INVITE_EMAILS_DISABLED) {
      toast({
        title: "Employee invitation created",
        description: "Email sending is disabled. Share the copied invitation link manually.",
      });
    } else {
      toast({
        title: "Employee invited",
        description: invitationUrl
          ? "Invitation sent and link copied to clipboard."
          : "Invitation was created and email dispatch was requested.",
      });
    }

    setEmployeeEmail("");
    setCustomRoleName("");
    setEmployeeMessage("");
    await refresh();
  };

  const handleClientInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!organization?.id) return;

    setSubmittingClient(true);
    const expiresAt = getFutureIso(Number(clientExpiryDays || "7"));
    const { error, invitationUrl, emailError } = await inviteClient({
      organizationId: organization.id,
      email: clientEmail.trim(),
      message: clientMessage.trim() || undefined,
      expiresAt,
    });
    setSubmittingClient(false);

    if (error) {
      toast({ variant: "destructive", title: "Client invite failed", description: error });
      return;
    }

    if (invitationUrl) {
      await navigator.clipboard.writeText(invitationUrl).catch(() => undefined);
    }

    if (emailError) {
      toast({
        variant: "destructive",
        title: "Client invitation created, but email failed",
        description: `${emailError} You can share the copied invitation link manually.`,
      });
    } else if (INVITE_EMAILS_DISABLED) {
      toast({
        title: "Client invitation created",
        description: "Email sending is disabled. Share the copied invitation link manually.",
      });
    } else {
      toast({
        title: "Client invited",
        description: invitationUrl
          ? "Invitation sent and link copied to clipboard."
          : "Invitation was created and email dispatch was requested.",
      });
    }

    setClientEmail("");
    setClientMessage("");
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
        <h1 className="text-3xl font-semibold tracking-tight">Invitations</h1>
        <p className="mt-1 text-sm text-muted-foreground">Invite internal employees and external clients to your organization.</p>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="org-panel">
          <div className="mb-4">
            <h2 className="inline-flex items-center gap-2 text-lg font-semibold">
              <UserPlus className="h-4 w-4" />
              Invite Employee
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">Send admin, manager, or employee invitations.</p>
          </div>
          <form className="space-y-3" onSubmit={handleEmployeeInvite}>
            <Input
              type="email"
              placeholder="Employee email"
              value={employeeEmail}
              onChange={(event) => setEmployeeEmail(event.target.value)}
              required
            />
            <Select value={employeeRole} onValueChange={(value) => setEmployeeRole(value as "admin" | "manager" | "employee")}>
              <SelectTrigger>
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="employee">Employee</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Custom role label (optional)"
              value={customRoleName}
              onChange={(event) => setCustomRoleName(event.target.value)}
            />
            <Select value={employeeExpiryDays} onValueChange={setEmployeeExpiryDays}>
              <SelectTrigger>
                <SelectValue placeholder="Expiry" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2 days</SelectItem>
                <SelectItem value="5">5 days</SelectItem>
                <SelectItem value="7">7 days</SelectItem>
              </SelectContent>
            </Select>
            <Textarea
              placeholder="Message (optional)"
              value={employeeMessage}
              onChange={(event) => setEmployeeMessage(event.target.value)}
              rows={3}
            />
            <Button type="submit" className="w-full" disabled={submittingEmployee}>
              {submittingEmployee ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending invite...
                </>
              ) : (
                "Send Employee Invitation"
              )}
            </Button>
          </form>
        </article>

        <article className="org-panel">
          <div className="mb-4">
            <h2 className="inline-flex items-center gap-2 text-lg font-semibold">
              <MailPlus className="h-4 w-4" />
              Invite Client
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">Invite external clients to portal onboarding.</p>
          </div>
          <form className="space-y-3" onSubmit={handleClientInvite}>
            <Input
              type="email"
              placeholder="Client email"
              value={clientEmail}
              onChange={(event) => setClientEmail(event.target.value)}
              required
            />
            <Select value={clientExpiryDays} onValueChange={setClientExpiryDays}>
              <SelectTrigger>
                <SelectValue placeholder="Expiry" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 days</SelectItem>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="14">14 days</SelectItem>
              </SelectContent>
            </Select>
            <Textarea
              placeholder="Message (optional)"
              value={clientMessage}
              onChange={(event) => setClientMessage(event.target.value)}
              rows={3}
            />
            <Button type="submit" className="w-full" disabled={submittingClient}>
              {submittingClient ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending invite...
                </>
              ) : (
                "Send Client Invitation"
              )}
            </Button>
          </form>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="org-panel">
          <h2 className="text-lg font-semibold">Recent Employee Invitations</h2>
          <div className="mt-4 space-y-2">
            {employeeInvites.length === 0 ? (
              <p className="text-sm text-muted-foreground">No employee invitations yet.</p>
            ) : (
              employeeInvites.map((invite) => (
                <div
                  key={invite.id}
                  className="rounded-xl border border-border/70 bg-background/70 px-3.5 py-3 text-sm"
                >
                  <p className="font-medium">{invite.invited_email}</p>
                  <p className="text-xs text-muted-foreground">
                    {invite.role} | {invite.status} | expires {formatDate(invite.expires_at)}
                  </p>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="org-panel">
          <h2 className="text-lg font-semibold">Recent Client Invitations</h2>
          <div className="mt-4 space-y-2">
            {clientInvites.length === 0 ? (
              <p className="text-sm text-muted-foreground">No client invitations yet.</p>
            ) : (
              clientInvites.map((invite) => (
                <div
                  key={invite.id}
                  className="rounded-xl border border-border/70 bg-background/70 px-3.5 py-3 text-sm"
                >
                  <p className="font-medium">{invite.invited_email}</p>
                  <p className="text-xs text-muted-foreground">
                    {invite.status} | expires {formatDate(invite.expires_at)}
                  </p>
                </div>
              ))
            )}
          </div>
        </article>
      </section>

      <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Copy className="h-3 w-3" />
        Invitation links are copied to clipboard when available.
      </p>
    </div>
  );
}
