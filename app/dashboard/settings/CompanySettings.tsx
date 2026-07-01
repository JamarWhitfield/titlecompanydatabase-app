"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { renameCompany } from "@/app/actions/team";

export default function CompanySettings({
  currentName,
}: {
  currentName: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(currentName);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const trimmed = name.trim();
  const dirty = trimmed !== currentName && trimmed.length > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (!dirty) return;
    startTransition(async () => {
      const result = await renameCompany(trimmed);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
    });
  }

  return (
    <section className="mb-6 rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">Company name</h2>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 px-4 py-4">
        {error && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={120}
            placeholder="Your company name"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={isPending || !dirty}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {isPending ? "Saving…" : saved ? "Saved" : "Save"}
          </button>
        </div>
        <p className="text-xs text-gray-500">
          This updates how your company appears across the network.
        </p>
      </form>
    </section>
  );
}
