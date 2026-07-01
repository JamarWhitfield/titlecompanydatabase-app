import { requirePlatformOwner } from "@/lib/platform-auth";
import { createClient } from "@/lib/supabase/server";
import UsageTable, { type CompanyUsage } from "./UsageTable";

// OWNER-ONLY storage & usage dashboard. The platform layout already gates the
// subtree to any platform admin; this page narrows access to enabled owners
// only. The usage RPC is SECURITY DEFINER and re-checks the owner role in the
// database, so access cannot be forged even if this guard were bypassed.
//
// Storage is derived from SUM(record_files.size) (application metadata) inside
// the RPC — never by scanning the Storage bucket. Only aggregate, company-level
// numbers are returned: no file paths, names, content, record titles, or URLs.
export default async function PlatformUsagePage() {
  await requirePlatformOwner();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("platform_list_company_usage");
  const rows = (data as CompanyUsage[] | null) ?? [];

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Storage &amp; Usage
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Application-level storage per company, from tracked file metadata.
          Limits are monitoring thresholds only — no billing, charges, or
          enforcement are applied.
        </p>
      </div>

      {error ? (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          Failed to load usage.
        </p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-500">No companies yet.</p>
      ) : (
        <UsageTable rows={rows} canEdit />
      )}
    </div>
  );
}
