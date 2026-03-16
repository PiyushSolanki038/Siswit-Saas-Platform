export type InvitationEmailType = "employee" | "client";

export interface InvitationEmailInput {
  inviteType: InvitationEmailType;
  organizationName: string;
  invitationUrl: string;
  expiresAt: string;
  inviterName?: string;
  roleLabel?: string;
}

export interface InvitationEmailContent {
  subject: string;
  html: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatExpiration(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.trim();
  }

  return `${new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date)} UTC`;
}

function getInviteCopy(inviteType: InvitationEmailType) {
  if (inviteType === "employee") {
    return {
      badge: "Employee Invitation",
      title: "Create your employee account",
      description: "Use the secure link below to set your password and finish joining your workspace.",
      buttonLabel: "Accept Employee Invitation",
      subjectLabel: "employee invitation",
    };
  }

  return {
    badge: "Client Invitation",
    title: "Create your client portal account",
    description: "Use the secure link below to set your password and finish your portal setup.",
    buttonLabel: "Accept Client Invitation",
    subjectLabel: "client invitation",
  };
}

export function buildInvitationEmail(input: InvitationEmailInput): InvitationEmailContent {
  const organizationName = input.organizationName.trim() || "SISWIT";
  const invitationUrl = input.invitationUrl.trim();
  const inviterName = input.inviterName?.trim() ?? "";
  const roleLabel = input.roleLabel?.trim() ?? "";
  const expirationLabel = formatExpiration(input.expiresAt);
  const copy = getInviteCopy(input.inviteType);

  const escapedOrganizationName = escapeHtml(organizationName);
  const escapedInvitationUrl = escapeHtml(invitationUrl);
  const escapedInviterName = escapeHtml(inviterName);
  const escapedRoleLabel = escapeHtml(roleLabel);
  const escapedExpirationLabel = escapeHtml(expirationLabel);

  const inviterBlock = inviterName
    ? `
      <tr>
        <td style="padding:0 0 12px;color:#475569;font-size:14px;font-weight:600;">Invited by</td>
        <td style="padding:0 0 12px;color:#0f172a;font-size:14px;">${escapedInviterName}</td>
      </tr>
    `
    : "";

  const roleBlock =
    input.inviteType === "employee" && roleLabel
      ? `
      <tr>
        <td style="padding:0 0 12px;color:#475569;font-size:14px;font-weight:600;">Role</td>
        <td style="padding:0 0 12px;color:#0f172a;font-size:14px;">${escapedRoleLabel}</td>
      </tr>
    `
      : "";

  const html = `
<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;background:#f8fafc;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border:1px solid #e2e8f0;border-radius:24px;overflow:hidden;">
            <tr>
              <td style="padding:32px 32px 12px;background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);">
                <div style="display:inline-block;padding:8px 12px;border-radius:999px;background:rgba(255,255,255,0.12);color:#e2e8f0;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">
                  ${copy.badge}
                </div>
                <h1 style="margin:16px 0 8px;font-size:30px;line-height:1.2;color:#ffffff;">${copy.title}</h1>
                <p style="margin:0;color:#cbd5e1;font-size:15px;line-height:1.6;">
                  ${escapeHtml(copy.description)}
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px 32px;">
                <p style="margin:0 0 20px;font-size:16px;line-height:1.7;color:#334155;">
                  You have been invited to join <strong>${escapedOrganizationName}</strong>.
                </p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;padding:20px;border-radius:18px;background:#f8fafc;border:1px solid #e2e8f0;">
                  <tr>
                    <td style="padding:0 0 12px;color:#475569;font-size:14px;font-weight:600;">Organization</td>
                    <td style="padding:0 0 12px;color:#0f172a;font-size:14px;">${escapedOrganizationName}</td>
                  </tr>
                  ${roleBlock}
                  ${inviterBlock}
                  <tr>
                    <td style="padding:0;color:#475569;font-size:14px;font-weight:600;">Expires</td>
                    <td style="padding:0;color:#0f172a;font-size:14px;">${escapedExpirationLabel}</td>
                  </tr>
                </table>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                  <tr>
                    <td align="center" style="border-radius:14px;background:#2563eb;">
                      <a href="${escapedInvitationUrl}" style="display:inline-block;padding:14px 22px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">
                        ${copy.buttonLabel}
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 8px;color:#475569;font-size:13px;line-height:1.6;">
                  If the button does not work, copy and paste this link into your browser:
                </p>
                <p style="margin:0 0 24px;padding:14px 16px;border-radius:14px;background:#f8fafc;border:1px solid #e2e8f0;color:#0f172a;font-size:13px;line-height:1.7;word-break:break-all;">
                  ${escapedInvitationUrl}
                </p>
                <p style="margin:0;color:#64748b;font-size:12px;line-height:1.6;">
                  This invite does not create your account until you open the link and submit the invitation form.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim();

  return {
    subject: `${organizationName} ${copy.subjectLabel}`,
    html,
  };
}
