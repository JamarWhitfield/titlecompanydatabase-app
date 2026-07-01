import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Service-role Supabase client. SECURITY: this bypasses Row Level Security and
// must NEVER be imported into a client component or exposed to the browser. The
// "server-only" import above makes any such attempt a build error. It is used
// for a single, tightly-gated purpose: minting a short-lived signed URL for a
// break-glass support file download, AFTER the caller has been verified as a
// platform admin and the download has been authorized + logged in the database.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Service role is not configured (SUPABASE_SERVICE_ROLE_KEY missing)."
    );
  }
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
