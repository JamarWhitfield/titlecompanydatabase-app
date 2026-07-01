import "server-only";
import { Resend } from "resend";

// Transactional email via Resend. Kept server-only so the API key never
// reaches the browser bundle.
//
// Configuration (env):
//   RESEND_API_KEY   required to actually send. When absent, sending is
//                    skipped (not an error) so local/dev and pre-configuration
//                    beta setups still work via the copy-the-link fallback.
//   RESEND_FROM      the verified sender, e.g. "Title Network
//                    <invites@yourdomain.com>". Defaults to Resend's shared
//                    onboarding sender, which only delivers to the account
//                    owner — set a real one before beta.

const FROM = process.env.RESEND_FROM || "Title Network <onboarding@resend.dev>";

export type EmailResult = { sent: boolean; error?: string };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendInvitationEmail(params: {
  to: string;
  companyName: string;
  inviterName: string;
  role: "admin" | "member";
  inviteLink: string;
}): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  // No key configured → skip silently. The caller still returns the token so
  // the admin can copy the link manually.
  if (!apiKey) {
    console.warn(
      "[email] RESEND_API_KEY is not set — invitation email skipped. " +
        "The invite link is still available to copy manually."
    );
    return { sent: false };
  }

  const { to, companyName, inviterName, role, inviteLink } = params;

  const company = escapeHtml(companyName);
  const inviter = escapeHtml(inviterName);
  const roleLabel = role === "admin" ? "an admin" : "a member";
  const safeLink = escapeHtml(inviteLink);

  const subject = `You've been invited to join ${companyName} on Title Network`;

  const html = `
  <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #111827;">
    <h1 style="font-size: 20px; font-weight: 700; margin-bottom: 8px;">Join ${company} on Title Network</h1>
    <p style="font-size: 14px; line-height: 1.6; color: #374151;">
      ${inviter} has invited you to join <strong>${company}</strong> as ${roleLabel}.
    </p>
    <p style="margin: 24px 0;">
      <a href="${safeLink}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 10px 20px; border-radius: 8px;">
        Accept invitation
      </a>
    </p>
    <p style="font-size: 12px; line-height: 1.6; color: #6b7280;">
      This invitation expires in 7 days. If the button doesn't work, copy and
      paste this link into your browser:<br />
      <a href="${safeLink}" style="color: #2563eb; word-break: break-all;">${safeLink}</a>
    </p>
    <p style="font-size: 12px; color: #9ca3af; margin-top: 24px;">
      If you weren't expecting this invitation, you can safely ignore this email.
    </p>
  </div>`;

  const text =
    `${inviterName} has invited you to join ${companyName} as ${roleLabel} on Title Network.\n\n` +
    `Accept your invitation (expires in 7 days):\n${inviteLink}\n\n` +
    `If you weren't expecting this invitation, you can safely ignore this email.`;

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: FROM,
      to,
      subject,
      html,
      text,
    });
    if (error) {
      console.error("Resend send failed:", error.message ?? error);
      return { sent: false, error: "Email could not be delivered." };
    }
    return { sent: true };
  } catch (err) {
    console.error(
      "Resend send threw:",
      err instanceof Error ? err.message : err
    );
    return { sent: false, error: "Email could not be delivered." };
  }
}
