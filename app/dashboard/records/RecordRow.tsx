"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteRecord, toggleShare } from "@/app/actions/records";
import { deleteFile, getSignedUrl } from "@/app/actions/files";
import { formatBytes, fileTypeLabel, formatDate } from "@/lib/fileMeta";
import type { CompanyRecordSearchResult, RecordFile } from "@/types/database";

const TYPE_LABELS: Record<string, string> = {
  abstract: "Abstract",
  qualia_file: "Qualia File",
};

const TYPE_COLORS: Record<string, string> = {
  abstract: "bg-indigo-100 text-indigo-700",
  qualia_file: "bg-teal-100 text-teal-700",
  general: "bg-gray-100 text-gray-600",
};

interface Props {
  record: CompanyRecordSearchResult;
  files: RecordFile[];
  onEdit: () => void;
  selected: boolean;
  onToggleSelect: (checked: boolean) => void;
  isAdmin: boolean;
}

export default function RecordRow({
  record,
  files,
  onEdit,
  selected,
  onToggleSelect,
  isAdmin,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);

  function handleDelete() {
    if (!confirm(`Delete "${record.title}"? This cannot be undone.`)) return;
    startTransition(async () => {
      const result = await deleteRecord(record.id);
      if (result.error) alert(result.error);
    });
  }

  function handleToggleShare() {
    const msg = record.is_shared
      ? `Remove "${record.title}" from the shared network? Other companies will no longer see it.`
      : `Share "${record.title}" with all companies in the network? They can view but not edit it.`;
    if (!confirm(msg)) return;
    startTransition(async () => {
      const result = await toggleShare(record.id, record.is_shared);
      if (result.error) alert(result.error);
    });
  }

  function handleDownload(file: RecordFile) {
    startTransition(async () => {
      const result = await getSignedUrl(file.path);
      if (result.error) { alert(result.error); return; }
      if (result.url) window.open(result.url, "_blank");
    });
  }

  function handleDeleteFile(file: RecordFile) {
    if (!confirm(`Delete "${file.name}"? This cannot be undone.`)) return;
    startTransition(async () => {
      const result = await deleteFile(file.id, file.path);
      if (result.error) alert(result.error);
    });
  }

  const formattedDate = new Date(record.created_at).toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric", year: "numeric" }
  );

  const typeColor = TYPE_COLORS[record.record_type] ?? TYPE_COLORS.general;
  const typeLabel = TYPE_LABELS[record.record_type] ?? record.record_type;

  return (
    <>
      <tr
        onClick={() => router.push(`/dashboard/records/${record.id}`)}
        title="Open record"
        className={`cursor-pointer transition-colors hover:bg-gray-50 ${
          isPending ? "opacity-50" : ""
        } ${selected ? "bg-blue-50/60" : ""}`}
      >
        {isAdmin && (
          <td
            className="px-4 py-3"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={selected}
              onChange={(e) => onToggleSelect(e.target.checked)}
              aria-label={`Select ${record.title}`}
              className="h-4 w-4 cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          </td>
        )}
        <td className="px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-gray-900">{record.title}</span>
            {files.length > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded((v) => !v);
                }}
                className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
              >
                {files.length} file{files.length !== 1 ? "s" : ""}
                <span className="text-blue-400">{expanded ? "▲" : "▼"}</span>
              </button>
            )}
          </div>
          {record.description && (
            <div className="mt-0.5 max-w-sm truncate text-xs text-gray-500">
              {record.description}
            </div>
          )}
          {(record.county || record.state) && (
            <div className="mt-0.5 text-xs text-gray-400">
              {[record.county, record.state].filter(Boolean).join(", ")}
            </div>
          )}
          {record.match_source === "document" && (
            <div className="mt-1 inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700">
              <span aria-hidden>🔍</span>
              {record.matched_file_name
                ? `Matched inside ${record.matched_file_name}`
                : "Matched inside uploaded document"}
            </div>
          )}
        </td>

        <td className="px-4 py-3">
          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${typeColor}`}
          >
            {typeLabel}
          </span>
        </td>

        <td className="px-4 py-3">
          {record.is_shared ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              Shared
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
              <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
              Private
            </span>
          )}
        </td>

        <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
          {formattedDate}
        </td>

        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              disabled={isPending}
              className="rounded px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
            >
              Edit
            </button>
            {isAdmin && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleShare();
                }}
                disabled={isPending}
                className={`rounded px-2.5 py-1.5 text-xs font-medium disabled:opacity-50 ${
                  record.is_shared
                    ? "text-amber-600 hover:bg-amber-50"
                    : "text-green-600 hover:bg-green-50"
                }`}
              >
                {record.is_shared ? "Unshare" : "Share"}
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete();
              }}
              disabled={isPending}
              className="rounded px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        </td>
      </tr>

      {expanded && files.length > 0 && (
        <tr>
          <td
            colSpan={isAdmin ? 6 : 5}
            className="border-t border-blue-100 bg-blue-50 px-4 py-3"
          >
            <div className="flex flex-col gap-1.5">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-blue-100 bg-white px-3 py-2 text-xs"
                >
                  <span className="min-w-0 flex-1 truncate font-medium text-gray-800">
                    {file.name}
                  </span>
                  <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 font-medium text-gray-600">
                    {fileTypeLabel(file.mime_type, file.name)}
                  </span>
                  <span className="shrink-0 text-gray-400">
                    {formatBytes(file.size)}
                  </span>
                  <span className="shrink-0 text-gray-400">
                    {formatDate(file.created_at)}
                  </span>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-medium ${
                      file.indexed
                        ? "bg-green-50 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                    title={
                      file.indexed
                        ? "Text was extracted and is searchable"
                        : "No searchable text was extracted from this file"
                    }
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        file.indexed ? "bg-green-500" : "bg-gray-400"
                      }`}
                    />
                    {file.indexed ? "Indexed for search" : "No text extracted"}
                  </span>
                  <div className="ml-auto flex shrink-0 gap-3">
                    <button
                      onClick={() => handleDownload(file)}
                      disabled={isPending}
                      className="font-medium text-blue-600 hover:underline disabled:opacity-50"
                    >
                      Download
                    </button>
                    <button
                      onClick={() => handleDeleteFile(file)}
                      disabled={isPending}
                      className="font-medium text-red-500 hover:underline disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
