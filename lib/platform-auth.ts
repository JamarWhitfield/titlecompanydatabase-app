import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/dal";
import type { PlatformRole } from "@/types/database";

// Source of truth for platform authorization. The DATABASE (platform_admins
// table, via the platform_current_role RPC) is authoritative — never trust a
// client-supplied role or user metadata. Every helper here is server-only.

// getCurrentPlatformRole — the caller's platform role, or null if they are not
// an enabled platform admin. Memoized per render pass.
export const getCurrentPlatformRole = cache(
  async (): Promise<PlatformRole | null> => {
    const user = await getSession();
    if (!user) return null;

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("platform_current_role");
    if (error) {
      console.error("platform_current_role failed:", error.message);
      return null;
    }
    return (data as PlatformRole | null) ?? null;
  }
);

// requirePlatformAdmin — gate a server component / action to platform admins.
// Redirects unauthenticated users to /login and non-platform users to
// /dashboard (hiding the console's existence). When `allowed` is given, the
// caller's role must be one of them, else they are sent back to the console
// home. Returns the verified { userId, role }.
export async function requirePlatformAdmin(
  allowed?: PlatformRole[]
): Promise<{ userId: string; role: PlatformRole }> {
  const user = await getSession();
  if (!user) redirect("/login");

  const role = await getCurrentPlatformRole();
  if (!role) redirect("/dashboard");

  if (allowed && !allowed.includes(role)) {
    redirect("/dashboard/platform");
  }

  return { userId: user.id, role };
}

// requirePlatformOwner — convenience wrapper for owner-only surfaces.
export async function requirePlatformOwner(): Promise<{
  userId: string;
  role: PlatformRole;
}> {
  return requirePlatformAdmin(["owner"]);
}
