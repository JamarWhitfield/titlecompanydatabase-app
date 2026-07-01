// Test helpers for the RLS isolation suite.
//
// SECURITY: the service-role key is read from the environment and used ONLY
// here, inside test setup/teardown that runs on your machine (never in any
// frontend/client bundle). It is required to seed two isolated companies
// (sign-up only ever creates company admins) and to clean up afterward.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// Minimal .env loader (no dotenv dependency). Existing process.env wins.
function loadEnvFile(name) {
  const filePath = join(ROOT, name);
  if (!existsSync(filePath)) return;
  for (const rawLine of readFileSync(filePath, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env.test");

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Fail loudly with actionable instructions if anything is missing.
export function assertConfig() {
  const missing = [];
  if (!SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!ANON_KEY) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!SERVICE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (missing.length > 0) {
    throw new Error(
      `RLS tests need these env vars: ${missing.join(", ")}.\n` +
        "Add them to .env.local (SUPABASE_SERVICE_ROLE_KEY comes from " +
        "Supabase → Project Settings → API → service_role key). " +
        "The service-role key is used only by this test harness, never in app code."
    );
  }
}

const noPersist = {
  auth: { persistSession: false, autoRefreshToken: false },
};

// Service-role client — bypasses RLS. Setup/teardown ONLY.
export function serviceClient() {
  return createClient(SUPABASE_URL, SERVICE_KEY, noPersist);
}

// Anonymous (public anon key) client — exactly what the browser uses, so
// every query below is subject to the same RLS the real app is.
export function anonClient() {
  return createClient(SUPABASE_URL, ANON_KEY, noPersist);
}

// Create a confirmed auth user; the handle_new_user trigger auto-creates the
// company + an admin profile from the metadata. Returns { userId, companyId }.
export async function createCompanyAdmin(svc, { email, password, companyName }) {
  const { data, error } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: email, company_name: companyName },
  });
  if (error) throw new Error(`createUser failed: ${error.message}`);

  const userId = data.user.id;
  const { data: profile, error: pErr } = await svc
    .from("profiles")
    .select("company_id")
    .eq("id", userId)
    .single();
  if (pErr || !profile) {
    throw new Error(
      `Profile not created by trigger for ${email}: ${pErr?.message ?? "missing"}`
    );
  }
  return { userId, companyId: profile.company_id };
}

// Sign a fresh anon client in as the given user — subsequent queries run with
// that user's JWT, so RLS applies exactly as it would in the browser.
export async function signedInClient({ email, password }) {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`signIn failed for ${email}: ${error.message}`);
  return client;
}
