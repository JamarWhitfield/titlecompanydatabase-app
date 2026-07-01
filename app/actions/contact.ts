"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendDemoRequestNotification } from "@/lib/email";
import {
  COMPANY_TYPES,
  TEAM_SIZES,
  CURRENT_SYSTEMS,
  PAIN_POINTS,
} from "@/lib/contactOptions";

export type ContactState = { error?: string; success?: boolean } | undefined;

// Basic, defensive email shape check. Real deliverability is confirmed by the
// follow-up we send; this only rejects obvious junk before we store a row.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Length ceilings. These guard the database and email against absurdly large
// pastes and keep a single spam POST from ballooning a row.
const MAX = {
  fullName: 120,
  email: 255,
  companyName: 160,
  companyWebsite: 300,
  roleTitle: 120,
  message: 4000,
} as const;

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

// Returns the value if it is one we actually offer, otherwise null. This means
// a tampered POST can never smuggle an arbitrary string into an option column;
// it simply gets dropped.
function pick(value: string, allowed: readonly string[]): string | null {
  if (!value) return null;
  return allowed.includes(value) ? value : null;
}

// Public demo-request handler for /contact. Callable by unauthenticated
// visitors, so it trusts nothing from the client: it re-validates every field,
// screens a honeypot, and writes through the service role into a table that is
// otherwise completely private (RLS deny-all). Email is best-effort and never
// affects whether the request is considered submitted.
export async function submitDemoRequest(
  _state: ContactState,
  formData: FormData
): Promise<ContactState> {
  // Honeypot: a hidden field no human ever sees. Bots that auto-fill forms
  // tend to complete it. If it has any content we pretend everything worked
  // and quietly discard the submission — never tipping off the bot.
  if (field(formData, "company_fax") !== "") {
    return { success: true };
  }

  const fullName = field(formData, "full_name");
  const email = field(formData, "email");
  const companyName = field(formData, "company_name");

  // Required fields.
  if (!fullName || !email || !companyName) {
    return { error: "Name, work email, and company name are required." };
  }
  if (!EMAIL_RE.test(email)) {
    return { error: "Please enter a valid work email address." };
  }

  // Length ceilings on the free-text fields.
  if (fullName.length > MAX.fullName)
    return { error: "Please shorten your name." };
  if (email.length > MAX.email)
    return { error: "Please enter a shorter email address." };
  if (companyName.length > MAX.companyName)
    return { error: "Please shorten your company name." };

  const companyWebsite = field(formData, "company_website").slice(
    0,
    MAX.companyWebsite
  );
  const roleTitle = field(formData, "role_title").slice(0, MAX.roleTitle);
  const message = field(formData, "message").slice(0, MAX.message);

  // Constrained option fields — only accept values from our own menus.
  const companyType = pick(field(formData, "company_type"), COMPANY_TYPES);
  const teamSize = pick(field(formData, "team_size"), TEAM_SIZES);
  const currentSystem = pick(field(formData, "current_system"), CURRENT_SYSTEMS);
  const mainPainPoint = pick(field(formData, "main_pain_point"), PAIN_POINTS);

  // Persist through the service role. RLS denies anon/authenticated entirely,
  // so this is the only write path in the whole system.
  let admin;
  try {
    admin = createAdminClient();
  } catch (err) {
    console.error(
      "[contact] service role unavailable:",
      err instanceof Error ? err.message : err
    );
    return { error: "We couldn't submit your request. Please try again later." };
  }

  const { error } = await admin.from("contact_submissions").insert({
    full_name: fullName,
    email,
    company_name: companyName,
    company_website: companyWebsite || null,
    role_title: roleTitle || null,
    company_type: companyType,
    team_size: teamSize,
    current_system: currentSystem,
    main_pain_point: mainPainPoint,
    message: message || null,
    source: "landing_contact",
  });

  if (error) {
    // Never surface raw database errors to the client.
    console.error("[contact] insert failed:", error.message);
    return { error: "We couldn't submit your request. Please try again later." };
  }

  // Best-effort notification. A missing key or a delivery failure must never
  // turn a saved request into a user-facing error.
  try {
    await sendDemoRequestNotification({
      fullName,
      email,
      companyName,
      companyWebsite: companyWebsite || null,
      roleTitle: roleTitle || null,
      companyType,
      teamSize,
      currentSystem,
      mainPainPoint,
      message: message || null,
    });
  } catch (err) {
    console.error(
      "[contact] notification threw:",
      err instanceof Error ? err.message : err
    );
  }

  return { success: true };
}
