"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  supportOpenRecord,
  supportDownloadFile,
  endSupportSession,
} from "@/app/actions/platform";
import { formatBytes, formatDate } from "@/lib/fileMeta";

type RecordRow = {
  id: string;
  title: string;
  record_type: string;
  county: string | null;
  state: string | null;
  is_shared: boolean;
  created_at: string;
  file_count: number;
};

type RecordDetail = {
  id: string;
  title: string;
  description: string | null;
  record_type: string;
  county: string | null;
  state: string | null;
  is_shared: boolean;
  created_at: string;
  updated_at: string;
};

type FileRow = {
  id: string;
  name: string;
  size: number;
  mime_type: string;
  created_at: string;
};

export default function SupportBrowser({
  sessionId,
  records,
}: {
  sessionId: string;
  records: RecordRow[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<{
    record: RecordDetail;
    files: FileRow[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function open(recordId: string) {
    setError(null);
    startTransition(async () => {
      const result = await supportOpenRecord(sessionId, recordId);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.record) {
        setSelected({ record: result.record, files: result.files ?? [] });
      }
    });
  }

  function download(fileId: string) {
    setError(null);
    startTransition(async () => {
      const result = await supportDownloadFile(sessionId, fileId);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.url) window.open(result.url, "_blank");
    });
  }

  function end() {
    startTransition(async () => {
      await endSupportSession(sessionId);
      router.push("/dashboard/platform/support");
    });
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900">
          Records ({records.length})
        </h3>
        <button
          onClick={end}
          disabled={pending}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          End support session
        </button>
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2.5">Title</th>
                <th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5 text-right">Files</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => open(r.id)}
                  className={`cursor-pointer hover:bg-gray-50 ${
                    selected?.record.id === r.id ? "bg-purple-50" : ""
                  }`}
                >
                  <td className="px-4 py-2.5 font-medium text-gray-900">
                    {r.title}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{r.record_type}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">
                    {r.file_count}
                  </td>
                </tr>
              ))}
              {records.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-gray-400">
                    No records in this company.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          {!selected ? (
            <p className="text-sm text-gray-400">
              Select a record to view its details.
            </p>
          ) : (
            <div>
              <h4 className="text-base font-semibold text-gray-900">
                {selected.record.title}
              </h4>
              <div className="mt-1 text-xs text-gray-500">
                {selected.record.record_type}
                {selected.record.is_shared ? " · shared" : " · private"} ·
                created {formatDate(selected.record.created_at)}
              </div>
              {selected.record.description && (
                <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">
                  {selected.record.description}
                </p>
              )}
              {(selected.record.county || selected.record.state) && (
                <p className="mt-2 text-xs text-gray-500">
                  {[selected.record.county, selected.record.state]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              )}

              <h5 className="mt-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Files ({selected.files.length})
              </h5>
              <ul className="mt-2 space-y-1">
                {selected.files.map((f) => (
                  <li
                    key={f.id}
                    className="flex items-center justify-between rounded border border-gray-100 px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 truncate text-gray-800">
                      {f.name}
                      <span className="ml-2 text-xs text-gray-400">
                        {formatBytes(f.size)}
                      </span>
                    </span>
                    <button
                      onClick={() => download(f.id)}
                      disabled={pending}
                      className="rounded px-2 py-1 text-xs font-medium text-purple-700 hover:bg-purple-50 disabled:opacity-50"
                    >
                      Download
                    </button>
                  </li>
                ))}
                {selected.files.length === 0 && (
                  <li className="text-xs text-gray-400">No files.</li>
                )}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
