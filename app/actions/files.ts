"use server";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/dal";
import { revalidatePath } from "next/cache";

const BUCKET = "record-files";
const PATH = "/dashboard/records";

export async function deleteFile(
  fileId: string,
  storagePath: string
): Promise<{ error?: string }> {
  const profile = await getProfile();
  if (!profile) return { error: "Not authenticated." };

  const supabase = await createClient();

  // Verify the file belongs to the caller's company before deleting
  const { data: file, error: fetchError } = await supabase
    .from("record_files")
    .select("company_id")
    .eq("id", fileId)
    .single();

  if (fetchError || !file) return { error: "File not found." };
  if (file.company_id !== profile.company_id) return { error: "Unauthorized." };

  // Delete from storage first, then remove the metadata row
  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .remove([storagePath]);

  if (storageError) {
    console.error("Storage delete failed:", storageError.message);
    // Continue to remove the DB row even if storage delete fails
  }

  const { error: dbError } = await supabase
    .from("record_files")
    .delete()
    .eq("id", fileId);

  if (dbError) return { error: "Failed to delete file." };

  revalidatePath(PATH);
  return {};
}

export async function getSignedUrl(
  storagePath: string
): Promise<{ url?: string; error?: string }> {
  const profile = await getProfile();
  if (!profile) return { error: "Not authenticated." };

  const supabase = await createClient();

  // The caller may download a file if it belongs to their own company, OR if
  // its parent record has been shared to the network (read-only access).
  const { data: file, error: fetchError } = await supabase
    .from("record_files")
    .select("company_id, record_id")
    .eq("path", storagePath)
    .single();

  if (fetchError || !file) return { error: "File not found." };

  let authorized = file.company_id === profile.company_id;
  if (!authorized) {
    const { data: record } = await supabase
      .from("company_records")
      .select("is_shared")
      .eq("id", file.record_id)
      .single();
    authorized = record?.is_shared === true;
  }
  if (!authorized) return { error: "Unauthorized." };

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 3600);

  if (error) return { error: "Failed to generate download link." };
  return { url: data.signedUrl };
}
