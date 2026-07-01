"use client";

import { useMemo, useState } from "react";

export interface AuditLogRow {
  id: string;
  action: string;
  userName: string;
  recordTitle: string | null;
  recordId: string | null;
  createdAt: string;
  detail: string | null;
}

// Map the raw stored action codes to friendly labels + badge colors.
const ACTION_META: Record<
  string,
  { label: string; className: string }
> = {
  INSERT: { label: "Record created", className: "bg-green-100 text-green-700" },
  UPDATE: { label: "Record updated", className: "bg-blue-100 text-blue-700" },
  DELETE: { label: "Record deleted", className: "bg-red-100 text-red-700" },
  SHARE: { label: "Record shared", className: "bg-teal-100 text-teal-700" },
  UNSHARE: { label: "Record unshared", className: "bg-amber-100 text-amber-700" },
  ATTACHMENT_UPLOADED: {
    label: "Attachment uploaded",
    className: "bg-indigo-100 text-indigo-700",
  },
  ATTACHMENT_DELETED: {
    label: "Attachment deleted",
    className: "bg-rose-100 text-rose-700",
  },
};

function actionMeta(action: string) {
  return (
    ACTION_META[action] ?? {
      label: action
        .toLowerCase()
        .replace(/_/g, " ")
        .replace(/^\w/, (c) => c.toUpperCase()),
      className: "bg-gray-100 text-gray-600",
    }
  );
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AuditLogList({ rows }: { rows: AuditLogRow[] }) {
  const [actionFilter, setActionFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [fromDate, setFromDate] = useState("");

  const actionOptions = useMemo(
    () => [...new Set(rows.map((r) => r.action))],
    [rows]
  );
  const userOptions = useMemo(
    () => [...new Set(rows.map((r) => r.userName))].sort(),
    [rows]
  );

  const filtered = useMemo(() => {
    const fromTime = fromDate ? new Date(fromDate).getTime() : null;
    return rows.filter((r) => {
      if (actionFilter && r.action !== actionFilter) return false;
      if (userFilter && r.userName !== userFilter) return false;
      if (fromTime !== null && new Date(r.createdAt).getTime() < fromTime)
        return false;
      return true;
    });
  }, [rows, actionFilter, userFilter, fromDate]);

  const hasActiveFilter = Boolean(actionFilter || userFilter || fromDate);

  return (
    <div>
      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-gray-500">
          Action
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-800 shadow-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="">All actions</option>
            {actionOptions.map((a) => (
              <option key={a} value={a}>
                {actionMeta(a).label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-gray-500">
          User
          <select
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-800 shadow-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="">All users</option>
            {userOptions.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-gray-500">
          From date
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-800 shadow-sm focus:border-blue-500 focus:outline-none"
          />
        </label>

        {hasActiveFilter && (
          <button
            onClick={() => {
              setActionFilter("");
              setUserFilter("");
              setFromDate("");
            }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 shadow-sm transition-colors hover:bg-gray-50"
          >
            Clear
          </button>
        )}

        <span className="ml-auto self-center text-xs text-gray-400">
          {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white py-20 text-center">
          <p className="font-semibold text-gray-700">No activity yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">
            Record activity — creating, editing, sharing, and managing
            attachments — will appear here for your company.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
          <p className="text-sm text-gray-500">
            No entries match the selected filters.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-400">
              <tr>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Record</th>
                <th className="px-4 py-3 font-medium">Details</th>
                <th className="px-4 py-3 font-medium">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((row) => {
                const meta = actionMeta(row.action);
                return (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.className}`}
                      >
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{row.userName}</td>
                    <td className="px-4 py-3">
                      {row.recordTitle ? (
                        <span className="text-gray-800">{row.recordTitle}</span>
                      ) : row.recordId ? (
                        <span className="font-mono text-xs text-gray-400">
                          {row.recordId}
                        </span>
                      ) : (
                        <span className="text-gray-300">&mdash;</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {row.detail ?? <span className="text-gray-300">&mdash;</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
                      {formatTimestamp(row.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
