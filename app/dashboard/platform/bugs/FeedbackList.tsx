"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/fileMeta";
import type { FeedbackListItem } from "@/types/database";
import {
  FEEDBACK_CATEGORY_ORDER,
  FEEDBACK_SEVERITY_ORDER,
  FEEDBACK_STATUS_ORDER,
  FEEDBACK_TYPE_ORDER,
  categoryLabel,
  severityBadgeClass,
  severityLabel,
  statusBadgeClass,
  statusLabel,
  typeLabel,
} from "./labels";

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="mt-1 text-xs font-medium text-gray-500">{label}</div>
    </div>
  );
}

const selectClass =
  "rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500";

export default function FeedbackList({
  reports,
}: {
  reports: FeedbackListItem[];
}) {
  const [status, setStatus] = useState("");
  const [severity, setSeverity] = useState("");
  const [type, setType] = useState("");
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");

  const stats = useMemo(
    () => ({
      open: reports.filter((r) => r.status === "open").length,
      critical: reports.filter((r) => r.severity === "critical").length,
      high: reports.filter((r) => r.severity === "high").length,
      features: reports.filter((r) => r.feedback_type === "feature_request")
        .length,
      dataImport: reports.filter(
        (r) => r.feedback_type === "data_import_issue"
      ).length,
    }),
    [reports]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reports.filter((r) => {
      if (status && r.status !== status) return false;
      if (severity && r.severity !== severity) return false;
      if (type && r.feedback_type !== type) return false;
      if (category && r.category !== category) return false;
      if (q) {
        const haystack = [
          r.title,
          r.company_name,
          r.reporter_name,
          r.reporter_email,
          r.page_url,
          r.pathname,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [reports, status, severity, type, category, query]);

  const hasFilters =
    status !== "" ||
    severity !== "" ||
    type !== "" ||
    category !== "" ||
    query.trim() !== "";

  function reporterLabel(r: FeedbackListItem): string {
    return r.reporter_name || r.reporter_email || "Unknown reporter";
  }

  // Empty state — no reports at all.
  if (reports.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
        <p className="font-medium text-gray-700">No feedback reports yet.</p>
        <p className="mt-1 text-sm text-gray-500">
          When pilot customers submit bugs, feature requests, or workflow
          feedback, they will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Open reports" value={stats.open} />
        <StatCard label="Critical" value={stats.critical} />
        <StatCard label="High severity" value={stats.high} />
        <StatCard label="Feature requests" value={stats.features} />
        <StatCard label="Data/import issues" value={stats.dataImport} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="sr-only" htmlFor="feedback-search">
          Search feedback
        </label>
        <input
          id="feedback-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search title, company, reporter, or page…"
          className="min-w-[16rem] flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
        />

        <label className="sr-only" htmlFor="filter-status">
          Status
        </label>
        <select
          id="filter-status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className={selectClass}
        >
          <option value="">All statuses</option>
          {FEEDBACK_STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>

        <label className="sr-only" htmlFor="filter-severity">
          Severity
        </label>
        <select
          id="filter-severity"
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          className={selectClass}
        >
          <option value="">All severities</option>
          {FEEDBACK_SEVERITY_ORDER.map((s) => (
            <option key={s} value={s}>
              {severityLabel(s)}
            </option>
          ))}
        </select>

        <label className="sr-only" htmlFor="filter-type">
          Feedback type
        </label>
        <select
          id="filter-type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          className={selectClass}
        >
          <option value="">All types</option>
          {FEEDBACK_TYPE_ORDER.map((t) => (
            <option key={t} value={t}>
              {typeLabel(t)}
            </option>
          ))}
        </select>

        <label className="sr-only" htmlFor="filter-category">
          Category
        </label>
        <select
          id="filter-category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={selectClass}
        >
          <option value="">All categories</option>
          {FEEDBACK_CATEGORY_ORDER.map((c) => (
            <option key={c} value={c}>
              {categoryLabel(c)}
            </option>
          ))}
        </select>

        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setStatus("");
              setSeverity("");
              setType("");
              setCategory("");
              setQuery("");
            }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Filtered empty state */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
          <p className="font-medium text-gray-700">
            No feedback reports match these filters.
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Try clearing one or more filters.
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
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Reporter</th>
                <th className="px-4 py-3">Page</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((r) => (
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
                  <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                    {r.company_name ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                    {reporterLabel(r)}
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
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/platform/bugs/${r.id}`}
                      className="font-medium text-purple-700 hover:underline"
                    >
                      {r.title}
                    </Link>
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
