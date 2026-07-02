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

// Human-readable labels for the feedback notification email. Kept local so
// this server-only email module has no dependency on the dashboard UI.
const FEEDBACK_SEVERITY_LABEL: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

// Short type name used in the subject line (e.g. "…High Bug - …").
const FEEDBACK_TYPE_SHORT: Record<string, string> = {
  bug: "Bug",
  feature_request: "Feature Request",
  confusing_ux: "Confusing UX",
  data_import_issue: "Data/Import Issue",
  other: "Other",
};

// Longer type description used in the email body.
const FEEDBACK_TYPE_LONG: Record<string, string> = {
  bug: "Report a bug",
  feature_request: "Request a feature",
  confusing_ux: "Something is confusing",
  data_import_issue: "Data/import issue",
  other: "Other",
};

const FEEDBACK_CATEGORY_LABEL: Record<string, string> = {
  general: "General",
  search_issue: "Search issue",
  upload_issue: "Upload issue",
  permission_issue: "Permission issue",
  file_download_issue: "File download issue",
  record_issue: "Record issue",
  network_sharing_issue: "Network sharing issue",
  data_import_issue: "Data/import issue",
  feature_request: "Feature request",
  confusing_ui: "Confusing UI",
  other: "Other",
};

const FEEDBACK_STATUS_LABEL: Record<string, string> = {
  open: "Open",
  in_review: "In Review",
  in_progress: "In Progress",
  fixed: "Fixed",
  closed: "Closed",
  wont_fix: "Won't Fix",
  need_more_info: "Need More Info",
};

