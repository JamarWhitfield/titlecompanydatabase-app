"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/dal";
import { sendInvitationEmail } from "@/lib/email";
import { revalidatePath } from "next/cache";

const MAX_EMAIL = 255;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type InviteResult = { error?: string; token?: string; emailed?: boolean };

// Resolve the site's base URL server-side so we can build the invite link
// without relying on the browser. Prefers an explicit env override (best for
// production), then the forwarded request headers.
async function getBaseUrl(): Promise<string | null> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (configured) return configured;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return null;
  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

// Invite a teammate to the caller's company. Admin-only — enforced by the
// company_invitations RLS policies (a non-admin INSERT affects 0 rows / is
// rejected). Emails the invite link via Resend when configured, and always
// returns the token so the UI can also offer a copy-the-link fallback.
export async function inviteMember(
  email: string,
  role: "admin" | "member"
): Promise<InviteResult> {
  const profile = await getProfile();
  if (!profile) return { error: "Not authenticated." };
  if (profile.role !== "admin") {
    return { error: "Only admins can invite teammates." };
  }

  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return { error: "Enter an email address." };
  if (trimmed.length > MAX_EMAIL) {
    return { error: `Email must be ${MAX_EMAIL} characters or fewer.` };
  }
  if (!EMAIL_RE.test(trimmed)) {
    return { error: "Enter a valid email address." };
  }
  if (role !== "admin" && role !== "member") {
    return { error: "Invalid role." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("company_invitations")
    .insert({
      company_id: profile.company_id,
      email: trimmed,
      role,
      invited_by: profile.id,
    })
    .select("token")
    .single();

  if (error) {
    // Unique partial index → a pending invite already exists for this email.
    if (error.code === "23505") {
      return { error: "There is already a pending invite for that email." };
    }
    console.error("Failed to create invitation:", error.message);
    return { error: "Failed to create the invitation." };
  }

  // Best-effort email delivery. A send failure must NOT fail the invite — the
  // token is already persisted and the admin can copy the link manually.
  let emailed = false;
  const baseUrl = await getBaseUrl();
  if (baseUrl) {
    const inviteLink = `${baseUrl}/register?invite=${data.token}`;
    const { sent } = await sendInvitationEmail({
      to: trimmed,
      companyName: profile.companies?.name ?? "your team",
      inviterName: profile.full_name ?? "A teammate",
      role,
      inviteLink,
    });
    emailed = sent;
  }

  revalidatePath("/dashboard/team");
  return { token: data.token, emailed };
}

// Revoke a pending invitation. RLS restricts deletion to admins of the
// owning company; a blocked delete affects 0 rows and surfaces as an error.
export async function revokeInvitation(
  id: string
): Promise<{ error?: string }> {
  const profile = await getProfile();
  if (!profile) return { error: "Not authenticated." };
  if (!id) return { error: "Invitation is missing." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("company_invitations")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) {
    console.error("Failed to revoke invitation:", error.message);
    return { error: "Failed to revoke the invitation." };
  }
  if (!data || data.length === 0) {
    return { error: "You can only revoke your own company's invitations." };
  }

  revalidatePath("/dashboard/team");
  return {};
}

// Promote or demote a teammate. The set_member_role RPC enforces that the
// caller is an admin of the same company and refuses to demote the last
// admin — all at the database level.
export async function setMemberRole(
  targetUser: string,
  newRole: "admin" | "member"
): Promise<{ error?: string }> {
  const profile = await getProfile();
  if (!profile) return { error: "Not authenticated." };
  if (profile.role !== "admin") {
    return { error: "Only admins can change member roles." };
  }
  if (!targetUser) return { error: "Member is missing." };
  if (targetUser === profile.id) {
    return { error: "You can't change your own role." };
  }
  if (newRole !== "admin" && newRole !== "member") {
    return { error: "Invalid role." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_role", {
    target_user: targetUser,
    new_role: newRole,
  });

  if (error) {
    // Surface the friendly RPC guard messages (e.g. last-admin protection).
    return { error: error.message || "Failed to update the member's role." };
  }

  revalidatePath("/dashboard/team");
  return {};
}

// Remove (kick) a teammate from the caller's company. The remove_member RPC
// enforces every guard at the database level: the caller must be an admin of
// the same company, the target must belong to that company, and the last
// remaining admin can never be removed (which also blocks self-removal that
// would orphan the company). It reassigns the departing member's records and
// notes to the acting admin and writes a 'member_removed' audit entry.
export async function removeMember(
  targetUser: string
): Promise<{ error?: string }> {
  const profile = await getProfile();
  if (!profile) return { error: "Not authenticated." };
  if (profile.role !== "admin") {
    return { error: "Only admins can remove members." };
  }
  if (!targetUser) return { error: "Member is missing." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_member", {
    target_user: targetUser,
  });

  if (error) {
    // Surface the friendly RPC guard messages (e.g. last-admin protection).
    return { error: error.message || "Failed to remove the member." };
  }

  revalidatePath("/dashboard/team");
  return {};
}
