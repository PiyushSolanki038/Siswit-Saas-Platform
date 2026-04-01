/// <reference path="../_shared/edge-runtime.d.ts" />

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---------- helpers ----------

function getCorsHeaders(req?: Request): Record<string, string> {
  const origin = req?.headers.get("origin") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-razorpay-signature",
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

/** HMAC-SHA256 verification of Razorpay webhook signature */
async function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signedBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(rawBody),
  );
  const expectedSignature = Array.from(new Uint8Array(signedBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return expectedSignature === signature;
}

// ---------- plan mapping ----------

const PLAN_ID_TO_TYPE: Record<string, string> = {};

function initPlanMapping() {
  const plans = ["FOUNDATION", "GROWTH", "COMMERCIAL", "ENTERPRISE"] as const;
  for (const plan of plans) {
    const planId = Deno.env.get(`RAZORPAY_PLAN_${plan}`);
    if (planId) {
      PLAN_ID_TO_TYPE[planId] = plan.toLowerCase();
    }
  }
}

function getPlanTypeFromRazorpayPlanId(razorpayPlanId: string): string {
  return PLAN_ID_TO_TYPE[razorpayPlanId] ?? "foundation";
}

// ---------- event handlers ----------

interface WebhookPayload {
  event: string;
  payload: {
    subscription?: {
      entity: {
        id: string;
        plan_id: string;
        customer_id: string;
        status: string;
        notes?: Record<string, string>;
      };
    };
    payment?: {
      entity: {
        id: string;
        amount: number;
        status: string;
        subscription_id?: string;
        notes?: Record<string, string>;
      };
    };
  };
}

async function handleSubscriptionActivated(
  supabase: ReturnType<typeof createClient>,
  payload: WebhookPayload,
) {
  const sub = payload.payload.subscription?.entity;
  if (!sub) throw new Error("No subscription entity in payload");

  const orgId = sub.notes?.organization_id;
  if (!orgId) throw new Error("No organization_id in subscription notes");

  const planType = getPlanTypeFromRazorpayPlanId(sub.plan_id);

  const { error } = await supabase.rpc("activate_subscription", {
    p_org_id: orgId,
    p_plan_type: planType,
    p_razorpay_sub_id: sub.id,
    p_razorpay_plan_id: sub.plan_id,
  });

  if (error) throw new Error(`activate_subscription failed: ${error.message}`);
  console.log(`✅ Subscription activated for org ${orgId}, plan ${planType}`);
}

async function handleSubscriptionCharged(
  supabase: ReturnType<typeof createClient>,
  payload: WebhookPayload,
) {
  const payment = payload.payload.payment?.entity;
  const sub = payload.payload.subscription?.entity;
  if (!payment) throw new Error("No payment entity in payload");

  const orgId =
    payment.notes?.organization_id ?? sub?.notes?.organization_id;
  if (!orgId) throw new Error("No organization_id in notes");

  const planType = sub?.plan_id
    ? getPlanTypeFromRazorpayPlanId(sub.plan_id)
    : null;

  // Log payment success event
  const { error } = await supabase.from("subscription_events").insert({
    organization_id: orgId,
    event_type: "payment_success",
    plan_type: planType,
    amount: payment.amount,
    razorpay_payment_id: payment.id,
    razorpay_subscription_id: sub?.id ?? payment.subscription_id,
    metadata: {
      payment_status: payment.status,
      charged_at: new Date().toISOString(),
    },
  });

  if (error)
    console.error("Failed to log payment_success event:", error.message);

  // Update subscription end date (+30 days from now)
  if (orgId) {
    await supabase
      .from("organization_subscriptions")
      .update({
        subscription_end_date: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", orgId);
  }

  console.log(`✅ Payment charged for org ${orgId}: ₹${payment.amount / 100}`);
}

async function handleSubscriptionCancelled(
  supabase: ReturnType<typeof createClient>,
  payload: WebhookPayload,
) {
  const sub = payload.payload.subscription?.entity;
  if (!sub) throw new Error("No subscription entity in payload");

  const orgId = sub.notes?.organization_id;
  if (!orgId) throw new Error("No organization_id in subscription notes");

  const { error } = await supabase.rpc("cancel_subscription", {
    p_org_id: orgId,
    p_reason: "Cancelled via Razorpay",
  });

  if (error) throw new Error(`cancel_subscription failed: ${error.message}`);
  console.log(`✅ Subscription cancelled for org ${orgId}`);
}

async function handlePaymentFailed(
  supabase: ReturnType<typeof createClient>,
  payload: WebhookPayload,
) {
  const payment = payload.payload.payment?.entity;
  const sub = payload.payload.subscription?.entity;
  if (!payment) throw new Error("No payment entity in payload");

  const orgId =
    payment.notes?.organization_id ?? sub?.notes?.organization_id;
  if (!orgId) throw new Error("No organization_id in notes");

  // Log payment failed event
  const { error } = await supabase.from("subscription_events").insert({
    organization_id: orgId,
    event_type: "payment_failed",
    amount: payment.amount,
    razorpay_payment_id: payment.id,
    razorpay_subscription_id: sub?.id ?? payment.subscription_id,
    metadata: {
      payment_status: payment.status,
      failed_at: new Date().toISOString(),
    },
  });

  if (error)
    console.error("Failed to log payment_failed event:", error.message);

  // Send notification to org owner
  try {
    const { data: org } = await supabase
      .from("organizations")
      .select("owner_user_id")
      .eq("id", orgId)
      .single();

    if (org?.owner_user_id) {
      await supabase.from("notifications").insert({
        user_id: org.owner_user_id,
        organization_id: orgId,
        type: "payment_failed",
        title: "Payment Failed",
        message: `Your subscription payment of ₹${payment.amount / 100} failed. Please update your payment method.`,
        metadata: { razorpay_payment_id: payment.id },
      });
    }
  } catch (notifErr) {
    console.error("Failed to send payment failure notification:", notifErr);
  }

  console.log(`⚠️ Payment failed for org ${orgId}`);
}

// ---------- main handler ----------

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  // Only accept POST
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" }, req);
  }

  try {
    // Read raw body for signature verification
    const rawBody = await req.text();

    // Verify webhook signature
    const webhookSecret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
    if (!webhookSecret) {
      console.error("RAZORPAY_WEBHOOK_SECRET not configured");
      return jsonResponse(500, { error: "Webhook secret not configured" }, req);
    }

    const signature = req.headers.get("x-razorpay-signature");
    if (!signature) {
      return jsonResponse(400, { error: "Missing signature header" }, req);
    }

    const isValid = await verifyWebhookSignature(rawBody, signature, webhookSecret);
    if (!isValid) {
      console.error("Invalid webhook signature");
      return jsonResponse(400, { error: "Invalid signature" }, req);
    }

    // Parse payload
    const payload = JSON.parse(rawBody) as WebhookPayload;
    console.log(`📩 Webhook received: ${payload.event}`);

    // Initialize plan mapping
    initPlanMapping();

    // Create Supabase client with service_role to bypass RLS
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Route to handler
    switch (payload.event) {
      case "subscription.activated":
        await handleSubscriptionActivated(supabase, payload);
        break;
      case "subscription.charged":
        await handleSubscriptionCharged(supabase, payload);
        break;
      case "subscription.cancelled":
        await handleSubscriptionCancelled(supabase, payload);
        break;
      case "payment.failed":
        await handlePaymentFailed(supabase, payload);
        break;
      default:
        console.log(`ℹ️ Unhandled webhook event: ${payload.event}`);
    }

    return jsonResponse(200, { ok: true, event: payload.event }, req);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Webhook handler error:", message);
    return jsonResponse(500, { error: message }, req);
  }
});
