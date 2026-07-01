"use server";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/dal";
import { revalidatePath } from "next/cache";

const MAX_NAME = 255;

// Update the caller's own display name. RLS ("profiles: update own", 0001)
// restricts the write to the caller's own row; a blocked update affects 0
// rows and surfaces as an error. Only full_name is written — role and
// company are never touched here.
export async function updateProfile(
  fullName: string
): Promise<{ error?: string }> {
  const profile = await getProfile();
  if (!profile) return { error: "Not authenticated." };

  const full_name = fullName?.trim();
  if (!full_name) return { error: "Enter your name." };
  if (full_name.length > MAX_NAME) {
    return { error: `Name must be ${MAX_NAME} characters or fewer.` };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ full_name })
    .eq("id", profile.id)
    .select("id");

  if (error) {
    console.error("Failed to update profile:", error.message);
    return { error: "Failed to update your profile." };
  }
  if (!data || data.length === 0) {
    return { error: "Failed to update your profile." };
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard", "layout");
  return {};
}
