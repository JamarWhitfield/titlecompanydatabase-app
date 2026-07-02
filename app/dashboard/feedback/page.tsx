import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/dal";
import { formatDate } from "@/lib/fileMeta";
import {
  categoryLabel,
  severityBadgeClass,
  severityLabel,
  statusBadgeClass,
  statusLabel,
  typeLabel,
} from "../platform/bugs/labels";

// Columns a reporter is allowed to see about their OWN reports. Internal notes,
// status-change notes, and screenshots are intentionally excluded.
type MyFeedbackRow = {
  id: string;
  feedback_type: string;
  category: string;
  severity: string;
  status: string;
  title: string;
  description: string;
  page_url: string | null;
  pathname: string | null;
  created_at: string;
  updated_at: string;
};

export default async function MyFeedbackPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  const supabase = await createClient();
  // RLS already restricts feedback_reports SELECT to the reporter's own rows;
  // the explicit reporter_id filter is defense in depth.
  const { data, error } = await supabase
    .from("feedback_reports")
    .select(
      "id, feedback_type, category, severity, status, title, description, page_url, pathname, created_at, updated_at"
    )
    .eq("reporter_id", user.id)
    .order("created_at", { ascending: false });

  const reports = (error ? [] : (data ?? [])) as MyFeedbackRow[];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          My Feedback
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Review the bug reports, feature requests, and other feedback you have
          submitted, and track their status.
        </p>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Could not load your feedback. Please try again.
        </p>
      ) : reports.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
          <p className="font-medium text-gray-700">
            You have not submitted any feedback yet.
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Use the Send Feedback button to report bugs, request features, or
            flag confusing workflows.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Page</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reports.map((r) => (
                <tr key={r.id} className="align-top hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(
                        r.status
                      )}`}
                    >
                      {statusLabel(r.status)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${severityBadgeClass(
                        r.severity
                      )}`}
                    >
                      {severityLabel(r.severity)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                    {typeLabel(r.feedback_type)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                    {categoryLabel(r.category)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{r.title}</div>
                    {r.description && (
                      <div className="mt-0.5 line-clamp-1 max-w-md text-xs text-gray-500">
                        {r.description}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.pathname || r.page_url ? (
                      <span className="font-mono text-xs text-gray-500">
                        {r.pathname ?? r.page_url}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                    {formatDate(r.created_at)}
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
