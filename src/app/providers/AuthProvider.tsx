"use client";

import { ReactNode, useCallback, useEffect, useState } from "react";
import type { Session, User, SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/core/api/client";
import {
  type AcceptClientInvitationInput,
  type AcceptEmployeeInvitationInput,
  AuthContext,
  type AuthRole,
  type ClientSelfSignUpInput,
  type InviteClientInput,
  type InviteEmployeeInput,
  type OrganizationSignUpInput,
} from "@/core/auth/auth-context";
import { normalizeRole, PlatformRole } from "@/core/types/roles";

const ROLE_CACHE_KEY_PREFIX = "org_role_";
const AUTH_ROLE_LOOKUP_TIMEOUT_MS = Number(import.meta.env.VITE_AUTH_ROLE_LOOKUP_TIMEOUT_MS ?? "5000");
const INVITE_EMAILS_DISABLED = (() => {
  const raw = String(import.meta.env.VITE_DISABLE_INVITE_EMAILS ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
})();

type MembershipLookupRow = {
  id: string;
  organization_id: string;
  role: string;
  account_state: string;
  is_active: boolean;
  is_email_verified: boolean;
  created_at?: string | null;
};



type OrganizationLookupRow = {
  id: string;
  name: string;
  slug: string;
  org_code: string;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

async function getFunctionInvokeErrorMessage(error: unknown): Promise<string> {
  const baseMessage = getErrorMessage(error);
  const maybeError = error as { context?: unknown } | null;
  const context = maybeError?.context;

  if (!(context instanceof Response)) {
    return baseMessage;
  }

  try {
    const cloned = context.clone();
    const json = (await cloned.json().catch(() => null)) as { error?: unknown } | null;
    if (json && typeof json.error === "string" && json.error.trim()) {
      return `${baseMessage}: ${json.error}`;
    }

    const text = await context.text();
    if (text.trim()) {
      return `${baseMessage}: ${text}`;
    }
  } catch {
    // Fall back to base message
  }

  return baseMessage;
}



function generateSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function generateOrgCode(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const prefix = (cleaned.slice(0, 5) || "ORG").padEnd(3, "X");
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}${suffix}`;
}

async function withTimeout<T>(promise: Promise<T> | PromiseLike<T>, timeoutMs: number): Promise<T> {
  const timeout = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 5000;
  return Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => {
      const timer = setTimeout(() => {
        clearTimeout(timer);
        reject(new Error("Timeout"));
      }, timeout);
    }),
  ]);
}

async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  return Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function buildInviteToken(): string {
  const randomA = crypto.getRandomValues(new Uint32Array(2));
  const randomB = crypto.getRandomValues(new Uint32Array(2));
  return `${randomA[0].toString(16)}${randomA[1].toString(16)}${randomB[0].toString(16)}${randomB[1].toString(16)}`;
}

function getAuthEmailRedirectTo(): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/auth/sign-in`;
}

function membershipPriority(role: string): number {
  switch (role) {
    case "owner":
      return 1;
    case "admin":
      return 2;
    case "manager":
      return 3;
    case "employee":
      return 4;
    case "client":
      return 5;
    default:
      return 99;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const unsafeSupabase = supabase as unknown as SupabaseClient;

  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AuthRole>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const cacheRole = useCallback((userId: string, userRole: AuthRole) => {
    if (userRole) {
      const payload = { role: userRole, timestamp: Date.now() };
      sessionStorage.setItem(`${ROLE_CACHE_KEY_PREFIX}${userId}`, JSON.stringify(payload));
      return;
    }
    sessionStorage.removeItem(`${ROLE_CACHE_KEY_PREFIX}${userId}`);
  }, []);

  const getCachedRole = useCallback((userId: string): AuthRole => {
    try {
      const cached = sessionStorage.getItem(`${ROLE_CACHE_KEY_PREFIX}${userId}`);
      if (!cached) return null;

      let parsedRole = cached;
      if (cached.startsWith("{")) {
        const payload = JSON.parse(cached);
        const age = Date.now() - (payload.timestamp || 0);
        if (age > 60 * 60 * 1000) {
          sessionStorage.removeItem(`${ROLE_CACHE_KEY_PREFIX}${userId}`);
          return null;
        }
        parsedRole = payload.role;
      }
      return normalizeRole(parsedRole);
    } catch {
      return null;
    }
  }, []);

  const pickMembership = useCallback((rows: MembershipLookupRow[]): MembershipLookupRow | null => {
    if (!rows.length) return null;

    const sorted = [...rows].sort((a, b) => {
      const roleOrder = membershipPriority(a.role) - membershipPriority(b.role);
      if (roleOrder !== 0) return roleOrder;
      const aCreated = new Date(a.created_at ?? 0).getTime();
      const bCreated = new Date(b.created_at ?? 0).getTime();
      if (aCreated !== bCreated) return aCreated - bCreated;
      return a.id.localeCompare(b.id);
    });

    return sorted[0] ?? null;
  }, []);

  const resolveRoleFromMembershipState = useCallback((membership: MembershipLookupRow | null): AuthRole => {
    if (!membership) return null;

    if (membership.account_state === "pending_verification") {
      return "pending_verification" as AuthRole;
    }

    if (membership.account_state === "pending_approval") {
      return "pending_approval";
    }

    if (membership.account_state === "rejected") {
      return "rejected";
    }

    return normalizeRole(membership.role);
  }, []);

  const getUserRole = useCallback(
    async (userId: string): Promise<AuthRole> => {
      try {
        const superAdminPromise = unsafeSupabase
          .from("platform_super_admins")
          .select("role, is_active")
          .eq("user_id", userId)
          .maybeSingle();

        const superAdminResult = await withTimeout(superAdminPromise, AUTH_ROLE_LOOKUP_TIMEOUT_MS);

        if (superAdminResult?.data && superAdminResult.data.is_active !== false) {
          return PlatformRole.PLATFORM_SUPER_ADMIN;
        }

        const membershipPromise = unsafeSupabase
          .from("organization_memberships")
          .select("id, organization_id, role, account_state, is_active, is_email_verified, created_at")
          .eq("user_id", userId)
          .eq("is_active", true);

        const membershipResult = await withTimeout(membershipPromise, AUTH_ROLE_LOOKUP_TIMEOUT_MS);
        const memberships = (membershipResult?.data ?? []) as MembershipLookupRow[];

        const chosenMembership = pickMembership(memberships);
        if (!chosenMembership) {
          return getCachedRole(userId);
        }

        return resolveRoleFromMembershipState(chosenMembership);
      } catch {
        return getCachedRole(userId);
      }
    },
    [getCachedRole, pickMembership, resolveRoleFromMembershipState, unsafeSupabase],
  );

  const refreshRole = useCallback(async () => {
    if (!user?.id) return;
    try {
      const nextRole = await getUserRole(user.id);
      setRole(nextRole);
      cacheRole(user.id, nextRole);
    } catch (error) {
      // Non-blocking refresh, add error to telemetry/logs if needed in future
    }
  }, [cacheRole, getUserRole, user?.id]);

  const upsertProfile = useCallback(
    async (userId: string, fullName: string) => {
      const { error } = await unsafeSupabase.rpc("create_signup_profile", {
        p_user_id: userId,
        p_full_name: fullName,
      });
      if (error) {
        throw new Error(`Unable to save profile: ${error.message}`);
      }
    },
    [unsafeSupabase],
  );

  const createOrganization = useCallback(
    async (input: OrganizationSignUpInput, userId: string): Promise<{ id: string; slug: string } | null> => {
      const baseSlug = generateSlug(input.organizationName);
      const baseCode = input.organizationCode?.trim().toUpperCase() || generateOrgCode(input.organizationName);

      // Use the SECURITY DEFINER RPC which bypasses RLS.
      // This is required because at this point the user is still anon (pre-email-confirmation).
      const { data, error } = await unsafeSupabase.rpc("create_signup_organization", {
        p_user_id: userId,
        p_email: input.email,
        p_org_name: input.organizationName,
        p_org_slug: baseSlug,
        p_org_code: baseCode,
      });

      if (error) {
        throw new Error(`Unable to create organization: ${error.message}`);
      }

      // The RPC returns { id, slug } as jsonb
      const result = data as { id: string; slug: string } | null;
      if (!result?.id) {
        return null;
      }

      return { id: result.id, slug: result.slug };
    },
    [unsafeSupabase],
  );


  const signUpOrganization = useCallback(
    async (input: OrganizationSignUpInput): Promise<{ error: string | null }> => {
      try {
        setLoading(true);

        const { data, error } = await supabase.auth.signUp({
          email: input.email,
          password: input.password,
          options: {
            emailRedirectTo: getAuthEmailRedirectTo(),
            data: {
              full_name: input.ownerFullName,
              signup_type: "organization_owner",
            },
          },
        });

        if (error) {
          if (
            error.message.toLowerCase().includes("already registered") ||
            error.message.toLowerCase().includes("already exists")
          ) {
            return {
              error:
                "This email is already registered. Please sign in first, then create your organization from the dashboard.",
            };
          }
          return { error: error.message };
        }

        const userId = data?.user?.id;

        if (!userId) {
          return { error: "Unable to create user." };
        }

        await upsertProfile(userId, input.ownerFullName);

        const org = await createOrganization(input, userId);
        if (!org) {
          return { error: "Unable to create organization." };
        }

        return { error: null };
      } catch (error: unknown) {
        return { error: getErrorMessage(error) };
      } finally {
        setLoading(false);
      }
    },
    [createOrganization, upsertProfile],
  );

  const findOrganizationBySlugOrCode = useCallback(
    async (slugOrCode: string): Promise<OrganizationLookupRow | null> => {
      const needle = slugOrCode.trim();
      if (!needle) return null;

      const { data, error } = await unsafeSupabase.rpc("find_signup_organization", {
        p_slug_or_code: needle,
      });

      if (error || !data) return null;
      const row = Array.isArray(data) ? data[0] : data;
      return (row as OrganizationLookupRow | null) ?? null;
    },
    [unsafeSupabase],
  );

  const signUpClientSelf = useCallback(
    async (input: ClientSelfSignUpInput): Promise<{ error: string | null }> => {
      try {
        setLoading(true);

        const organization = await findOrganizationBySlugOrCode(input.organizationSlugOrCode);
        if (!organization) {
          return { error: "Organization not found." };
        }

        const { data, error } = await supabase.auth.signUp({
          email: input.email,
          password: input.password,
          options: {
            emailRedirectTo: getAuthEmailRedirectTo(),
            data: {
              full_name: input.fullName,
              signup_type: "client_self",
              organization_slug: organization.slug,
            },
          },
        });

        if (error) {
          return { error: error.message };
        }

        if (!data.user?.id) {
          return { error: "Unable to create user." };
        }

        await upsertProfile(data.user.id, input.fullName);

        const { error: membershipError } = await unsafeSupabase.from("organization_memberships").insert({
          organization_id: organization.id,
          user_id: data.user.id,
          email: input.email,
          role: "client",
          account_state: "pending_verification",
          is_email_verified: false,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        if (membershipError) {
          return { error: `Unable to create client membership: ${membershipError.message}` };
        }

        return { error: null };
      } catch (error: unknown) {
        return { error: getErrorMessage(error) };
      } finally {
        setLoading(false);
      }
    },
    [findOrganizationBySlugOrCode, unsafeSupabase, upsertProfile],
  );

  const getEmployeeInvitationByToken = useCallback(
    async (token: string) => {
      const tokenHash = await hashToken(token);

      const { data } = await unsafeSupabase
        .from("employee_invitations")
        .select("id, organization_id, invited_email, role, employee_role_id, expires_at, status")
        .eq("token_hash", tokenHash)
        .maybeSingle();

      return data ?? null;
    },
    [unsafeSupabase],
  );

  const getClientInvitationByToken = useCallback(
    async (token: string) => {
      const tokenHash = await hashToken(token);

      const { data } = await unsafeSupabase
        .from("client_invitations")
        .select("id, organization_id, invited_email, expires_at, status")
        .eq("token_hash", tokenHash)
        .maybeSingle();

      return data ?? null;
    },
    [unsafeSupabase],
  );

  const acceptEmployeeInvitation = useCallback(
    async (input: AcceptEmployeeInvitationInput): Promise<{ error: string | null }> => {
      try {
        setLoading(true);

        const invitation = await getEmployeeInvitationByToken(input.token);
        if (!invitation || invitation.status !== "pending") {
          return { error: "Invalid invitation token." };
        }

        if (new Date(invitation.expires_at).getTime() < Date.now()) {
          return { error: "Invitation has expired." };
        }

        const { data, error } = await supabase.auth.signUp({
          email: invitation.invited_email,
          password: input.password,
          options: {
            emailRedirectTo: getAuthEmailRedirectTo(),
            data: {
              full_name: input.fullName,
              signup_type: "employee_invitation",
            },
          },
        });

        if (error) {
          return { error: error.message };
        }

        if (!data.user?.id) {
          return { error: "Unable to create user." };
        }

        await upsertProfile(data.user.id, input.fullName);

        const { error: membershipError } = await unsafeSupabase.from("organization_memberships").insert({
          organization_id: invitation.organization_id,
          user_id: data.user.id,
          email: invitation.invited_email,
          role: invitation.role,
          employee_role_id: invitation.employee_role_id,
          employee_id: input.employeeId ?? null,
          account_state: "pending_verification",
          is_email_verified: false,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        if (membershipError) {
          return { error: `Unable to create employee membership: ${membershipError.message}` };
        }

        const { error: invitationUpdateError } = await unsafeSupabase
          .from("employee_invitations")
          .update({
            status: "accepted",
            accepted_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", invitation.id);

        if (invitationUpdateError) {
          return { error: `Membership created, but invitation status update failed: ${invitationUpdateError.message}` };
        }

        return { error: null };
      } catch (error: unknown) {
        return { error: getErrorMessage(error) };
      } finally {
        setLoading(false);
      }
    },
    [getEmployeeInvitationByToken, unsafeSupabase, upsertProfile],
  );

  const acceptClientInvitation = useCallback(
    async (input: AcceptClientInvitationInput): Promise<{ error: string | null }> => {
      try {
        setLoading(true);

        const invitation = await getClientInvitationByToken(input.token);
        if (!invitation || invitation.status !== "pending") {
          return { error: "Invalid invitation token." };
        }

        if (new Date(invitation.expires_at).getTime() < Date.now()) {
          return { error: "Invitation has expired." };
        }

        const { data, error } = await supabase.auth.signUp({
          email: invitation.invited_email,
          password: input.password,
          options: {
            emailRedirectTo: getAuthEmailRedirectTo(),
            data: {
              full_name: input.fullName,
              signup_type: "client_invitation",
            },
          },
        });

        if (error) {
          return { error: error.message };
        }

        if (!data.user?.id) {
          return { error: "Unable to create user." };
        }

        await upsertProfile(data.user.id, input.fullName);

        const { error: membershipError } = await unsafeSupabase.from("organization_memberships").insert({
          organization_id: invitation.organization_id,
          user_id: data.user.id,
          email: invitation.invited_email,
          role: "client",
          account_state: "pending_verification",
          is_email_verified: false,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        if (membershipError) {
          return { error: `Unable to create client membership: ${membershipError.message}` };
        }

        const { error: invitationUpdateError } = await unsafeSupabase
          .from("client_invitations")
          .update({
            status: "accepted",
            accepted_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", invitation.id);

        if (invitationUpdateError) {
          return { error: `Membership created, but invitation status update failed: ${invitationUpdateError.message}` };
        }

        return { error: null };
      } catch (error: unknown) {
        return { error: getErrorMessage(error) };
      } finally {
        setLoading(false);
      }
    },
    [getClientInvitationByToken, unsafeSupabase, upsertProfile],
  );

  const inviteEmployee = useCallback(
    async (
      input: InviteEmployeeInput,
    ): Promise<{ error: string | null; invitationUrl?: string; emailError?: string | null }> => {
      try {
        const token = buildInviteToken();
        const tokenHash = await hashToken(token);

        const { data: invite, error } = await unsafeSupabase
          .from("employee_invitations")
          .insert({
            organization_id: input.organizationId,
            invited_email: input.email,
            role: input.role,
            employee_role_id: input.employeeRoleId ?? null,
            custom_role_name: input.customRoleName ?? null,
            invited_by_user_id: user?.id,
            token_hash: tokenHash,
            expires_at: input.expiresAt,
            status: "pending",
            message: input.message ?? null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (error || !invite?.id) {
          return { error: error?.message ?? "Unable to create invitation." };
        }

        const { data: organization } = await unsafeSupabase
          .from("organizations")
          .select("name, org_code")
          .eq("id", input.organizationId)
          .maybeSingle();

        const invitationUrl = `${window.location.origin}/auth/accept-invitation?token=${encodeURIComponent(token)}`;

        if (INVITE_EMAILS_DISABLED) {
          return { error: null, invitationUrl, emailError: null };
        }

        const { error: emailInvokeError } = await supabase.functions.invoke("send-employee-invitation", {
          body: {
            recipientEmail: input.email,
            organizationId: input.organizationId,
            organizationName: organization?.name ?? "Organization",
            organizationCode: organization?.org_code ?? "ORG",
            roleLabel: input.customRoleName || input.role,
            inviterName: user?.email ?? "Admin",
            expiresAt: input.expiresAt,
            invitationUrl,
            authRedirectTo: `${window.location.origin}/auth/sign-in`,
          },
        });

        if (emailInvokeError) {
          const detailedMessage = await getFunctionInvokeErrorMessage(emailInvokeError);
          return {
            error: null,
            invitationUrl,
            emailError: detailedMessage || "Failed to send invitation email.",
          };
        }

        return { error: null, invitationUrl, emailError: null };
      } catch (error: unknown) {
        return { error: getErrorMessage(error) };
      }
    },
    [unsafeSupabase, user?.email, user?.id],
  );

  const inviteClient = useCallback(
    async (
      input: InviteClientInput,
    ): Promise<{ error: string | null; invitationUrl?: string; emailError?: string | null }> => {
      try {
        const token = buildInviteToken();
        const tokenHash = await hashToken(token);

        const { data: invite, error } = await unsafeSupabase
          .from("client_invitations")
          .insert({
            organization_id: input.organizationId,
            invited_email: input.email,
            invited_by_user_id: user?.id,
            token_hash: tokenHash,
            expires_at: input.expiresAt,
            status: "pending",
            message: input.message ?? null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (error || !invite?.id) {
          return { error: error?.message ?? "Unable to create invitation." };
        }

        const { data: organization } = await unsafeSupabase
          .from("organizations")
          .select("name, org_code")
          .eq("id", input.organizationId)
          .maybeSingle();

        const invitationUrl = `${window.location.origin}/auth/accept-client-invitation?token=${encodeURIComponent(token)}`;

        if (INVITE_EMAILS_DISABLED) {
          return { error: null, invitationUrl, emailError: null };
        }

        const { error: emailInvokeError } = await supabase.functions.invoke("send-client-invitation", {
          body: {
            recipientEmail: input.email,
            organizationId: input.organizationId,
            organizationName: organization?.name ?? "Organization",
            organizationCode: organization?.org_code ?? "ORG",
            inviterName: user?.email ?? "Admin",
            expiresAt: input.expiresAt,
            invitationUrl,
            authRedirectTo: `${window.location.origin}/auth/sign-in`,
          },
        });

        if (emailInvokeError) {
          const detailedMessage = await getFunctionInvokeErrorMessage(emailInvokeError);
          return {
            error: null,
            invitationUrl,
            emailError: detailedMessage || "Failed to send invitation email.",
          };
        }

        return { error: null, invitationUrl, emailError: null };
      } catch (error: unknown) {
        return { error: getErrorMessage(error) };
      }
    },
    [unsafeSupabase, user?.email, user?.id],
  );

  const approveClientMembership = useCallback(
    async (membershipId: string): Promise<{ error: string | null }> => {
      try {
        const { error } = await unsafeSupabase
          .from("organization_memberships")
          .update({
            account_state: "active",
            is_active: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", membershipId)
          .eq("role", "client");

        if (error) {
          return { error: error.message };
        }

        return { error: null };
      } catch (error: unknown) {
        return { error: getErrorMessage(error) };
      }
    },
    [unsafeSupabase],
  );

  const rejectClientMembership = useCallback(
    async (membershipId: string): Promise<{ error: string | null }> => {
      try {
        const { error } = await unsafeSupabase
          .from("organization_memberships")
          .update({
            account_state: "rejected",
            is_active: false,
            updated_at: new Date().toISOString(),
          })
          .eq("id", membershipId)
          .eq("role", "client");

        if (error) {
          return { error: error.message };
        }

        return { error: null };
      } catch (error: unknown) {
        return { error: getErrorMessage(error) };
      }
    },
    [unsafeSupabase],
  );

  const sendPasswordReset = useCallback(async (email: string): Promise<{ error: string | null }> => {
    try {
      const redirectTo = `${window.location.origin}/auth/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      return { error: error?.message ?? null };
    } catch (error: unknown) {
      return { error: getErrorMessage(error) };
    }
  }, []);

  const updatePassword = useCallback(async (newPassword: string): Promise<{ error: string | null }> => {
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      return { error: error?.message ?? null };
    } catch (error: unknown) {
      return { error: getErrorMessage(error) };
    }
  }, []);

  const resendVerificationEmail = useCallback(async (email: string): Promise<{ error: string | null }> => {
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: {
          emailRedirectTo: getAuthEmailRedirectTo(),
        },
      });
      return { error: error?.message ?? null };
    } catch (error: unknown) {
      return { error: getErrorMessage(error) };
    }
  }, []);

  const claimPendingInvitations = useCallback(async (): Promise<number> => {
    const { data, error } = await unsafeSupabase.rpc("claim_pending_invitations");
    if (error) {
      throw new Error(error.message);
    }

    const parsed =
      typeof data === "number"
        ? data
        : typeof data === "string"
          ? Number(data)
          : Array.isArray(data) && data.length > 0
            ? Number(data[0])
            : 0;

    return Number.isFinite(parsed) ? parsed : 0;
  }, [unsafeSupabase]);

  const signIn = useCallback(
    async (email: string, password: string, _rememberMe = true) => {
      try {
        setLoading(true);

        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          return { error: error.message, role: null as AuthRole };
        }

        if (!data.user) {
          return { error: "User not found", role: null as AuthRole };
        }

        let nextRole = await getUserRole(data.user.id);
        if (!nextRole) {
          try {
            await claimPendingInvitations();
          } catch {
            // Non-blocking: keep original fallback behavior below.
          }

          nextRole = await getUserRole(data.user.id);
        }

        if (!nextRole) {
          return { error: "No organization access assigned", role: null as AuthRole };
        }

        // C-02 fix: Block login if email is not yet verified
        if (nextRole === ("pending_verification" as AuthRole)) {
          // Sign the user out so no session lingers
          await supabase.auth.signOut();
          return {
            error: "Please verify your email address before signing in. Check your inbox for the verification link.",
            role: null as AuthRole,
          };
        }

        cacheRole(data.user.id, nextRole);
        setRole(nextRole);
        setUser(data.user);
        setSession(data.session);

        return { error: null, role: nextRole };
      } catch (error: unknown) {
        return { error: getErrorMessage(error), role: null as AuthRole };
      } finally {
        setLoading(false);
      }
    },
    [cacheRole, claimPendingInvitations, getUserRole],
  );

  /** @deprecated Use signUpOrganization, signUpClientSelf, or invitation acceptance instead. */
  const signUp = useCallback(
    async (_email: string, _password: string, _firstName: string, _lastName: string, _signupType: string) => ({
      error: { message: "Legacy signup is disabled. Use organization signup, client self-signup, or accept an invitation." },
    }),
    [],
  );

  const signOut = useCallback(async () => {
    const userId = user?.id;
    setIsLoggingOut(true);

    if (userId) {
      sessionStorage.removeItem(`${ROLE_CACHE_KEY_PREFIX}${userId}`);
    }

    try {
      await supabase.auth.signOut();
    } finally {
      setUser(null);
      setSession(null);
      setRole(null);
      setIsLoggingOut(false);
    }
  }, [user?.id]);

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      setLoading(true);

      try {
        const {
          data: { session: nextSession },
        } = await supabase.auth.getSession();

        if (!mounted) return;

        if (!nextSession?.user) {
          setUser(null);
          setSession(null);
          setRole(null);
          return;
        }

        setUser(nextSession.user);
        setSession(nextSession);

        let nextRole = await getUserRole(nextSession.user.id);
        if (!nextRole) {
          try {
            await claimPendingInvitations();
            nextRole = await getUserRole(nextSession.user.id);
          } catch {
            // Keep best-effort role discovery only.
          }
        }
        if (!mounted) return;

        setRole(nextRole);
        cacheRole(nextSession.user.id, nextRole);
      } catch {
        if (mounted) {
          setUser(null);
          setSession(null);
          setRole(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (!mounted) return;

      if (event === "SIGNED_OUT" || !nextSession?.user) {
        setUser(null);
        setSession(null);
        setRole(null);
        setLoading(false);
        return;
      }

      setUser(nextSession.user);
      setSession(nextSession);

      let nextRole = await getUserRole(nextSession.user.id);
      if (!nextRole) {
        try {
          await claimPendingInvitations();
          nextRole = await getUserRole(nextSession.user.id);
        } catch {
          // Keep best-effort role discovery only.
        }
      }
      if (!mounted) return;

      setRole(nextRole);
      cacheRole(nextSession.user.id, nextRole);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [cacheRole, claimPendingInvitations, getUserRole]);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        role,
        loading,
        isLoggingOut,
        signIn,
        signUp,
        signUpOrganization,
        signUpClientSelf,
        acceptEmployeeInvitation,
        acceptClientInvitation,
        inviteEmployee,
        inviteClient,
        approveClientMembership,
        rejectClientMembership,
        sendPasswordReset,
        updatePassword,
        resendVerificationEmail,
        signOut,
        refreshRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
