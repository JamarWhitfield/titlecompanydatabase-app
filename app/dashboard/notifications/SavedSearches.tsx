"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SavedSearch } from "@/types/database";
import { deleteSavedSearch } from "@/app/actions/notifications";

export default function SavedSearches({
  searches,
}: {
  searches: SavedSearch[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete(s: SavedSearch) {
    if (!confirm(`Delete saved search “${s.name}”?`)) return;
    startTransition(async () => {
      const result = await deleteSavedSearch(s.id);
      if (result.error) alert(result.error);
      else router.refresh();
    });
  }

  return (
    <section className="mb-6 rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">Saved searches</h2>
        <Link
          href="/dashboard/network"
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          Browse network
        </Link>
      </div>

      {searches.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="text-sm text-gray-500">
            No saved searches yet. Run a search on the{" "}
            <Link
              href="/dashboard/network"
              className="font-medium text-blue-600 hover:underline"
            >
              Shared Network
            </Link>{" "}
            and choose <span className="font-medium">Save this search</span>.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {searches.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-3 px-4 py-3 text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-gray-800">{s.name}</p>
                <p className="truncate text-xs text-gray-400">
                  matches: {s.query_text}
                </p>
              </div>
              <Link
                href={`/dashboard/network?q=${encodeURIComponent(s.query_text)}`}
                className="shrink-0 rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
              >
                Run
              </Link>
              <button
                onClick={() => handleDelete(s)}
                disabled={isPending}
                className="shrink-0 rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
