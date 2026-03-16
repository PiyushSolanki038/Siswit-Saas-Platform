/// <reference path="../_shared/edge-runtime.d.ts" />

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildInvitationEmail } from "../_shared/invitation-email.ts";
import { getCorsHeaders, sendEmail } from "../_shared/email.ts";

interface ClientInvitePayload {
  recipientEmail: string;
  organizationId: string;
  organizationName: string;
  organizationCode: string;
  inviterName?: string;
  expiresAt: string;
  invitationUrl: string;
  authRedirectTo?: string;
}

function jsonResponse(status: number, body: Record<string, unknown>, req?: Request): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      throw new Error("Missing Supabase env vars");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse(401, { error: "Missing authorization" }, req);
    }

    const requesterClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await requesterClient.auth.getUser();

    if (userError || !user) {
      return jsonResponse(401, { error: "Unauthorized" }, req);
    }

    const payload = (await req.json()) as ClientInvitePayload;

    if (
      !payload.recipientEmail ||
      !payload.organizationId ||
      !payload.organizationName ||
      !payload.organizationCode ||
      !payload.invitationUrl?.trim()
    ) {
      return jsonResponse(400, { error: "Invalid payload" }, req);
    }

    let invitationUrl: string;
    try {
      invitationUrl = new URL(payload.invitationUrl.trim()).toString();
    } catch {
      return jsonResponse(400, { error: "Invalid invitationUrl" }, req);
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: inviterMembership, error: inviterMembershipError } = await adminClient
      .from("organization_memberships")
      .select("id")
      .eq("organization_id", payload.organizationId)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .in("account_state", ["active", "pending_verification"])
      .in("role", ["owner", "admin"])
      .maybeSingle();

    if (inviterMembershipError) {
      return jsonResponse(500, { error: inviterMembershipError.message }, req);
    }

    if (!inviterMembership) {
      return jsonResponse(403, { error: "Only organization owner/admin can send invitations." }, req);
    }

    // Rate limit: max 50 client invitations per org per hour
    const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
    const { count, error: rateLimitError } = await adminClient
      .from("client_invitations")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", payload.organizationId)
      .gte("created_at", oneHourAgo);

    if (rateLimitError) {
      return jsonResponse(500, { error: rateLimitError.message }, req);
    }

    if ((count ?? 0) >= 50) {
      return jsonResponse(429, { error: "Too many invitations sent. Please try again later." }, req);
    }

    const emailContent = buildInvitationEmail({
      inviteType: "client",
      organizationName: payload.organizationName,
      invitationUrl,
      expiresAt: payload.expiresAt,
      inviterName: payload.inviterName ?? user.email ?? payload.organizationName,
    });

    await sendEmail({
      to: payload.recipientEmail.trim(),
      subject: emailContent.subject,
      html: emailContent.html,
    });

    return jsonResponse(200, { ok: true, provider: "smtp" }, req);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse(500, { error: message }, req);
  }
});
