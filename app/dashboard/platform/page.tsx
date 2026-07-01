import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPlatformRole } from "@/lib/platform-auth";
import { formatDate } from "@/lib/fileMeta";
import type { PlatformAuditLog } from "@/types/database";

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-2xl font-bold text-gray-900">
        {value.toLocaleString()}
      </div>
      <div className="mt-1 text-sm text-gray-500">{label}</div>
    </div>
  );
}

export default async function PlatformOverviewPage() {
  const role = await getCurrentPlatformRole();
  const supabase = await createClient();

  const { data: statsRows } = await supabase.rpc("platform_get_stats");
  const stats = statsRows?.[0] ?? {
    total_companies: 0,
    total_users: 0,
    total_records: 0,
    total_shared_records: 0,
    total_files: 0,
  };

  // The platform audit trail is readable by owner + auditor only.
  let recent: PlatformAuditLog[] = [];
  if (role === "owner" || role === "auditor") {
    const { data } = await supabase.rpc("platform_list_platform_audit_logs");
    recent = (data ?? []).slice(0, 8) as PlatformAuditLog[];
  }

  return (
    <div className="space-y-8">
      <section>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Companies" value={stats.total_companies} />
          <StatCard label="Users" value={stats.total_users} />
          <StatCard label="Records" value={stats.total_records} />
          <StatCard label="Shared records" value={stats.total_shared_records} />
          <StatCard label="Files" value={stats.total_files} />
        </div>
      </section>

      {(role === "owner" || role === "auditor") && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Recent platform activity
            </h2>
            <Link
              href="/dashboard/platform/audit"
              className="text-sm font-medium text-purple-700 hover:underline"
            >
              View all
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-gray-500">No platform activity yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
              {recent.map((row) => (
                <li key={row.id} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0">
                    <span className="font-medium text-gray-900">{row.action}</span>
                    {row.target_company && (
                      <span className="text-gray-500">
                        {" "}
                        · {row.target_company}
                      </span>
                    )}
                    <div className="truncate text-xs text-gray-400">
                      {row.actor_name ?? "Unknown"} · {formatDate(row.created_at)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
