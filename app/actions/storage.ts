"use server";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/dal";

// ── Storage billing accuracy / reconciliation ──────────────────────
//
// Company storage usage shown in Settings is calculated from
// `record_files.size` (database metadata), NOT by inspecting the Supabase
// Storage bucket. That metadata total is Casetra's billable, application-level
// storage. See supabase/migrations/0024_storage_usage_reconciliation.sql and
// TITLE_NETWORK_DATABASE_DESIGN.md for the full billing-accuracy notes.
//
// The action below is an OWNER-ONLY, READ-ONLY reconciliation report. It
// surfaces drift between the metadata and the actual bucket objects. It never
// deletes a row or an object — cleanup is intentionally out of scope.

export type StorageDriftItem = {
  path: string;
  recordId: string | null;
  fileId: string | null;
  name: string;
  size: number;
};

export type StorageDriftResult = {
  error?: string;
  checkedAt?: string;
  // record_files rows whose storage object is missing (still billed until
  // cleaned up).
  missing?: StorageDriftItem[];
  // storage objects with no record_files row (not billed; review only).
  orphaned?: StorageDriftItem[];
};

/**
 * checkStorageDrift — admin-only, read-only reconciliation report.
 *
 * Compares `record_files` metadata against the objects actually present in the
 * `record-files` bucket for the caller's company and returns the mismatches.
 * Reports only; performs no deletion. Both the UI guard here and the
 * SECURITY DEFINER RPC enforce the admin/company scope, so a forged request
 * cannot reconcile another company or bypass the admin check.
 */
export async function checkStorageDrift(): Promise<StorageDriftResult> {
  const profile = await getProfile();
  if (!profile) return { error: "Not authenticated." };
  if (profile.role !== "admin") {
    return { error: "Only company admins can run storage reconciliation." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("check_company_storage_drift");

  if (error) {
    return { error: "Failed to run storage reconciliation." };
  }

  const rows = data ?? [];
  const missing: StorageDriftItem[] = [];
  const orphaned: StorageDriftItem[] = [];

  for (const row of rows) {
    const item: StorageDriftItem = {
      path: row.object_path,
      recordId: row.record_id,
      fileId: row.file_id,
      name: row.file_name,
      size: row.size_bytes ?? 0,
    };
    if (row.issue_type === "missing_object") missing.push(item);
    else if (row.issue_type === "orphaned_object") orphaned.push(item);
  }

  return { checkedAt: new Date().toISOString(), missing, orphaned };
}
