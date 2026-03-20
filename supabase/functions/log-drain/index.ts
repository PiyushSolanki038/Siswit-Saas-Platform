/// <reference path="../_shared/edge-runtime.d.ts" />
import { getCorsHeaders } from "../_shared/email.ts";

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
    const payload = await req.json();

    // In a real application, you would:
    // 1. Validate a secret key in the header
    // 2. Insert into a "system_logs" table
    // 3. Or forward to an external aggregator like Datadog/CloudWatch

    console.log(`[LOG-DRAIN] [${payload.level}] ${payload.message}`, payload);

    return jsonResponse(200, { ok: true }, req);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse(400, { error: message }, req);
  }
});
