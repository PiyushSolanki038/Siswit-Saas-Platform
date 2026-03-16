/// <reference path="./edge-runtime.d.ts" />

// @ts-ignore
import nodemailer from "npm:nodemailer";

// S-11: Support multiple CORS origins from environment variable
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? Deno.env.get("ALLOWED_ORIGIN") ?? "https://app.siswitinfra.com")
  .split(",")
  .map((o: string) => o.trim());

function getOriginHeader(request?: Request): string {
  const requestOrigin = request?.headers?.get("origin") ?? "";
  
  // For safety in production, we still check allowed origins, but we also 
  // want to make sure local development from localhost always works.
  if (requestOrigin.startsWith("http://localhost:") || requestOrigin.startsWith("http://127.0.0.1:")) {
    return requestOrigin;
  }
  
  if (ALLOWED_ORIGINS.includes(requestOrigin)) {
    return requestOrigin;
  }
  
  // Fallback to the requested origin to prevent CORS errors during testing/setup,
  // or fallback to a default if none is provided.
  return requestOrigin || ALLOWED_ORIGINS[0] || "*";
}

export function getCorsHeaders(request?: Request) {
  return {
    "Access-Control-Allow-Origin": getOriginHeader(request),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  from?: string;
  fromName?: string;
}

export async function sendEmail(input: SendEmailInput): Promise<void> {
  const smtpHost = Deno.env.get("SMTP_HOST") || "smtp.hostinger.com";
  const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "465", 10);
  const smtpUser = Deno.env.get("SMTP_USER");
  const smtpPass = Deno.env.get("SMTP_PASS");
  const defaultSenderName = Deno.env.get("SMTP_SENDER_NAME") || "SISWIT";
  const fromEmail = input.from ?? Deno.env.get("SMTP_USER") ?? "info@shivamengineering.in";
  const fromName = input.fromName ?? defaultSenderName;

  if (!smtpHost || !smtpUser || !smtpPass) {
    throw new Error("Missing SMTP credentials");
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  try {
    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: input.to,
      subject: input.subject,
      html: input.html,
    });
    console.log("Message sent: %s", info.messageId);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("SMTP Delivery Error:", errMsg);
    throw new Error(`SMTP Delivery Failed: ${errMsg}`);
  }
}
