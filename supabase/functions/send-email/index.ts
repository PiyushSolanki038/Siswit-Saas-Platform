/// <reference path="../_shared/edge-runtime.d.ts" />

import { getCorsHeaders, sendEmail } from "../_shared/email.ts";

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  from?: string;
  fromName?: string;
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
    const payload = (await req.json()) as EmailPayload;

    if (!payload.to || !payload.subject || !payload.html) {
      return jsonResponse(400, { error: "Missing required fields: to, subject, html" }, req);
    }

    await sendEmail({
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      from: payload.from,
      fromName: payload.fromName,
    });

    return jsonResponse(200, { ok: true }, req);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse(500, { error: message }, req);
  }
});
