import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/fileMeta";

export default async function PlatformCompaniesPage() {
  const supabase = await createClient();
  const { data: companies } = await supabase.rpc("platform_list_companies");
  const rows = companies ?? [];

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-gray-900">
        Companies ({rows.length})
      </h2>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">No companies yet.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Users</th>
                <th className="px-4 py-3 text-right">Records</th>
                <th className="px-4 py-3 text-right">Shared</th>
                <th className="px-4 py-3 text-right">Files</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/platform/companies/${c.id}`}
                      className="font-medium text-purple-700 hover:underline"
                    >
                      {c.name}
                    </Link>
                    <div className="text-xs text-gray-400">{c.slug}</div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                    {formatDate(c.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {c.member_count}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {c.record_count}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {c.shared_count}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {c.file_count}
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
