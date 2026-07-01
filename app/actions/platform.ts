"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentPlatformRole } from "@/lib/platform-auth";
import type { PlatformRole } from "@/types/database";

const BUCKET = "record-files";
const MAX_REASON = 500;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Every action re-verifies platform authorization server-side. The underlying
// SECURITY DEFINER RPCs enforce the same checks in the database, so even a
// forged request cannot bypass them — these guards just return friendly errors.

// ── Platform admin management (owner-only) ─────────────────────────

export async function addPlatformAdmin(
  email: string,
  role: PlatformRole
): Promise<{ error?: string }> {
  if ((await getCurrentPlatformRole()) !== "owner") {
    return { error: "Only platform owners can add platform admins." };
  }
  const trimmed = email.trim().toLowerCase();
  if (!EMAIL_RE.test(trimmed)) return { error: "Enter a valid email address." };
  if (!["owner", "support", "auditor"].includes(role)) {
    return { error: "Invalid platform role." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("platform_add_admin", {
    target_email: trimmed,
    target_role: role,
  });
  if (error) {
    return { error: friendly(error.message, "Failed to add platform admin.") };
  }

  revalidatePath("/dashboard/platform/admins");
  return {};
}

export async function setPlatformAdminRole(
  userId: string,
  role: PlatformRole
): Promise<{ error?: string }> {
  if ((await getCurrentPlatformRole()) !== "owner") {
    return { error: "Only platform owners can change platform roles." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("platform_set_admin_role", {
    target_user: userId,
    new_role: role,
  });
  if (error) {
    return { error: friendly(error.message, "Failed to change platform role.") };
  }

  revalidatePath("/dashboard/platform/admins");
  return {};
}

export async function setPlatformAdminEnabled(
  userId: string,
  enabled: boolean
): Promise<{ error?: string }> {
  if ((await getCurrentPlatformRole()) !== "owner") {
    return { error: "Only platform owners can disable platform admins." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("platform_set_admin_enabled", {
    target_user: userId,
    new_enabled: enabled,
  });
  if (error) {
    return {
      error: friendly(error.message, "Failed to update platform admin."),
    };
  }

  revalidatePath("/dashboard/platform/admins");
  return {};
}

// ── Break-glass support sessions ───────────────────────────────────

export async function startSupportSession(
  companyId: string,
  reason: string
): Promise<{ error?: string; sessionId?: string }> {
  const role = await getCurrentPlatformRole();
  if (role !== "owner" && role !== "support") {
    return { error: "Only owner or support can start support access." };
  }
  const trimmed = reason?.trim() ?? "";
  if (!trimmed) return { error: "A reason is required to start support access." };
  if (trimmed.length > MAX_REASON) {
    return { error: `Reason must be ${MAX_REASON} characters or fewer.` };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("platform_start_support_session", {
    p_company_id: companyId,
    p_reason: trimmed,
  });
  if (error || !data) {
    return {
      error: friendly(error?.message, "Failed to start support access."),
    };
  }

  revalidatePath("/dashboard/platform/support");
  return { sessionId: data as string };
}

export async function endSupportSession(
  sessionId: string
): Promise<{ error?: string }> {
  if (!(await getCurrentPlatformRole())) {
    return { error: "Not a platform admin." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("platform_end_support_session", {
    p_session_id: sessionId,
  });
  if (error) {
    return { error: friendly(error.message, "Failed to end support session.") };
  }

  revalidatePath("/dashboard/platform/support");
  return {};
}

// Open a single record within a support session. The RPC logs the specific
// record view (break-glass) and returns the record plus its file metadata
// (never document content or storage paths).
export async function supportOpenRecord(
  sessionId: string,
  recordId: string
): Promise<{
  error?: string;
  record?: {
    id: string;
    title: string;
    description: string | null;
    record_type: string;
    county: string | null;
    state: string | null;
    is_shared: boolean;
    created_at: string;
    updated_at: string;
  };
  files?: {
    id: string;
    name: string;
    size: number;
    mime_type: string;
    created_at: string;
  }[];
}> {
  if (!(await getCurrentPlatformRole())) {
    return { error: "Not a platform admin." };
  }
  const supabase = await createClient();

  const { data: recordRows, error: recordErr } = await supabase.rpc(
    "platform_support_get_record",
    { p_session_id: sessionId, p_record_id: recordId }
  );
  if (recordErr || !recordRows || recordRows.length === 0) {
    return { error: friendly(recordErr?.message, "Could not open record.") };
  }

  const { data: files } = await supabase.rpc("platform_support_list_files", {
    p_session_id: sessionId,
    p_record_id: recordId,
  });

  return { record: recordRows[0], files: files ?? [] };
}

// Authorize + log a break-glass download in the database, then mint a
// short-lived signed URL with the service-role client. The storage path is
// resolved server-side and never returned to the browser — only the signed URL.
export async function supportDownloadFile(
  sessionId: string,
  fileId: string
): Promise<{ url?: string; error?: string }> {
  if (!(await getCurrentPlatformRole())) {
    return { error: "Not a platform admin." };
  }

  const supabase = await createClient();
  const { data: path, error } = await supabase.rpc(
    "platform_support_authorize_download",
    { p_session_id: sessionId, p_file_id: fileId }
  );
  if (error || !path) {
    return {
      error: friendly(error?.message, "Download not authorized."),
    };
  }

  // Service role is required because storage RLS scopes downloads to the
  // owning company; the platform admin is not a member of that company.
  const admin = createAdminClient();
  const { data: signed, error: signErr } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(path as string, 300);
  if (signErr || !signed) {
    return { error: "Failed to generate a download link." };
  }
  return { url: signed.signedUrl };
}

// Surface known RPC guard messages to the user; hide anything unexpected.
function friendly(message: string | undefined, fallback: string): string {
  if (!message) return fallback;
  const known = [
    "Cannot demote the last platform owner",
    "Cannot disable the last platform owner",
    "No user found with that email",
    "That user is not a platform admin",
    "A reason is required to start support access",
    "Support session has expired",
    "Support session not found",
    "Company not found",
    "Record not found in this company",
    "File not found in this company",
  ];
  const hit = known.find((k) => message.includes(k));
  return hit ?? fallback;
}