// Best-effort notification to the platform team when new feedback arrives.
// Non-blocking by design: skips silently unless BOTH a Resend key and a
// recipient (FEEDBACK_NOTIFICATION_EMAIL) are configured. Never throws to the
// caller — a failed email must never fail a saved feedback report.
export async function sendFeedbackNotificationEmail(params: {
  companyName: string;
  reporterName: string;
  reporterEmail: string;
  feedbackType: string;
  category: string;
  severity: string;
  status: string;
  title: string;
  description: string;
  expectedBehavior: string | null;
  pageUrl: string | null;
  pathname: string | null;
  createdAt: string;
  detailUrl: string;
}): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const to =
    process.env.FEEDBACK_NOTIFICATION_EMAIL || process.env.FEEDBACK_NOTIFY_EMAIL;

  if (!apiKey) {
    console.warn(
      "[email] RESEND_API_KEY is not set — feedback notification email skipped."
    );
    return { sent: false };
  }
  if (!to) {
    console.warn(
      "[email] FEEDBACK_NOTIFICATION_EMAIL is not set — feedback notification email skipped."
    );
    return { sent: false };
  }

  const {
    companyName,
    reporterName,
    reporterEmail,
    feedbackType,
    category,
    severity,
    status,
    title,
    description,
    expectedBehavior,
    pageUrl,
    pathname,
    createdAt,
    detailUrl,
  } = params;

  const severityLabel = FEEDBACK_SEVERITY_LABEL[severity] ?? severity;
  const typeShort = FEEDBACK_TYPE_SHORT[feedbackType] ?? feedbackType;
  const typeLong = FEEDBACK_TYPE_LONG[feedbackType] ?? feedbackType;
  const categoryLabel = FEEDBACK_CATEGORY_LABEL[category] ?? category;
  const statusLabel = FEEDBACK_STATUS_LABEL[status] ?? status;
  const reporterDisplay = reporterName || "Unknown reporter";
  const createdDisplay = createdAt
    ? new Date(createdAt).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "";

  const subject = `New Casetra Feedback: ${severityLabel} ${typeShort} - ${title}`;

  // Escaped copies for the HTML variant.
  const eCompany = escapeHtml(companyName);
  const eReporter = escapeHtml(reporterDisplay);
  const eEmail = escapeHtml(reporterEmail);
  const eType = escapeHtml(typeLong);
  const eCategory = escapeHtml(categoryLabel);
  const eSeverity = escapeHtml(severityLabel);
  const eStatus = escapeHtml(statusLabel);
  const eTitle = escapeHtml(title);
  const eDescription = escapeHtml(description).replace(/\n/g, "<br />");
  const eExpected = expectedBehavior
    ? escapeHtml(expectedBehavior).replace(/\n/g, "<br />")
    : "";
  const ePage = pageUrl ? escapeHtml(pageUrl) : "";
  const ePathname = pathname ? escapeHtml(pathname) : "";
  const eCreated = escapeHtml(createdDisplay);
  const eDetail = escapeHtml(detailUrl);

  const html = `
  <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #111827;">
    <p style="font-size: 14px; color: #374151;">A new feedback report was submitted in Casetra.</p>
    <table style="font-size: 13px; line-height: 1.7; color: #374151; border-collapse: collapse; margin-bottom: 16px;">
      <tr><td style="padding-right: 12px; color: #6b7280;">Company</td><td>${eCompany}</td></tr>
      <tr><td style="padding-right: 12px; color: #6b7280;">Reporter</td><td>${eReporter}</td></tr>
      <tr><td style="padding-right: 12px; color: #6b7280;">Reporter email</td><td>${eEmail}</td></tr>
      <tr><td style="padding-right: 12px; color: #6b7280;">Type</td><td>${eType}</td></tr>
      <tr><td style="padding-right: 12px; color: #6b7280;">Category</td><td>${eCategory}</td></tr>
      <tr><td style="padding-right: 12px; color: #6b7280;">Severity</td><td>${eSeverity}</td></tr>
      <tr><td style="padding-right: 12px; color: #6b7280;">Status</td><td>${eStatus}</td></tr>
      ${eCreated ? `<tr><td style="padding-right: 12px; color: #6b7280;">Submitted</td><td>${eCreated}</td></tr>` : ""}
    </table>

    <h2 style="font-size: 15px; font-weight: 700; margin: 0 0 4px;">${eTitle}</h2>

    <p style="font-size: 12px; color: #6b7280; margin: 12px 0 2px;">Description</p>
    <p style="font-size: 13px; line-height: 1.6; color: #374151; margin: 0;">${eDescription}</p>

    ${
      eExpected
        ? `<p style="font-size: 12px; color: #6b7280; margin: 12px 0 2px;">Expected behavior</p>
    <p style="font-size: 13px; line-height: 1.6; color: #374151; margin: 0;">${eExpected}</p>`
        : ""
    }

    ${
      ePage
        ? `<p style="font-size: 12px; color: #6b7280; margin: 12px 0 2px;">Page</p>
    <p style="font-size: 13px; margin: 0;"><a href="${ePage}" style="color: #2563eb; word-break: break-all;">${ePage}</a></p>`
        : ""
    }
    ${
      ePathname
        ? `<p style="font-size: 12px; color: #6b7280; margin: 12px 0 2px;">Pathname</p>
    <p style="font-size: 13px; margin: 0; color: #374151;">${ePathname}</p>`
        : ""
    }

    <p style="margin: 24px 0;">
      <a href="${eDetail}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 10px 20px; border-radius: 8px;">
        View in platform admin
      </a>
    </p>
  </div>`;

  const text =
    `A new feedback report was submitted in Casetra.\n\n` +
    `Company: ${companyName}\n` +
    `Reporter: ${reporterDisplay}\n` +
    `Reporter email: ${reporterEmail}\n` +
    `Type: ${typeLong}\n` +
    `Category: ${categoryLabel}\n` +
    `Severity: ${severityLabel}\n` +
    `Status: ${statusLabel}\n` +
    (createdDisplay ? `Submitted: ${createdDisplay}\n` : "") +
    `\nTitle:\n${title}\n` +
    `\nDescription:\n${description}\n` +
    (expectedBehavior ? `\nExpected behavior:\n${expectedBehavior}\n` : "") +
    (pageUrl ? `\nPage:\n${pageUrl}\n` : "") +
    (pathname ? `\nPathname:\n${pathname}\n` : "") +
    `\nView in platform admin:\n${detailUrl}\n`;

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
      console.error("Resend feedback notification failed:", error.message ?? error);
      return { sent: false, error: "Email could not be delivered." };
    }
    return { sent: true };
  } catch (err) {
    console.error(
      "Resend feedback notification threw:",
      err instanceof Error ? err.message : err
    );
    return { sent: false, error: "Email could not be delivered." };
  }
}
