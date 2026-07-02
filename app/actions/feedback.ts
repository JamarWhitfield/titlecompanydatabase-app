"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession, getProfile } from "@/lib/dal";
import { getCurrentPlatformRole } from "@/lib/platform-auth";
import { sendFeedbackNotificationEmail } from "@/lib/email";
import type { FeedbackStatus } from "@/types/database";

// ────────────────────────────────────────────────────────────
// Controlled vocabularies (must match the CHECK constraints in
// supabase/migrations/0028_feedback_reports.sql).
// ────────────────────────────────────────────────────────────
const FEEDBACK_TYPES = [
  "bug",
  "feature_request",
  "confusing_ux",
  "data_import_issue",
  "other",
] as const;

const FEEDBACK_CATEGORIES = [
  "general",
  "search_issue",
  "upload_issue",
  "permission_issue",
  "file_download_issue",
  "record_issue",
  "network_sharing_issue",
  "data_import_issue",
  "feature_request",
  "confusing_ui",
  "other",
] as const;

const FEEDBACK_SEVERITIES = ["low", "medium", "high", "critical"] as const;

const FEEDBACK_STATUSES = [
  "open",
  "in_review",
  "in_progress",
  "fixed",
  "closed",
  "wont_fix",
  "need_more_info",
] as const;

// Statuses that count as "resolved" — reaching one stamps resolved_at/by;
// leaving one clears them.
const RESOLVED_STATUSES: FeedbackStatus[] = ["fixed", "closed", "wont_fix"];

const SCREENSHOT_BUCKET = "feedback-screenshots";
const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_SCREENSHOT_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

const PLATFORM_BUGS_PATH = "/dashboard/platform/bugs";

// Field length caps (mirror the UI + protect the DB).
const MAX_TITLE = 200;
const MAX_DESCRIPTION = 5000;
const MAX_EXPECTED = 3000;
const MAX_RELATED_URL = 1000;
const MAX_STATUS_NOTE = 3000;
const MAX_INTERNAL_NOTE = 3000;
const MAX_PAGE_URL = 2000;
const MAX_PATHNAME = 1000;
const MAX_USER_AGENT = 2000;
const MAX_LANGUAGE = 100;
const MAX_PLATFORM = 200;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ────────────────────────────────────────────────────────────
// Small parsing/validation helpers
// ────────────────────────────────────────────────────────────

// Trim a user-entered string; return null when empty.
function text(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// Auto-captured metadata: trim and TRUNCATE to a cap (be lenient — never block
// a legitimate submission over telemetry length).
function metaString(
  value: FormDataEntryValue | null,
  max: number
): string | null {
  const t = text(value);
  return t === null ? null : t.slice(0, max);
}

// Parse a non-negative integer within a sane bound; anything else → null.
function metaInt(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 0 || n > 100000) return null;
  return n;
}

// Strip any path components + unsafe characters so a crafted filename can never
// cause path traversal or escape the report folder.
function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "screenshot";
  const cleaned = base
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^\.+/, "");
  return cleaned.slice(0, 100) || "screenshot";
}

// Resolve the site's base URL server-side (env override, then request headers).
async function getBaseUrl(): Promise<string | null> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (configured) return configured;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return null;
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

