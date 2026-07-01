"use client";

export default function Pagination({
  page,
  pageSize,
  totalCount,
  isPending = false,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  totalCount: number;
  isPending?: boolean;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-gray-500">
        {totalCount === 0
          ? "No results"
          : `Showing ${from}–${to} of ${totalCount}`}
      </p>
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-400">
          Page {page} of {totalPages}
        </span>
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPrev || isPending}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Previous
        </button>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNext || isPending}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
