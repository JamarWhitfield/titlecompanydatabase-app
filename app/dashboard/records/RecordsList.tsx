"use client";

import {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
  useTransition,
} from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type {
  CompanyRecord,
  CompanyRecordSearchResult,
  RecordFile,
} from "@/types/database";
import { bulkSetShare } from "@/app/actions/records";
import RecordRow from "./RecordRow";
import RecordFormModal from "./RecordFormModal";
import Pagination from "../Pagination";

const inputClass =
  "rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

export default function RecordsList({
  records,
  files,
  states,
  initialQuery,
  typeFilter,
  statusFilter,
  stateFilter,
  page,
  pageSize,
  totalCount,
  isAdmin,
}: {
  records: CompanyRecordSearchResult[];
  files: RecordFile[];
  states: string[];
  initialQuery: string;
  typeFilter: string;
  statusFilter: string;
  stateFilter: string;
  page: number;
  pageSize: number;
  totalCount: number;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, startNav] = useTransition();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<CompanyRecord | null>(null);
  const [query, setQuery] = useState(initialQuery);

  // ── Bulk selection ─────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkPending, startBulk] = useTransition();
  const [bulkMessage, setBulkMessage] = useState<{
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

  const filesByRecord = useMemo(() => {
    const map = new Map<string, RecordFile[]>();
    for (const f of files) {
      const list = map.get(f.record_id) ?? [];
      list.push(f);
      map.set(f.record_id, list);
    }
    return map;
  }, [files]);

  // Selection operates on the records visible on the current page only.
  const pageIds = useMemo(() => records.map((r) => r.id), [records]);
  const visibleSelectedIds = useMemo(
    () => pageIds.filter((id) => selectedIds.has(id)),
    [pageIds, selectedIds]
  );
  const selectedCount = visibleSelectedIds.length;

  const allSelected =
    records.length > 0 && selectedCount === records.length;
  const someSelected = selectedCount > 0 && !allSelected;


  function toggleSelect(id: string, checked: boolean) {
    setBulkMessage(null);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleSelectAll(checked: boolean) {
    setBulkMessage(null);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of pageIds) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function goToPage(next: number) {
    clearSelection();
    navigate({ page: next > 1 ? String(next) : null });
  }

  function runBulkShare(share: boolean) {
    const ids = visibleSelectedIds;
    if (ids.length === 0) return;

    if (!share) {
      const ok = confirm(
        `Remove ${ids.length} record${ids.length !== 1 ? "s" : ""} from the ` +
          `shared network? Other companies will no longer be able to see ` +
          `${ids.length !== 1 ? "them" : "it"}.`
      );
      if (!ok) return;
    }

    setBulkMessage(null);
    startBulk(async () => {
      const result = await bulkSetShare(ids, share);
      if (result.error) {
        setBulkMessage({ kind: "error", text: result.error });
        return;
      }

      const verb = share ? "Shared" : "Unshared";
      const updated = result.updatedCount ?? 0;
      const skipped = result.skippedCount ?? 0;
      const failed = result.failedIds?.length ?? 0;

      const parts: string[] = [
        `${verb} ${updated} record${updated !== 1 ? "s" : ""}.`,
      ];
      if (skipped > 0) {
        parts.push(
          `${skipped} already ${share ? "shared" : "private"}.`
        );
      }
      if (failed > 0) {
        parts.push(
          `${failed} could not be updated (not owned by your company).`
        );
      }

      setBulkMessage({
        kind: failed > 0 ? "error" : "success",
        text: parts.join(" "),
      });
      clearSelection();
    });
  }

  function openCreate() {
    setEditingRecord(null);
    setModalOpen(true);
  }

  function openEdit(record: CompanyRecord) {
    setEditingRecord(record);
    setModalOpen(true);
  }

  function handleClose() {
    setModalOpen(false);
    setEditingRecord(null);
  }

  const hasActiveFilter =
    query.trim() !== "" ||
    typeFilter !== "all" ||
    statusFilter !== "all" ||
    stateFilter !== "all";

  function clearFilters() {
    setQuery("");
    navigate({ q: null, type: null, status: null, state: null, page: null });
  }

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap gap-2">
          <input
            type="search"
            placeholder="Search title, description, location, assessment number, or file contents…"
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
          <select
            value={statusFilter}
            onChange={(e) => navigate({ status: e.target.value, page: null })}
            className={inputClass}
          >
            <option value="all">All statuses</option>
            <option value="private">Private only</option>
            <option value="shared">Shared only</option>
          </select>
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
              className="text-sm text-gray-500 underline hover:text-gray-700"
            >
              Clear filters
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <p className="whitespace-nowrap text-sm text-gray-500">
            {isNavigating
              ? "Loading…"
              : `${totalCount} record${totalCount !== 1 ? "s" : ""}`}
          </p>
          <button
            onClick={openCreate}
            className="whitespace-nowrap rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            + New Record
          </button>
        </div>
      </div>

      {totalCount === 0 && !hasActiveFilter ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white py-20 text-center">
          <p className="font-semibold text-gray-700">No records yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">
            Create your first title record to start building your company
            database. Records stay private until you choose to share them.
          </p>
          <button
            onClick={openCreate}
            className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            Create your first record
          </button>
        </div>
      ) : records.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
          <p className="font-semibold text-gray-700">
            No matching records found
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
            Try a different title, property/location, assessment number, or a
            keyword from a file&apos;s contents.
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
          {isAdmin && (
            <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 bg-gray-50 px-4 py-2.5">
              <span className="text-sm font-medium text-gray-600">
                {selectedCount > 0
                  ? `${selectedCount} selected`
                  : "Select records to share or unshare in bulk"}
              </span>
              <div className="ml-auto flex items-center gap-2">
                {selectedCount > 0 && (
                  <button
                    onClick={clearSelection}
                    disabled={isBulkPending}
                    className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-100 disabled:opacity-50"
                  >
                    Clear
                  </button>
                )}
                <button
                  onClick={() => runBulkShare(true)}
                  disabled={selectedCount === 0 || isBulkPending}
                  className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isBulkPending ? "Working…" : "Share selected"}
                </button>
                <button
                  onClick={() => runBulkShare(false)}
                  disabled={selectedCount === 0 || isBulkPending}
                  className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isBulkPending ? "Working…" : "Unshare selected"}
                </button>
              </div>
            </div>
          )}
          {bulkMessage && (
            <div
              role="status"
              className={`border-b px-4 py-2 text-sm ${
                bulkMessage.kind === "success"
                  ? "border-green-100 bg-green-50 text-green-700"
                  : "border-red-100 bg-red-50 text-red-700"
              }`}
            >
              {bulkMessage.text}
            </div>
          )}
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              <tr>
                {isAdmin && (
                  <th className="px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label="Select all records on this page"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someSelected;
                      }}
                      onChange={(e) => toggleSelectAll(e.target.checked)}
                      className="h-4 w-4 cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                )}
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.map((record) => (
                <RecordRow
                  key={record.id}
                  record={record}
                  files={filesByRecord.get(record.id) ?? []}
                  onEdit={() => openEdit(record)}
                  selected={selectedIds.has(record.id)}
                  onToggleSelect={(checked) =>
                    toggleSelect(record.id, checked)
                  }
                  isAdmin={isAdmin}
                  searchQuery={initialQuery}
                />
              ))}
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

      {/* key forces the modal to fully remount when switching create ↔ edit,
          resetting useActionState and defaultValues */}
      <RecordFormModal
        key={editingRecord?.id ?? "new"}
        open={modalOpen}
        onClose={handleClose}
        record={editingRecord}
        files={editingRecord ? filesByRecord.get(editingRecord.id) ?? [] : []}
      />
    </>
  );
}