// ════════════════════════════════════════════════════════════
// Action 1 — submitFeedbackReport (any authenticated company user)
// ════════════════════════════════════════════════════════════
export async function submitFeedbackReport(
  formData: FormData
): Promise<{ error?: string; reportId?: string }> {
  const profile = await getProfile();
  if (!profile) {
    const user = await getSession();
    return {
      error: user
        ? "Could not find your company membership."
        : "You must be signed in to submit feedback.",
    };
  }
  // company_id is ALWAYS derived server-side from the caller's membership —
  // never taken from the client. RLS re-enforces this on insert.
  const companyId = profile.company_id;
  if (!companyId) return { error: "Could not find your company membership." };

  // ── User-entered fields ─────────────────────────────────────
  const feedbackType = text(formData.get("feedback_type"));
  if (!feedbackType || !FEEDBACK_TYPES.includes(feedbackType as never)) {
    return { error: "Choose a valid feedback type." };
  }

  const categoryRaw = text(formData.get("category")) ?? "general";
  if (!FEEDBACK_CATEGORIES.includes(categoryRaw as never)) {
    return { error: "Choose a valid category." };
  }

  const severity = text(formData.get("severity")) ?? "low";
  if (!FEEDBACK_SEVERITIES.includes(severity as never)) {
    return { error: "Choose a valid severity." };
  }

  const title = text(formData.get("title"));
  if (!title) return { error: "Please enter a title." };
  if (title.length > MAX_TITLE) {
    return { error: `Title must be ${MAX_TITLE} characters or fewer.` };
  }

  const description = text(formData.get("description"));
  if (!description) return { error: "Please enter a description." };
  if (description.length > MAX_DESCRIPTION) {
    return {
      error: `Description must be ${MAX_DESCRIPTION} characters or fewer.`,
    };
  }

  const expectedBehavior = text(formData.get("expected_behavior"));
  if (expectedBehavior && expectedBehavior.length > MAX_EXPECTED) {
    return {
      error: `Expected behavior must be ${MAX_EXPECTED} characters or fewer.`,
    };
  }

  const relatedResourceUrl = text(formData.get("related_resource_url"));
  if (relatedResourceUrl && relatedResourceUrl.length > MAX_RELATED_URL) {
    return { error: "That related link is too long." };
  }

  // Related record/file ids: accept only well-formed UUIDs, and only keep them
  // if they actually belong to the caller's company. A bad or foreign id is
  // silently dropped rather than blocking the submission.
  const supabase = await createClient();

  let relatedRecordId = text(formData.get("related_record_id"));
  if (relatedRecordId) {
    if (!UUID_RE.test(relatedRecordId)) {
      relatedRecordId = null;
    } else {
      const { data } = await supabase
        .from("company_records")
        .select("id")
        .eq("id", relatedRecordId)
        .eq("company_id", companyId)
        .maybeSingle();
      if (!data) relatedRecordId = null;
    }
  }

  let relatedFileId = text(formData.get("related_file_id"));
  if (relatedFileId) {
    if (!UUID_RE.test(relatedFileId)) {
      relatedFileId = null;
    } else {
      const { data } = await supabase
        .from("record_files")
        .select("id")
        .eq("id", relatedFileId)
        .eq("company_id", companyId)
        .maybeSingle();
      if (!data) relatedFileId = null;
    }
  }

  // ── Optional screenshot: validate BEFORE inserting so we never create a
  // report we then have to unwind. ───────────────────────────
  const screenshotEntry = formData.get("screenshot");
  const screenshot =
    screenshotEntry instanceof File && screenshotEntry.size > 0
      ? screenshotEntry
      : null;
  if (screenshot) {
    if (!ALLOWED_SCREENSHOT_MIME.has(screenshot.type)) {
      return { error: "Screenshot must be a PNG, JPG, or WEBP file." };
    }
    if (screenshot.size > MAX_SCREENSHOT_BYTES) {
      return { error: "Screenshot must be less than 5 MB." };
    }
  }

  // ── Insert the report. The DB trigger writes the initial 'open'
  // status-history row automatically (normal users are not allowed to insert
  // status history directly). ─────────────────────────────────
  const { data: inserted, error: insertError } = await supabase
    .from("feedback_reports")
    .insert({
      company_id: companyId,
      reporter_id: profile.id,
      feedback_type: feedbackType,
      category: categoryRaw,
      severity,
      status: "open",
      title,
      description,
      expected_behavior: expectedBehavior,
      page_url: metaString(formData.get("page_url"), MAX_PAGE_URL),
      pathname: metaString(formData.get("pathname"), MAX_PATHNAME),
      related_resource_url: relatedResourceUrl,
      related_record_id: relatedRecordId,
      related_file_id: relatedFileId,
      browser_user_agent: metaString(
        formData.get("browser_user_agent"),
        MAX_USER_AGENT
      ),
      browser_language: metaString(
        formData.get("browser_language"),
        MAX_LANGUAGE
      ),
      browser_platform: metaString(
        formData.get("browser_platform"),
        MAX_PLATFORM
      ),
      screen_width: metaInt(formData.get("screen_width")),
      screen_height: metaInt(formData.get("screen_height")),
      viewport_width: metaInt(formData.get("viewport_width")),
      viewport_height: metaInt(formData.get("viewport_height")),
    })
    .select("id, created_at")
    .single();

  if (insertError || !inserted) {
    console.error("Failed to insert feedback report:", insertError?.message);
    return { error: "Could not submit feedback. Please try again." };
  }

  const reportId = inserted.id;

  // ── Upload the screenshot (best-effort). A failure here must not lose the
  // already-saved report — we log and continue. ───────────────
  if (screenshot) {
    const safeName = sanitizeFilename(screenshot.name);
    const path = `${companyId}/${reportId}/${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from(SCREENSHOT_BUCKET)
      .upload(path, screenshot, {
        contentType: screenshot.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      console.error(
        "Feedback screenshot upload failed:",
        uploadError.message
      );
    } else {
      const { error: metaError } = await supabase
        .from("feedback_reports")
        .update({
          screenshot_storage_path: path,
          screenshot_original_filename: screenshot.name.slice(0, 255),
          screenshot_mime_type: screenshot.type,
          screenshot_size_bytes: screenshot.size,
        })
        .eq("id", reportId);
      if (metaError) {
        console.error(
          "Failed to save screenshot metadata:",
          metaError.message
        );
        // Remove the now-unreferenced object so it isn't left dangling.
        await supabase.storage.from(SCREENSHOT_BUCKET).remove([path]);
      }
    }
  }

  // ── Optional notification email (never blocks; no-op unless configured). ──
  try {
    const user = await getSession();
    const baseUrl = await getBaseUrl();
    await sendFeedbackNotificationEmail({
      companyName: profile.companies?.name ?? "Unknown company",
      reporterName: profile.full_name ?? "",
      reporterEmail: user?.email ?? "",
      feedbackType,
      category: categoryRaw,
      severity,
      status: "open",
      title,
      description,
      expectedBehavior,
      pageUrl: metaString(formData.get("page_url"), MAX_PAGE_URL),
      pathname: metaString(formData.get("pathname"), MAX_PATHNAME),
      createdAt: inserted.created_at,
      detailUrl: baseUrl
        ? `${baseUrl}${PLATFORM_BUGS_PATH}/${reportId}`
        : `${PLATFORM_BUGS_PATH}/${reportId}`,
    });
  } catch (err) {
    console.error(
      "Feedback notification email threw:",
      err instanceof Error ? err.message : err
    );
  }

  revalidatePath(PLATFORM_BUGS_PATH);
  return { reportId };
}

// ════════════════════════════════════════════════════════════
// Action 2 — updateFeedbackStatus (platform admin only)
// ════════════════════════════════════════════════════════════
export async function updateFeedbackStatus(
  reportId: string,
  newStatus: string,
  note?: string
): Promise<{ error?: string }> {
  const user = await getSession();
  if (!user) return { error: "You must be signed in." };
  if (!(await getCurrentPlatformRole())) {
    return { error: "You do not have permission to manage feedback." };
  }

  if (!reportId || !UUID_RE.test(reportId)) {
    return { error: "Feedback report not found." };
  }
  if (!FEEDBACK_STATUSES.includes(newStatus as never)) {
    return { error: "Please choose a valid status." };
  }

  const statusNote = note?.trim() || null;
  if (statusNote && statusNote.length > MAX_STATUS_NOTE) {
    return { error: `Note must be ${MAX_STATUS_NOTE} characters or fewer.` };
  }

  const supabase = await createClient();

  // Platform admins can read all reports (RLS). Fetch the current status.
  const { data: existing, error: fetchError } = await supabase
    .from("feedback_reports")
    .select("id, status")
    .eq("id", reportId)
    .maybeSingle();

  if (fetchError) {
    console.error("Failed to load feedback report:", fetchError.message);
    return { error: "Could not update status." };
  }
  if (!existing) return { error: "Feedback report not found." };

  const oldStatus = existing.status;
  if (oldStatus === newStatus) {
    return { error: "This report already has that status." };
  }

  const nowResolved = RESOLVED_STATUSES.includes(newStatus as FeedbackStatus);
  const updates: {
    status: string;
    resolved_at: string | null;
    resolved_by: string | null;
  } = {
    status: newStatus,
    resolved_at: nowResolved ? new Date().toISOString() : null,
    resolved_by: nowResolved ? user.id : null,
  };

  const { data: updated, error: updateError } = await supabase
    .from("feedback_reports")
    .update(updates)
    .eq("id", reportId)
    .select("id")
    .maybeSingle();

  if (updateError) {
    console.error("Failed to update feedback status:", updateError.message);
    return { error: "Could not update status." };
  }
  // A blocked update (non-platform-admin) affects 0 rows.
  if (!updated) {
    return { error: "You do not have permission to manage feedback." };
  }

  const { error: historyError } = await supabase
    .from("feedback_status_history")
    .insert({
      feedback_report_id: reportId,
      changed_by: user.id,
      old_status: oldStatus,
      new_status: newStatus,
      note: statusNote,
    });
  if (historyError) {
    // The status change succeeded; log the history failure but don't fail.
    console.error(
      "Failed to record status history:",
      historyError.message
    );
  }

  revalidatePath(PLATFORM_BUGS_PATH);
  revalidatePath(`${PLATFORM_BUGS_PATH}/${reportId}`);
  return {};
}

// ════════════════════════════════════════════════════════════
// Action 3 — addFeedbackInternalNote (platform admin only)
// ════════════════════════════════════════════════════════════
export async function addFeedbackInternalNote(
  reportId: string,
  note: string
): Promise<{ error?: string }> {
  const user = await getSession();
  if (!user) return { error: "You must be signed in." };
  if (!(await getCurrentPlatformRole())) {
    return { error: "You do not have permission to manage feedback." };
  }

  if (!reportId || !UUID_RE.test(reportId)) {
    return { error: "Feedback report not found." };
  }

  const noteText = note?.trim();
  if (!noteText) return { error: "Please enter a note." };
  if (noteText.length > MAX_INTERNAL_NOTE) {
    return { error: `Note must be ${MAX_INTERNAL_NOTE} characters or fewer.` };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("feedback_internal_notes")
    .insert({
      feedback_report_id: reportId,
      author_id: user.id,
      note: noteText,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Failed to add internal note:", error.message);
    return { error: "Could not add note." };
  }
  // RLS rejects non-platform-admins → 0 rows.
  if (!data) {
    return { error: "You do not have permission to manage feedback." };
  }

  revalidatePath(`${PLATFORM_BUGS_PATH}/${reportId}`);
  return {};
}

// ════════════════════════════════════════════════════════════
// Action 4 — getFeedbackScreenshotSignedUrl (platform admin only)
//
// The screenshot bucket is private with NO client read policy. Platform admins
// are not members of the reporter's company, so a short-lived signed URL must
// be minted with the service-role client — after verifying platform admin and
// resolving the storage path server-side. The path is never returned.
// ════════════════════════════════════════════════════════════
export async function getFeedbackScreenshotSignedUrl(
  reportId: string
): Promise<{ url?: string; error?: string }> {
  const user = await getSession();
  if (!user) return { error: "You must be signed in." };
  if (!(await getCurrentPlatformRole())) {
    return { error: "You do not have permission to view this screenshot." };
  }

  if (!reportId || !UUID_RE.test(reportId)) {
    return { error: "Feedback report not found." };
  }

  const supabase = await createClient();
  const { data: report, error } = await supabase
    .from("feedback_reports")
    .select("screenshot_storage_path")
    .eq("id", reportId)
    .maybeSingle();

  if (error) {
    console.error("Failed to load feedback report:", error.message);
    return { error: "Could not load the screenshot." };
  }
  if (!report) return { error: "Feedback report not found." };
  if (!report.screenshot_storage_path) {
    return { error: "This report has no screenshot." };
  }

  const admin = createAdminClient();
  const { data: signed, error: signError } = await admin.storage
    .from(SCREENSHOT_BUCKET)
    .createSignedUrl(report.screenshot_storage_path, 3600);

  if (signError || !signed) {
    console.error("Failed to sign screenshot URL:", signError?.message);
    return { error: "Could not generate a screenshot link." };
  }

  return { url: signed.signedUrl };
}
