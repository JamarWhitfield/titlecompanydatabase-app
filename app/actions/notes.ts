"use server";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/dal";

const MAX_NOTE = 2000;

// Add a note to a record the caller can view. RLS (0014) enforces that the
// parent record is viewable (own company OR shared) and that the note is
// stored under the caller's own company.
export async function addNote(
  recordId: string,
  text: string
): Promise<{ error?: string }> {
  const profile = await getProfile();
  if (!profile) return { error: "Not authenticated." };

  const note_text = text?.trim();
  if (!recordId) return { error: "Record is missing." };
  if (!note_text) return { error: "Note cannot be empty." };
  if (note_text.length > MAX_NOTE)
    return { error: `Note must be under ${MAX_NOTE} characters.` };

  const supabase = await createClient();
  const { error } = await supabase.from("record_notes").insert({
    record_id: recordId,
    company_id: profile.company_id,
    user_id: profile.id,
    note_text,
  });

  if (error) {
    console.error("Failed to add note:", error.message);
    return { error: "Failed to add note." };
  }
  return {};
}

// Edit a note. RLS allows only the author or a company admin; a blocked
// update affects 0 rows, which we surface as a permission error.
export async function updateNote(
  id: string,
  text: string
): Promise<{ error?: string }> {
  const profile = await getProfile();
  if (!profile) return { error: "Not authenticated." };

  const note_text = text?.trim();
  if (!id) return { error: "Note is missing." };
  if (!note_text) return { error: "Note cannot be empty." };
  if (note_text.length > MAX_NOTE)
    return { error: `Note must be under ${MAX_NOTE} characters.` };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("record_notes")
    .update({ note_text })
    .eq("id", id)
    .select("id");

  if (error) {
    console.error("Failed to update note:", error.message);
    return { error: "Failed to update note." };
  }
  if (!data || data.length === 0)
    return { error: "You can only edit your own notes." };
  return {};
}

// Delete a note. RLS allows only the author or a company admin.
export async function deleteNote(id: string): Promise<{ error?: string }> {
  const profile = await getProfile();
  if (!profile) return { error: "Not authenticated." };
  if (!id) return { error: "Note is missing." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("record_notes")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) {
    console.error("Failed to delete note:", error.message);
    return { error: "Failed to delete note." };
  }
  if (!data || data.length === 0)
    return { error: "You can only delete your own notes." };
  return {};
}
