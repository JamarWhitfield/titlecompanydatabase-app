"use client";

import { useState, useTransition } from "react";
import { checkStorageDrift, type StorageDriftResult } from "@/app/actions/storage";
import { formatBytes } from "@/lib/fileMeta";

// Format a company-scale total (can reach GB), unlike per-file formatBytes
// which tops out at MB. Metadata bytes come straight from record_files.size.
function formatUsage(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export default function StorageUsage({
  totalBytes,
  fileCount,
}: {
  totalBytes: number;
  fileCount: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<StorageDriftResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function runCheck() {
    setError(null);
    setResult(null);
    startTransition(async () => {
      const r = await checkStorageDrift();
      if (r.error) {
        setError(r.error);
        return;
      }
      setResult(r);
    });
  }

  const missing = result?.missing ?? [];
  const orphaned = result?.orphaned ?? [];
  const inSync = result && missing.length === 0 && orphaned.length === 0;

  return (
    <section className="mb-6 rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">Storage usage</h2>
      </div>

      <div className="flex flex-col gap-4 px-4 py-4">
        <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
          <div>
            <p className="text-2xl font-semibold tracking-tight text-gray-900">
              {formatUsage(totalBytes)}
            </p>
            <p className="mt-0.5 text-xs text-gray-500">Billable storage</p>
          </div>
          <div>
            <p className="text-2xl font-semibold tracking-tight text-gray-900">
              {fileCount.toLocaleString()}
            </p>
            <p className="mt-0.5 text-xs text-gray-500">
              File{fileCount === 1 ? "" : "s"} tracked
            </p>
          </div>
        </div>

        <p className="rounded-lg bg-gray-50 p-3 text-xs leading-relaxed text-gray-600">
          Usage is calculated from your records&rsquo; file metadata
          (record_files.size) — the storage Casetra tracks at the application
          level and the figure used for billing preparation. Your Supabase
          project may report a slightly different number, because that includes
          every bucket object and internal project storage. This total is for
          monitoring only; no billing or charges are applied here.
        </p>

        <div className="border-t border-gray-100 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-medium text-gray-900">
                Reconciliation check
              </h3>
              <p className="mt-0.5 max-w-md text-xs text-gray-500">
                Compare tracked metadata against the actual stored files. This
                only reports mismatches — nothing is deleted.
              </p>
            </div>
            <button
              type="button"
              onClick={runCheck}
              disabled={isPending}
              className="whitespace-nowrap rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              {isPending ? "Checking…" : "Run storage check"}
            </button>
          </div>

          {error && (
            <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          {inSync && (
            <p className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-700">
              No drift detected. Tracked metadata and stored files are in sync.
            </p>
          )}

          {result && !inSync && (
            <div className="mt-3 flex flex-col gap-4">
              {missing.length > 0 && (
                <DriftGroup
                  tone="amber"
                  title={`${missing.length} tracked file${
                    missing.length === 1 ? "" : "s"
                  } missing from storage`}
                  hint="These still count toward usage until cleaned up."
                  items={missing}
                />
              )}
              {orphaned.length > 0 && (
                <DriftGroup
                  tone="gray"
                  title={`${orphaned.length} stored file${
                    orphaned.length === 1 ? "" : "s"
                  } with no metadata`}
                  hint="These are not counted toward usage."
                  items={orphaned}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function DriftGroup({
  tone,
  title,
  hint,
  items,
}: {
  tone: "amber" | "gray";
  title: string;
  hint: string;
  items: { path: string; name: string; size: number }[];
}) {
  const toneClasses =
    tone === "amber"
      ? "border-amber-200 bg-amber-50"
      : "border-gray-200 bg-gray-50";
  return (
    <div className={`rounded-lg border p-3 ${toneClasses}`}>
      <p className="text-sm font-medium text-gray-800">{title}</p>
      <p className="mt-0.5 text-xs text-gray-500">{hint}</p>
      <ul className="mt-2 flex flex-col gap-1">
        {items.slice(0, 50).map((item) => (
          <li
            key={item.path}
            className="flex items-center justify-between gap-3 text-xs text-gray-600"
          >
            <span className="min-w-0 flex-1 truncate font-mono">{item.path}</span>
            <span className="shrink-0 text-gray-400">
              {formatBytes(item.size)}
            </span>
          </li>
        ))}
        {items.length > 50 && (
          <li className="text-xs text-gray-400">
            + {items.length - 50} more…
          </li>
        )}
      </ul>
    </div>
  );
}
