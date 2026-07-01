"use server";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/dal";
import { revalidatePath } from "next/cache";

const MAX_NAME = 120;
const MAX_QUERY = 200;

// Save a Shared Network search term for the current company/user.
export async function saveSearch(
  name: string,
  queryText: string
): Promise<{ error?: string }> {
  const profile = await getProfile();
  if (!profile) return { error: "Not authenticated." };

  const trimmedQuery = queryText.trim();
  if (!trimmedQuery) return { error: "Enter a search term before saving." };
  if (trimmedQuery.length > MAX_QUERY) {
    return { error: `Search term must be ${MAX_QUERY} characters or fewer.` };
  }

  const trimmedName = (name.trim() || trimmedQuery).slice(0, MAX_NAME);

  const supabase = await createClient();
  const { error } = await supabase.from("saved_searches").insert({
    company_id: profile.company_id,
    user_id: profile.id,
    name: trimmedName,
    query_text: trimmedQuery,
  });

  if (error) return { error: "Failed to save search." };

  revalidatePath("/dashboard/notifications");
  return {};
}

// Remove a saved search (own, or any of the company's if admin — enforced by RLS).
export async function deleteSavedSearch(
  id: string
): Promise<{ error?: string }> {
  const profile = await getProfile();
  if (!profile) return { error: "Not authenticated." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("saved_searches")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) return { error: "Failed to delete saved search." };
  if (!data || data.length === 0) {
    return { error: "You can only delete your own saved searches." };
  }

  revalidatePath("/dashboard/notifications");
  return {};
}

// Mark a single notification as read.
export async function markNotificationRead(
  id: string
): Promise<{ error?: string }> {
  const profile = await getProfile();
  if (!profile) return { error: "Not authenticated." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null);

  if (error) return { error: "Failed to update notification." };

  revalidatePath("/dashboard/notifications");
  revalidatePath("/dashboard");
  return {};
}

// Mark every unread notification for the company as read.
export async function markAllNotificationsRead(): Promise<{ error?: string }> {
  const profile = await getProfile();
  if (!profile) return { error: "Not authenticated." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("company_id", profile.company_id)
    .is("read_at", null);

  if (error) return { error: "Failed to update notifications." };

  revalidatePath("/dashboard/notifications");
  revalidatePath("/dashboard");
  return {};
}
