"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateFeedbackStatus } from "@/app/actions/feedback";
import { FEEDBACK_STATUS_ORDER, statusLabel } from "../labels";

const MAX_NOTE = 3000;

export default function StatusUpdateForm({
  reportId,
  currentStatus,
}: {
  reportId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateFeedbackStatus(
        reportId,
        status,
        note.trim() || undefined
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      setNote("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-1">
        <label
          htmlFor="status-select"
          className="text-sm font-medium text-gray-700"
        >
          Status
        </label>
        <select
          id="status-select"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
        >
          {FEEDBACK_STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="status-note"
          className="text-sm font-medium text-gray-700"
        >
          Note <span className="font-normal text-gray-400">(optional)</span>
        </label>
        <textarea
          id="status-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={MAX_NOTE}
          placeholder="Add context for this status change…"
          className="resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
        />
      </div>

      <div>
        <button
          type="submit"
          disabled={pending || status === currentStatus}
          className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-60"
        >
          {pending ? "Updating…" : "Update status"}
        </button>
        {status === currentStatus && (
          <span className="ml-3 text-xs text-gray-400">
            Choose a different status to update.
          </span>
        )}
      </div>
    </form>
  );
}
