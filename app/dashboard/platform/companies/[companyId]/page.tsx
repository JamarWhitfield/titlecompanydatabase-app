import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPlatformRole } from "@/lib/platform-auth";
import { formatDate } from "@/lib/fileMeta";
import StartSupportAccess from "./StartSupportAccess";

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="text-xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}

export default async function PlatformCompanyDetailPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const role = await getCurrentPlatformRole();
  const canSupport = role === "owner" || role === "support";

  const supabase = await createClient();

  const { data: detailRows } = await supabase.rpc(
    "platform_get_company_details",
    { p_company_id: companyId }
  );
  const detail = detailRows?.[0];
  if (!detail) notFound();

  const [{ data: members }, { data: auditLogs }] = await Promise.all([
    supabase.rpc("platform_list_company_members", { p_company_id: companyId }),
    supabase.rpc("platform_list_company_audit_logs", { p_company_id: companyId }),
  ]);

  return (
    <div className="space-y-8">
      <section>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{detail.name}</h2>
            <p className="text-sm text-gray-500">
              {detail.slug} · created {formatDate(detail.created_at)}
            </p>
          </div>
          {canSupport && (
            <StartSupportAccess
              companyId={companyId}
              companyName={detail.name}
            />
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Members" value={detail.member_count} />
          <Stat label="Records" value={detail.record_count} />
          <Stat label="Shared" value={detail.shared_count} />
          <Stat label="Private" value={detail.private_count} />
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-base font-semibold text-gray-900">
          Members ({members?.length ?? 0})
        </h3>
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Email</th>
                <th className="px-4 py-2.5">Role</th>
                <th className="px-4 py-2.5">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(members ?? []).map((m) => (
                <tr key={m.user_id}>
                  <td className="px-4 py-2.5 text-gray-900">
                    {m.full_name ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{m.email}</td>
                  <td className="px-4 py-2.5 text-gray-600">{m.role}</td>
                  <td className="px-4 py-2.5 text-gray-500">
                    {formatDate(m.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-base font-semibold text-gray-900">
          Recent company audit logs
        </h3>
        {(auditLogs?.length ?? 0) === 0 ? (
          <p className="text-sm text-gray-500">No audit activity.</p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
            {(auditLogs ?? []).slice(0, 25).map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between px-4 py-2.5 text-sm"
              >
                <span className="font-medium text-gray-800">{a.action}</span>
                <span className="text-xs text-gray-400">
                  {a.actor_name ?? "System"} · {formatDate(a.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
