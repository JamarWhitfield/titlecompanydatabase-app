"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startSupportSession } from "@/app/actions/platform";

export default function StartSupportAccess({
  companyId,
  companyName,
}: {
  companyId: string;
  companyName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await startSupportSession(companyId, reason);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.sessionId) {
        router.push(`/dashboard/platform/support/${result.sessionId}`);
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700"
      >
        Start support access
      </button>
    );
  }

  return (
    <div className="w-full max-w-md rounded-xl border border-amber-300 bg-amber-50 p-4">
      <p className="text-sm font-semibold text-amber-900">
        Break-glass support access
      </p>
      <p className="mt-1 text-xs text-amber-800">
        You are about to view private data for <strong>{companyName}</strong>.
        This is read-only, expires in 30 minutes, and every record you open or
        file you download is recorded in the platform audit log.
      </p>
      <label className="mt-3 block text-xs font-medium text-amber-900">
        Reason (required)
      </label>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        maxLength={500}
        placeholder="e.g. Investigating support ticket #1234"
        className="mt-1 w-full rounded-lg border border-amber-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
      />
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          onClick={submit}
          disabled={pending || reason.trim() === ""}
          className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {pending ? "Starting…" : "Confirm & continue"}
        </button>
        <button
          onClick={() => {
            setOpen(false);
            setReason("");
            setError(null);
          }}
          disabled={pending}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-white"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
