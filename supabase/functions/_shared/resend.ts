/// <reference path="./edge-runtime.d.ts" />

// S-11: Support multiple CORS origins from environment variable
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? Deno.env.get("ALLOWED_ORIGIN") ?? "https://app.siswitinfra.com")
  .split(",")
  .map((o: string) => o.trim());

function getOriginHeader(request?: Request): string {
  const requestOrigin = request?.headers?.get("origin") ?? "";
  if (ALLOWED_ORIGINS.includes(requestOrigin)) {
    return requestOrigin;
  }
  // Fallback to first allowed origin for non-browser calls
  return ALLOWED_ORIGINS[0];
}

export function getCorsHeaders(request?: Request) {
  return {
    "Access-Control-Allow-Origin": getOriginHeader(request),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

// Backward-compatible default headers (uses first origin)
export const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGINS[0],
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export async function sendResendEmail(input: SendEmailInput): Promise<void> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    throw new Error("Missing RESEND_API_KEY");
  }

  const from = input.from ?? Deno.env.get("RESEND_FROM_EMAIL") ?? "SISWIT <noreply@siswitinfra.com>";

  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Resend error ${response.status}: ${text}`);
  }
}
