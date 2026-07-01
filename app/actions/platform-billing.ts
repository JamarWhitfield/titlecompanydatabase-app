"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPlatformRole } from "@/lib/platform-auth";

// Owner-only billing/limit management for the platform usage dashboard.
// This is USAGE MONITORING configuration only — setting informational plan
// labels and limit thresholds. It performs no billing, charging, or plan
// enforcement. The underlying RPC re-checks the owner role in the database, so
// this guard just returns a friendly error for non-owners.

const PLANS = ["trial", "starter", "growth", "enterprise"] as const;
export type Plan = (typeof PLANS)[number];

export type SetCompanyBillingInput = {
  companyId: string;
  plan: Plan;
  // null = unlimited / not set. Storage is stored in bytes.
  storageLimitBytes: number | null;
  userLimit: number | null;
  recordLimit: number | null;
};

function validLimit(value: number | null): boolean {
  return value === null || (Number.isInteger(value) && value >= 0);
}

export async function setCompanyBilling(
  input: SetCompanyBillingInput
): Promise<{ error?: string }> {
  // Owner-only. Support/auditor (and every non-platform user) are rejected.
  if ((await getCurrentPlatformRole()) !== "owner") {
    return { error: "Only platform owners can change company billing limits." };
  }

  if (!input.companyId) return { error: "Missing company." };
  if (!PLANS.includes(input.plan)) return { error: "Invalid plan." };
  if (
    !validLimit(input.storageLimitBytes) ||
    !validLimit(input.userLimit) ||
    !validLimit(input.recordLimit)
  ) {
    return { error: "Limits must be whole, non-negative numbers." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("platform_set_company_billing", {
    p_company_id: input.companyId,
    p_plan: input.plan,
    p_storage_limit_bytes: input.storageLimitBytes,
    p_user_limit: input.userLimit,
    p_record_limit: input.recordLimit,
  });

  if (error) {
    return { error: "Failed to update billing limits." };
  }

  revalidatePath("/dashboard/platform/usage");
  return {};
}
