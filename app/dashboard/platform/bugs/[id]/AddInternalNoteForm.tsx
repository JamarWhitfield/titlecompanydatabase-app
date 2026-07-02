"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addFeedbackInternalNote } from "@/app/actions/feedback";

const MAX_NOTE = 3000;

export default function AddInternalNoteForm({
  reportId,
}: {
  reportId: string;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!note.trim()) {
      setError("Please enter a note.");
      return;
    }
    startTransition(async () => {
      const result = await addFeedbackInternalNote(reportId, note.trim());
      if (result.error) {
        setError(result.error);
        return;
      }
      setNote("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <label htmlFor="internal-note" className="sr-only">
        Add an internal note
      </label>
      <textarea
        id="internal-note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        maxLength={MAX_NOTE}
        placeholder="Add an internal note (visible to platform admins only)…"
        className="resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {note.length}/{MAX_NOTE}
        </span>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Add note"}
        </button>
      </div>
    </form>
  );
}
