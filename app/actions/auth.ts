"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type AuthState = { error?: string } | undefined;

// ── Login ──────────────────────────────────────────────────────────────────

export async function login(
  _state: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = (formData.get("email") as string)?.trim();
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  redirect("/dashboard");
}

// ── Register ───────────────────────────────────────────────────────────────
// Creates a Supabase Auth user with metadata.
// The handle_new_user DB trigger automatically creates the company + profile.

export async function register(
  _state: AuthState,
  formData: FormData
): Promise<AuthState> {
  const companyName = (formData.get("company_name") as string)?.trim();
  const fullName = (formData.get("full_name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim();
  const password = formData.get("password") as string;
  const inviteToken = (formData.get("invite_token") as string)?.trim();

  // When joining via an invite, the company is determined by the token
  // (the inviting company), so a company name is neither required nor used.
  if (!fullName || !email || !password) {
    return { error: "All fields are required." };
  }
  if (!inviteToken && !companyName) {
    return { error: "Company name is required." };
  }

  if (companyName && companyName.length > 255)
    return { error: "Company name must be under 255 characters." };
  if (fullName.length > 255)
    return { error: "Full name must be under 255 characters." };
  if (email.length > 255)
    return { error: "Email must be under 255 characters." };
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // company_name is ignored by the handle_new_user trigger when a valid
      // invite_token is present; invite_token is ignored when absent/invalid.
      data: {
        full_name: fullName,
        company_name: companyName,
        invite_token: inviteToken || null,
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  // Email confirmation disabled → Supabase returns a session immediately.
  // Go straight to the dashboard; no login step needed.
  if (data.session) {
    redirect("/dashboard");
  }

  // Email confirmation enabled → user must verify before logging in.
  redirect("/login?message=check-email");
}

// ── Logout ─────────────────────────────────────────────────────────────────

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
