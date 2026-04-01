/// <reference path="../_shared/edge-runtime.d.ts" />

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---------- helpers ----------

function getCorsHeaders(req?: Request): Record<string, string> {
  const origin = req?.headers.get("origin") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };
}

function jsonResponse(
  status: number,
  body: Record<string, unknown>,
  req?: Request,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

// ---------- plan mapping ----------

const PLAN_ENV_MAP: Record<string, string> = {
  foundation: "RAZORPAY_PLAN_FOUNDATION",
  growth: "RAZORPAY_PLAN_GROWTH",
  commercial: "RAZORPAY_PLAN_COMMERCIAL",
  enterprise: "RAZORPAY_PLAN_ENTERPRISE",
};

// ---------- main handler ----------

interface CreateSubscriptionRequest {
  organization_id: string;
  plan_type: string;
  customer_id: string;
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" }, req);
  }

  try {
    console.log("📥 create-razorpay-subscription invoked");

    // ---------- Read env vars first ----------
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      console.error("Missing Supabase env vars", {
        hasUrl: !!supabaseUrl,
        hasAnon: !!supabaseAnonKey,
        hasService: !!supabaseServiceKey,
      });
      return jsonResponse(500, { error: "Server configuration error" }, req);
    }

    // ---------- Parse request body first ----------
    let payload: CreateSubscriptionRequest;
    try {
      payload = (await req.json()) as CreateSubscriptionRequest;
    } catch (parseErr) {
      console.error("Failed to parse request body:", parseErr);
      return jsonResponse(400, { error: "Invalid JSON body" }, req);
    }

    console.log("📦 Payload:", JSON.stringify(payload));

    if (!payload.organization_id || !payload.plan_type || !payload.customer_id) {
      return jsonResponse(400, {
        error: "Missing required fields: organization_id, plan_type, customer_id",
      }, req);
    }

    // ---------- Auth verification ----------
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      console.log("❌ No authorization header");
      return jsonResponse(401, { error: "Missing authorization header" }, req);
    }

    console.log("🔑 Auth header present, verifying user...");

    // Create a client with the user's JWT to verify identity
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: authError } = await userClient.auth.getUser();
    if (authError || !userData?.user) {
      console.error("❌ Auth failed:", authError?.message ?? "No user returned");
      return jsonResponse(401, {
        error: "Unauthorized — please sign in again",
        detail: authError?.message,
      }, req);
    }

    const user = userData.user;
    console.log("✅ User verified:", user.id);

    // ---------- Verify user is owner/admin ----------
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: membership, error: memberError } = await serviceClient
      .from("organization_memberships")
      .select("role")
      .eq("organization_id", payload.organization_id)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (memberError || !membership) {
      console.error("❌ Membership check failed:", memberError?.message);
      return jsonResponse(403, { error: "Not a member of this organization" }, req);
    }

    if (!["owner", "admin"].includes(membership.role)) {
      return jsonResponse(403, {
        error: "Only owners and admins can create subscriptions",
      }, req);
    }

    console.log("✅ Role verified:", membership.role);

    // ---------- Validate plan type ----------
    const planEnvKey = PLAN_ENV_MAP[payload.plan_type];
    if (!planEnvKey) {
      return jsonResponse(400, {
        error: `Invalid plan type: ${payload.plan_type}`,
      }, req);
    }

    const razorpayPlanId = Deno.env.get(planEnvKey);
    if (!razorpayPlanId) {
      console.error(`❌ Missing env var: ${planEnvKey}`);
      return jsonResponse(500, {
        error: `Razorpay plan ID not configured for ${payload.plan_type}. Set ${planEnvKey} in Edge Function secrets.`,
      }, req);
    }

    // ---------- Create Razorpay subscription ----------
    const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID");
    const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET");

    if (!razorpayKeyId || !razorpayKeySecret) {
      console.error("❌ Missing Razorpay API keys");
      return jsonResponse(500, {
        error: "Razorpay API keys not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Edge Function secrets.",
      }, req);
    }

    console.log("🔄 Creating Razorpay subscription...");

    const basicAuth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);

    const razorpayResponse = await fetch(
      "https://api.razorpay.com/v1/subscriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${basicAuth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          plan_id: razorpayPlanId,
          customer_id: payload.customer_id,
          total_count: 120,
          quantity: 1,
          notes: {
            organization_id: payload.organization_id,
            plan_type: payload.plan_type,
          },
        }),
      },
    );

    if (!razorpayResponse.ok) {
      const errorBody = await razorpayResponse.text();
      console.error("❌ Razorpay API error:", razorpayResponse.status, errorBody);
      return jsonResponse(502, {
        error: "Failed to create subscription with Razorpay",
        details: errorBody,
      }, req);
    }

    const razorpayData = (await razorpayResponse.json()) as {
      id: string;
      short_url: string;
      status: string;
    };

    console.log(
      `✅ Razorpay subscription created: ${razorpayData.id} for org ${payload.organization_id}`,
    );

    // ---------- Store subscription reference ----------
    const { error: updateErr } = await serviceClient
      .from("organization_subscriptions")
      .update({
        razorpay_subscription_id: razorpayData.id,
        razorpay_plan_id: razorpayPlanId,
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", payload.organization_id);

    if (updateErr) {
      console.error("⚠️ Failed to store subscription ref:", updateErr.message);
      // Don't fail — the Razorpay subscription was already created
    }

    return jsonResponse(200, {
      subscription_id: razorpayData.id,
      short_url: razorpayData.short_url,
      status: razorpayData.status,
    }, req);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("💥 Unhandled error:", message);
    return jsonResponse(500, { error: message }, req);
  }
});
