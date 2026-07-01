"use server";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/dal";
import { extractFileText } from "@/lib/extractText";
import { revalidatePath } from "next/cache";

export type RecordState = { error?: string; success?: boolean } | undefined;

const PATH = "/dashboard/records";
const BUCKET = "record-files";

const ALLOWED_TYPES = ["abstract", "qualia_file"] as const;
const MAX_TITLE = 255;
const MAX_DESCRIPTION = 2000;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_FILES = 5;

async function uploadFiles(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  recordId: string,
  formData: FormData
): Promise<string | null> {
  const files = formData.getAll("files") as File[];
  const validFiles = files.filter((f) => f.size > 0);

  if (validFiles.length === 0) return null;
  if (validFiles.length > MAX_FILES)
    return `Maximum ${MAX_FILES} files per record.`;

  for (const file of validFiles) {
    if (file.size > MAX_FILE_SIZE)
      return `"${file.name}" exceeds the 10 MB limit.`;
  }

  const failed: string[] = [];

  for (const file of validFiles) {
    const ext = file.name.includes(".") ? file.name.split(".").pop() : "";
    const uniqueName = `${crypto.randomUUID()}${ext ? `.${ext}` : ""}`;
    const path = `${companyId}/${recordId}/${uniqueName}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type || "application/octet-stream" });

    if (uploadError) {
      console.error(`Storage upload failed for "${file.name}":`, uploadError.message);
      failed.push(file.name);
      continue;
    }

    // Extract text contents so the file is searchable (best-effort — a failed
    // extraction must never block the upload itself).
    const content_text = (await extractFileText(file)) || null;

    const { error: insertError } = await supabase.from("record_files").insert({
      company_id: companyId,
      record_id: recordId,
      name: file.name,
      path,
      size: file.size,
      mime_type: file.type || "application/octet-stream",
      content_text,
    });

    if (insertError) {
      console.error(`Failed to link "${file.name}" to record:`, insertError.message);
      // Remove the now-orphaned storage object so it isn't left dangling.
      await supabase.storage.from(BUCKET).remove([path]);
      failed.push(file.name);
    }
  }

  if (failed.length > 0) {
    return failed.length === validFiles.length
      ? "Attachments could not be saved. Please check your connection and try again."
      : `Some attachments failed to save: ${failed.join(", ")}.`;
  }

  return null;
}

// ── Create ─────────────────────────────────────────────────────────────────

export async function createRecord(
  _state: RecordState,
  formData: FormData
): Promise<RecordState> {
  const profile = await getProfile();
  if (!profile) return { error: "Not authenticated." };

  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const record_type = (formData.get("record_type") as string) || "abstract";
  const county = (formData.get("county") as string)?.trim() || null;
  const state = (formData.get("state") as string)?.trim() || null;

  if (!title) return { error: "Title is required." };
  if (title.length > MAX_TITLE)
    return { error: `Title must be under ${MAX_TITLE} characters.` };
  if (description && description.length > MAX_DESCRIPTION)
    return { error: `Description must be under ${MAX_DESCRIPTION} characters.` };
  if (!(ALLOWED_TYPES as readonly string[]).includes(record_type))
    return { error: "Invalid record type." };

  // Pre-validate files before creating the record
  const files = (formData.getAll("files") as File[]).filter((f) => f.size > 0);
  if (files.length > MAX_FILES)
    return { error: `Maximum ${MAX_FILES} files per record.` };
  for (const file of files) {
    if (file.size > MAX_FILE_SIZE)
      return { error: `"${file.name}" exceeds the 10 MB limit.` };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("company_records")
    .insert({
      company_id: profile.company_id,
      created_by: profile.id,
      title,
      description,
      record_type,
      county,
      state,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("Failed to create record:", error?.message, error?.details, error?.hint);
    return { error: "Failed to create record." };
  }

  const fileError = await uploadFiles(
    supabase,
    profile.company_id,
    data.id,
    formData
  );
  if (fileError) return { error: fileError };

  revalidatePath(PATH);
  return { success: true };
}

// ── Update ─────────────────────────────────────────────────────────────────

export async function updateRecord(
  _state: RecordState,
  formData: FormData
): Promise<RecordState> {
  const profile = await getProfile();
  if (!profile) return { error: "Not authenticated." };

  const id = (formData.get("id") as string)?.trim();
  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const record_type = (formData.get("record_type") as string) || "abstract";
  const county = (formData.get("county") as string)?.trim() || null;
  const state = (formData.get("state") as string)?.trim() || null;

  if (!id) return { error: "Record ID is missing." };
  if (!title) return { error: "Title is required." };
  if (title.length > MAX_TITLE)
    return { error: `Title must be under ${MAX_TITLE} characters.` };
  if (description && description.length > MAX_DESCRIPTION)
    return { error: `Description must be under ${MAX_DESCRIPTION} characters.` };
  if (!(ALLOWED_TYPES as readonly string[]).includes(record_type))
    return { error: "Invalid record type." };

  // Pre-validate files
  const files = (formData.getAll("files") as File[]).filter((f) => f.size > 0);
  if (files.length > MAX_FILES)
    return { error: `Maximum ${MAX_FILES} files per record.` };
  for (const file of files) {
    if (file.size > MAX_FILE_SIZE)
      return { error: `"${file.name}" exceeds the 10 MB limit.` };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("company_records")
    .update({ title, description, record_type, county, state })
    .eq("id", id)
    .select("id");

  if (error) return { error: "Failed to update record." };
  if (!data || data.length === 0) return { error: "Record not found." };

  if (files.length > 0) {
    const fileError = await uploadFiles(supabase, profile.company_id, id, formData);
    if (fileError) return { error: fileError };
  }

  revalidatePath(PATH);
  return { success: true };
}

// ── Delete ─────────────────────────────────────────────────────────────────

export async function deleteRecord(id: string): Promise<{ error?: string }> {
  const profile = await getProfile();
  if (!profile) return { error: "Not authenticated." };

  const supabase = await createClient();

  // Fetch and delete all associated storage files before deleting the record
  const { data: fileRows } = await supabase
    .from("record_files")
    .select("path")
    .eq("record_id", id);

  if (fileRows && fileRows.length > 0) {
    await supabase.storage
      .from(BUCKET)
      .remove(fileRows.map((f) => f.path));
  }

  const { data, error } = await supabase
    .from("company_records")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) return { error: "Failed to delete record." };
  if (!data || data.length === 0) return { error: "Record not found." };

  revalidatePath(PATH);
  return {};
}

// ── Share / Unshare ────────────────────────────────────────────────────────

export async function toggleShare(
  id: string,
  isCurrentlyShared: boolean
): Promise<{ error?: string }> {
  const profile = await getProfile();
  if (!profile) return { error: "Not authenticated." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("company_records")
    .update({ is_shared: !isCurrentlyShared })
    .eq("id", id)
    .select("id");

  if (error) return { error: "Failed to update record." };
  if (!data || data.length === 0) return { error: "Record not found." };

  revalidatePath(PATH);
  return {};
}

// ── Bulk Share / Unshare ─────────────────────────────────────────────────────

export type BulkShareResult = {
  error?: string;
  // Number of records that actually transitioned to the requested state.
  updatedCount?: number;
  // Number of selected records that were already in the requested state.
  skippedCount?: number;
  // IDs that were requested but neither updated nor already in state
  // (e.g. not owned by the caller's company — blocked by RLS).
  failedIds?: string[];
};

export async function bulkSetShare(
  ids: string[],
  share: boolean
): Promise<BulkShareResult> {
  const profile = await getProfile();
  if (!profile) return { error: "Not authenticated." };

  if (!Array.isArray(ids) || ids.length === 0) {
    return { error: "No records selected." };
  }

  // De-duplicate and cap the batch to a sane size.
  const uniqueIds = [...new Set(ids.filter((id) => typeof id === "string" && id))];
  if (uniqueIds.length === 0) return { error: "No records selected." };
  if (uniqueIds.length > 200) {
    return { error: "Too many records selected. Select 200 or fewer." };
  }

  const supabase = await createClient();

  // Only flip records that are actually changing state. This keeps the audit
  // trail clean (the trigger emits SHARE / UNSHARE only on a real transition)
  // and avoids redundant writes. RLS guarantees that only records owned by the
  // caller's company can be updated — foreign / network records silently match
  // zero rows here, exactly as required.
  const { data, error } = await supabase
    .from("company_records")
    .update({ is_shared: share })
    .in("id", uniqueIds)
    .eq("is_shared", !share)
    .select("id");

  if (error) {
    return { error: `Failed to ${share ? "share" : "unshare"} records.` };
  }

  const updatedIds = new Set((data ?? []).map((r) => r.id));
  const updatedCount = updatedIds.size;

  // Of the records we did not flip, figure out which were simply already in
  // the requested state (owned, no-op) versus which we could not touch at all
  // (not owned → blocked by RLS). We re-read the selected ids the caller can
  // see and own to make that distinction.
  let skippedCount = 0;
  const failedIds: string[] = [];

  const notUpdated = uniqueIds.filter((id) => !updatedIds.has(id));
  if (notUpdated.length > 0) {
    const { data: visible } = await supabase
      .from("company_records")
      .select("id")
      .in("id", notUpdated)
      .eq("company_id", profile.company_id);
    const ownedNotUpdated = new Set((visible ?? []).map((r) => r.id));
    for (const id of notUpdated) {
      // Owned + not flipped ⇒ already in the requested state (skipped no-op).
      // Not owned ⇒ RLS blocked it ⇒ a real failure.
      if (ownedNotUpdated.has(id)) skippedCount += 1;
      else failedIds.push(id);
    }
  }

  revalidatePath(PATH);
  return { updatedCount, skippedCount, failedIds };
}
