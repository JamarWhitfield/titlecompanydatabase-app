"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useTransition,
  Fragment,
} from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { getSignedUrl } from "@/app/actions/files";
import { saveSearch } from "@/app/actions/notifications";
import { formatBytes, fileTypeLabel } from "@/lib/fileMeta";
import Pagination from "../Pagination";
import type { SharedRecord, RecordFile } from "@/types/database";

const TYPE_LABELS: Record<string, string> = {
  abstract: "Abstract",
  qualia_file: "Qualia File",
};

const TYPE_COLORS: Record<string, string> = {
  abstract: "bg-indigo-100 text-indigo-700",
  qualia_file: "bg-teal-100 text-teal-700",
  general: "bg-gray-100 text-gray-600",
};

const inputClass =
  "rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

interface Props {
  records: SharedRecord[];
  filesByRecord: Record<string, RecordFile[]>;
  myCompanyId: string;
  states: string[];
  companies: { id: string; name: string }[];
  initialQuery: string;
  typeFilter: string;
  companyFilter: string;
  stateFilter: string;
  page: number;
  pageSize: number;
  totalCount: number;
}

export default function NetworkList({
  records,
  filesByRecord,
  myCompanyId,
  states,
  companies,
  initialQuery,
  typeFilter,
  companyFilter,
  stateFilter,
  page,
  pageSize,
  totalCount,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [isNavigating, startNav] = useTransition();
  const [isSaving, startSave] = useTransition();
  const [saveMessage, setSaveMessage] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  // Push filter/search/page state into the URL so the SERVER re-queries with
  // LIMIT/OFFSET. All filtering + pagination happens at the database level —
  // the client never receives more than one page of rows.
  const navigate = useCallback(
    (overrides: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      for (const [key, value] of Object.entries(overrides)) {
        if (value === null || value === "" || value === "all") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      const qs = params.toString();
      if (qs === (searchParams?.toString() ?? "")) return;
      startNav(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [searchParams, pathname, router]
  );

  // Debounce the search box into the URL (resets to the first page).
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const handle = setTimeout(() => {
      navigate({ q: query.trim() || null, page: null });
    }, 350);
    return () => clearTimeout(handle);
  }, [query, navigate]);

  function handleDownload(file: RecordFile) {
    startTransition(async () => {
      const result = await getSignedUrl(file.path);
      if (result.error) {
        alert(result.error);
        return;
      }
      if (result.url) window.open(result.url, "_blank");
    });
  }

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSaveSearch() {
    const term = query.trim();
    if (!term) return;
    const name = window.prompt(
      "Name this saved search. You'll be notified when a newly shared record matches it.",
      term
    );
    if (name === null) return; // cancelled
    setSaveMessage(null);
    startSave(async () => {
      const result = await saveSearch(name, term);
      if (result.error) {
        setSaveMessage({ kind: "error", text: result.error });
      } else {
        setSaveMessage({
          kind: "success",
          text: `Saved “${name.trim() || term}”. We'll notify you when new shared records match.`,
        });
      }
    });
  }

  function clearFilters() {
    setQuery("");
    navigate({ q: null, type: null, company: null, state: null, page: null });
  }

  function goToPage(next: number) {
    navigate({ page: next > 1 ? String(next) : null });
  }

  const hasActiveFilter =
    query.trim() !== "" ||
    typeFilter !== "all" ||
    companyFilter !== "all" ||
    stateFilter !== "all";

  return (
    <>
      {records.length > 0 && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2 text-xs text-blue-800">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mt-0.5 h-3.5 w-3.5 shrink-0"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
          <span>
            Records here are contributed by participating title companies and
            are read-only unless they belong to your company. Manage your own
            shared records from{" "}
            <Link href="/dashboard/records" className="font-medium underline">
              My Records
            </Link>
            .
          </span>
        </div>
      )}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap gap-2">
          <input
            type="search"
            placeholder="Search shared records by title, company, location, or file contents…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={`${inputClass} w-full sm:max-w-xs`}
          />
          <select
            value={typeFilter}
            onChange={(e) => navigate({ type: e.target.value, page: null })}
            className={inputClass}
          >
            <option value="all">All types</option>
            <option value="abstract">Abstract</option>
            <option value="qualia_file">Qualia File</option>
          </select>
          {companies.length > 1 && (
            <select
              value={companyFilter}
              onChange={(e) => navigate({ company: e.target.value, page: null })}
              className={inputClass}
            >
              <option value="all">All companies</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          {states.length > 0 && (
            <select
              value={stateFilter}
              onChange={(e) => navigate({ state: e.target.value, page: null })}
              className={inputClass}
            >
              <option value="all">All states</option>
              {states.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}
          {hasActiveFilter && (
            <button
              onClick={clearFilters}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Clear filters
            </button>
          )}
        </div>
        <p className="whitespace-nowrap text-sm text-gray-500">
          {isNavigating
            ? "Loading…"
            : `${totalCount} record${totalCount !== 1 ? "s" : ""}`}
        </p>
      </div>

      {query.trim() && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <button
            onClick={handleSaveSearch}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-50"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
            {isSaving ? "Saving…" : "Save this search"}
          </button>
          {saveMessage && (
            <span
              role="status"
              className={`text-sm ${
                saveMessage.kind === "success"
                  ? "text-green-700"
                  : "text-red-600"
              }`}
            >
              {saveMessage.text}
            </span>
          )}
        </div>
      )}

      {totalCount === 0 && !hasActiveFilter ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white py-20 text-center">
          <p className="font-semibold text-gray-700">No shared records found</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">
            Shared records from participating title companies will appear here
            &mdash; read-only. Share your own records from{" "}
            <Link href="/dashboard/records" className="text-blue-600 hover:underline">
              My Records
            </Link>
            .
          </p>
        </div>
      ) : records.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
          <p className="font-semibold text-gray-700">No matching records found</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
            Try a different title, company, property/location, or file name.
          </p>
          {hasActiveFilter && (
            <button
              onClick={clearFilters}
              className="mt-3 text-sm font-medium text-blue-600 hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3 whitespace-nowrap">Shared On</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.map((record) => {
                const isOwn = record.company_id === myCompanyId;
                const typeColor =
                  TYPE_COLORS[record.record_type] ?? TYPE_COLORS.general;
                const typeLabel =
                  TYPE_LABELS[record.record_type] ?? record.record_type;
                const sharedDate = record.shared_at
                  ? new Date(record.shared_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "—";
                const isExpanded = expanded.has(record.id);
                const recordFileCount = (filesByRecord[record.id] ?? []).length;
                const location = [record.county, record.state]
                  .filter(Boolean)
                  .join(", ");

                return (
                  <Fragment key={record.id}>
                    <tr
                      onClick={() => toggleExpanded(record.id)}
                      title="View details"
                      className="cursor-pointer transition-colors hover:bg-gray-50"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="text-gray-400"
                            aria-hidden="true"
                          >
                            {isExpanded ? "▾" : "▸"}
                          </span>
                          <span className="font-medium text-gray-900">
                            {record.title}
                          </span>
                          {isOwn ? (
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                              Yours
                            </span>
                          ) : (
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                              Read-only
                            </span>
                          )}
                          {recordFileCount > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                              {recordFileCount} file{recordFileCount !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                        {record.description && (
                          <div className="mt-0.5 max-w-sm truncate pl-6 text-xs text-gray-500">
                            {record.description}
                          </div>
                        )}
                        {location && (
                          <div className="mt-0.5 pl-6 text-xs text-gray-400">
                            {location}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {record.company_name}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${typeColor}`}
                        >
                          {typeLabel}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
                        {sharedDate}
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr>
                        <td colSpan={4} className="bg-gray-50 px-4 py-4">
                          <dl className="grid gap-x-6 gap-y-3 pl-6 sm:grid-cols-2">
                            <div className="sm:col-span-2">
                              <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
                                Description
                              </dt>
                              <dd className="mt-0.5 text-sm text-gray-700">
                                {record.description || "—"}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
                                County / State
                              </dt>
                              <dd className="mt-0.5 text-sm text-gray-700">
                                {location || "—"}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
                                Shared by
                              </dt>
                              <dd className="mt-0.5 text-sm text-gray-700">
                                {record.company_name}
                                {isOwn ? " (your company)" : ""}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
                                Shared on
                              </dt>
                              <dd className="mt-0.5 text-sm text-gray-700">
                                {sharedDate}
                              </dd>
                            </div>
                          </dl>
                          {(() => {
                            const recordFiles = filesByRecord[record.id] ?? [];
                            if (recordFiles.length === 0) return null;
                            return (
                              <div className="mt-4 pl-6">
                                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                                  Files
                                </p>
                                <div className="mt-1.5 flex flex-col gap-1.5">
                                  {recordFiles.map((file) => (
                                    <div
                                      key={file.id}
                                      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs"
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
                                      {file.indexed && (
                                        <span
                                          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 font-medium text-green-700"
                                          title="Text was extracted and is searchable"
                                        >
                                          Indexed
                                        </span>
                                      )}
                                      <button
                                        onClick={() => handleDownload(file)}
                                        disabled={isPending}
                                        className="ml-auto shrink-0 font-medium text-blue-600 hover:underline disabled:opacity-50"
                                      >
                                        Download
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}
                          {!isOwn && (
                            <p className="mt-3 pl-6 text-xs text-gray-400">
                              This record is shared to the network and is
                              read-only. Only {record.company_name} can edit it.
                            </p>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalCount > 0 && (
        <Pagination
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          isPending={isNavigating}
          onPageChange={goToPage}
        />
      )}
    </>
  );
}
