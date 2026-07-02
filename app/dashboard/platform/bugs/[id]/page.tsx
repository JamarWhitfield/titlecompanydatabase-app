import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getFeedbackScreenshotSignedUrl } from "@/app/actions/feedback";
import type {
  FeedbackDetail,
  FeedbackHistoryItem,
  FeedbackNoteItem,
} from "@/types/database";
import {
  categoryLabel,
  severityBadgeClass,
  severityLabel,
  statusBadgeClass,
  statusLabel,
  typeLabel,
} from "../labels";
import StatusUpdateForm from "./StatusUpdateForm";
import AddInternalNoteForm from "./AddInternalNoteForm";

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "Not provided";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
        {title}
      </h2>
      {children}
    </section>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-4">
      <div className="w-40 shrink-0 text-sm text-gray-500">{label}</div>
      <div className="min-w-0 break-words text-sm text-gray-800">{children}</div>
    </div>
  );
}

const NOT_PROVIDED = <span className="text-gray-400">Not provided</span>;

export default async function FeedbackDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // Authorization is enforced by the /dashboard/platform layout AND by each
  // RPC (which raise unless the caller is a platform admin).
  const [reportRes, historyRes, notesRes] = await Promise.all([
    supabase.rpc("platform_get_feedback", { p_id: id }),
    supabase.rpc("platform_list_feedback_history", { p_id: id }),
    supabase.rpc("platform_list_feedback_notes", { p_id: id }),
  ]);

  const report = (reportRes.data?.[0] ?? null) as FeedbackDetail | null;

  const backLink = (
    <Link
      href="/dashboard/platform/bugs"
      className="text-sm font-medium text-purple-700 hover:underline"
    >
      ← Back to Feedback Reports
    </Link>
  );

  if (reportRes.error || !report) {
    return (
      <div className="space-y-4">
        {backLink}
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
          <p className="font-medium text-gray-700">Feedback report not found.</p>
          <p className="mt-1 text-sm text-gray-500">
            It may have been removed, or the link is incorrect.
          </p>
        </div>
      </div>
    );
  }

  const history = (historyRes.data ?? []) as FeedbackHistoryItem[];
  const notes = (notesRes.data ?? []) as FeedbackNoteItem[];
  const reporter =
    report.reporter_name || report.reporter_email || "Unknown reporter";

  // Screenshot signed URL is minted server-side (service role); never client.
  let screenshotUrl: string | null = null;
  if (report.has_screenshot) {
    const signed = await getFeedbackScreenshotSignedUrl(report.id);
    screenshotUrl = signed.url ?? null;
  }

  return (
    <div className="space-y-5">
      {/* 1. Header */}
      <div className="space-y-2">
        {backLink}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight text-gray-900">
            {report.title}
          </h1>
          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass(
              report.status
            )}`}
          >
            {statusLabel(report.status)}
          </span>
          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${severityBadgeClass(
              report.severity
            )}`}
          >
            {severityLabel(report.severity)}
          </span>
        </div>
      </div>

      {/* 2. Main report details */}
      <Section title="Report details">
        <div className="divide-y divide-gray-100">
          <DetailRow label="Type">{typeLabel(report.feedback_type)}</DetailRow>
          <DetailRow label="Category">
            {categoryLabel(report.category)}
          </DetailRow>
          <DetailRow label="Company">
            {report.company_name ?? NOT_PROVIDED}
          </DetailRow>
          <DetailRow label="Reporter">{reporter}</DetailRow>
          <DetailRow label="Submitted">
            {formatDateTime(report.created_at)}
          </DetailRow>
          <DetailRow label="Last updated">
            {formatDateTime(report.updated_at)}
          </DetailRow>
          {report.resolved_at && (
            <DetailRow label="Resolved">
              {formatDateTime(report.resolved_at)}
              {report.resolved_by_name ? ` · ${report.resolved_by_name}` : ""}
            </DetailRow>
          )}
        </div>
      </Section>

      {/* 3. Description + expected behavior */}
      <Section title="Description">
        <p className="whitespace-pre-wrap text-sm text-gray-800">
          {report.description}
        </p>
        {report.expected_behavior && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <h3 className="mb-1 text-sm font-medium text-gray-700">
              Expected behavior
            </h3>
            <p className="whitespace-pre-wrap text-sm text-gray-800">
              {report.expected_behavior}
            </p>
          </div>
        )}
      </Section>

      {/* 4. Context / debugging details */}
      <Section title="Context">
        <div className="divide-y divide-gray-100">
          <DetailRow label="Page URL">
            {report.page_url ? (
              <a
                href={report.page_url}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-purple-700 hover:underline"
              >
                {report.page_url}
              </a>
            ) : (
              NOT_PROVIDED
            )}
          </DetailRow>
          <DetailRow label="Pathname">
            {report.pathname ? (
              <span className="font-mono text-xs">{report.pathname}</span>
            ) : (
              NOT_PROVIDED
            )}
          </DetailRow>
          <DetailRow label="Related resource">
            {report.related_resource_url ?? NOT_PROVIDED}
          </DetailRow>
          <DetailRow label="Related record ID">
            {report.related_record_id ? (
              <span className="font-mono text-xs">
                {report.related_record_id}
              </span>
            ) : (
              NOT_PROVIDED
            )}
          </DetailRow>
          <DetailRow label="Related file ID">
            {report.related_file_id ? (
              <span className="font-mono text-xs">
                {report.related_file_id}
              </span>
            ) : (
              NOT_PROVIDED
            )}
          </DetailRow>
          <DetailRow label="User agent">
            {report.browser_user_agent ? (
              <span className="font-mono text-xs">
                {report.browser_user_agent}
              </span>
            ) : (
              NOT_PROVIDED
            )}
          </DetailRow>
          <DetailRow label="Language">
            {report.browser_language ?? NOT_PROVIDED}
          </DetailRow>
          <DetailRow label="Platform">
            {report.browser_platform ?? NOT_PROVIDED}
          </DetailRow>
          <DetailRow label="Screen size">
            {report.screen_width && report.screen_height
              ? `${report.screen_width} × ${report.screen_height}`
              : NOT_PROVIDED}
          </DetailRow>
          <DetailRow label="Viewport size">
            {report.viewport_width && report.viewport_height
              ? `${report.viewport_width} × ${report.viewport_height}`
              : NOT_PROVIDED}
          </DetailRow>
        </div>
      </Section>

      {/* 5. Screenshot */}
      <Section title="Screenshot">
        {!report.has_screenshot ? (
          <p className="text-sm text-gray-500">No screenshot attached.</p>
        ) : screenshotUrl ? (
          <div className="space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={screenshotUrl}
              alt={`Screenshot for “${report.title}”`}
              className="max-h-96 w-auto rounded-lg border border-gray-200"
            />
            <a
              href={screenshotUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-sm font-medium text-purple-700 hover:underline"
            >
              Open screenshot in new tab
            </a>
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            Screenshot is currently unavailable.
          </p>
        )}
      </Section>

      {/* 6. Status management */}
      <Section title="Status management">
        <StatusUpdateForm reportId={report.id} currentStatus={report.status} />
      </Section>

      {/* 7. Status history */}
      <Section title="Status history">
        {history.length === 0 ? (
          <div className="text-sm text-gray-500">
            <p className="font-medium text-gray-700">No status history yet.</p>
            <p className="mt-0.5">
              Status changes will appear here as this report is reviewed.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {history.map((h) => (
              <li
                key={h.id}
                className="flex flex-col gap-1 border-l-2 border-gray-200 pl-3"
              >
                <div className="text-sm text-gray-800">
                  {h.old_status ? (
                    <>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(
                          h.old_status
                        )}`}
                      >
                        {statusLabel(h.old_status)}
                      </span>
                      <span className="mx-1.5 text-gray-400">→</span>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(
                          h.new_status
                        )}`}
                      >
                        {statusLabel(h.new_status)}
                      </span>
                    </>
                  ) : (
                    <span className="text-gray-700">
                      Initial status:{" "}
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(
                          h.new_status
                        )}`}
                      >
                        {statusLabel(h.new_status)}
                      </span>
                    </span>
                  )}
                </div>
                {h.note && (
                  <p className="text-sm text-gray-600">{h.note}</p>
                )}
                <div className="text-xs text-gray-400">
                  {h.changed_by_name || h.changed_by_email || "Unknown"} ·{" "}
                  {formatDateTime(h.created_at)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* 8. Internal notes (platform-admin only) */}
      <Section title="Internal notes">
        <div className="mb-4">
          <AddInternalNoteForm reportId={report.id} />
        </div>
        {notes.length === 0 ? (
          <div className="text-sm text-gray-500">
            <p className="font-medium text-gray-700">No internal notes yet.</p>
            <p className="mt-0.5">
              Use notes to track investigation details, follow-up questions, or
              implementation decisions.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {notes.map((n) => (
              <li
                key={n.id}
                className="rounded-lg border border-gray-200 bg-gray-50 p-3"
              >
                <p className="whitespace-pre-wrap text-sm text-gray-800">
                  {n.note}
                </p>
                <div className="mt-2 text-xs text-gray-400">
                  {n.author_name || n.author_email || "Unknown"} ·{" "}
                  {formatDateTime(n.created_at)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
