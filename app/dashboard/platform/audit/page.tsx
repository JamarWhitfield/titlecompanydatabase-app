import { requirePlatformAdmin } from "@/lib/platform-auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/fileMeta";
import type { PlatformAuditLog } from "@/types/database";

export default async function PlatformAuditPage() {
  // Platform audit trail is owner/auditor only.
  await requirePlatformAdmin(["owner", "auditor"]);

  const supabase = await createClient();
  const { data } = await supabase.rpc("platform_list_platform_audit_logs");
  const rows = (data ?? []) as PlatformAuditLog[];

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-gray-900">
        Platform audit log
      </h2>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">No platform activity yet.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
                    {formatDate(r.created_at)}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {r.actor_name ?? "Unknown"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-700">
                      {r.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {r.target_company ?? "—"}
                  </td>
                  <td className="max-w-xs px-4 py-3 text-xs text-gray-500">
                    {r.reason ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
