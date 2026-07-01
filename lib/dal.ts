import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { ProfileWithCompany } from "@/types/database";

// getSession — returns the current authenticated user, or null.
// Memoized per render pass so multiple callers don't re-fetch.
export const getSession = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

// getProfile — returns the profile row joined with its company, or null.
// Always call this instead of querying profiles directly from components.
export const getProfile = cache(async (): Promise<ProfileWithCompany | null> => {
  const user = await getSession();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*, companies(*)")
    .eq("id", user.id)
    .single();

  return (data as ProfileWithCompany | null) ?? null;
});
