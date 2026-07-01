"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addNote, updateNote, deleteNote } from "@/app/actions/notes";

export interface NoteView {
  id: string;
  authorName: string;
  userId: string;
  text: string;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  recordId: string;
  notes: NoteView[];
  currentUserId: string;
  isAdmin: boolean;
}

function formatTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function RecordNotes({
  recordId,
  notes,
  currentUserId,
  isAdmin,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  function handleAdd() {
    const text = draft.trim();
    if (!text) return;
    startTransition(async () => {
      const result = await addNote(recordId, text);
      if (result.error) {
        alert(result.error);
        return;
      }
      setDraft("");
      router.refresh();
    });
  }

  function handleSaveEdit(id: string) {
    const text = editText.trim();
    if (!text) return;
    startTransition(async () => {
      const result = await updateNote(id, text);
      if (result.error) {
        alert(result.error);
        return;
      }
      setEditingId(null);
      setEditText("");
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this note? This cannot be undone.")) return;
    startTransition(async () => {
      const result = await deleteNote(id);
      if (result.error) {
        alert(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="mt-6">
      <h2 className="mb-2 text-sm font-semibold text-gray-900">
        Notes{" "}
        <span className="font-normal text-gray-400">({notes.length})</span>
      </h2>
      <p className="mb-3 text-xs text-gray-400">
        Internal notes are private to your company and never shared with other
        companies.
      </p>

      {/* Add a note */}
      <div className="mb-4 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a note for your team…"
          rows={3}
          maxLength={2000}
          className="w-full resize-y rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-blue-500 focus:outline-none"
        />
        <div className="mt-2 flex justify-end">
          <button
            onClick={handleAdd}
            disabled={isPending || draft.trim().length === 0}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            Add note
          </button>
        </div>
      </div>

      {/* Notes list */}
      {notes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-8 text-center">
          <p className="text-sm text-gray-500">
            No notes yet. Add the first note to start a thread for your team.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {notes.map((note) => {
            const canManage = note.userId === currentUserId || isAdmin;
            const edited = note.updatedAt !== note.createdAt;
            return (
              <li
                key={note.id}
                className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm"
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-gray-800">
                    {note.authorName}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatTime(note.createdAt)}
                    {edited ? " · edited" : ""}
                  </span>
                </div>

                {editingId === note.id ? (
                  <div>
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={3}
                      maxLength={2000}
                      className="w-full resize-y rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-blue-500 focus:outline-none"
                    />
                    <div className="mt-2 flex justify-end gap-2 text-xs">
                      <button
                        onClick={() => {
                          setEditingId(null);
                          setEditText("");
                        }}
                        disabled={isPending}
                        className="rounded px-2.5 py-1.5 font-medium text-gray-500 hover:bg-gray-100 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSaveEdit(note.id)}
                        disabled={isPending || editText.trim().length === 0}
                        className="rounded bg-blue-600 px-2.5 py-1.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="whitespace-pre-wrap text-sm text-gray-700">
                      {note.text}
                    </p>
                    {canManage && (
                      <div className="mt-1.5 flex gap-3 text-xs">
                        <button
                          onClick={() => {
                            setEditingId(note.id);
                            setEditText(note.text);
                          }}
                          disabled={isPending}
                          className="font-medium text-gray-500 hover:text-gray-700 disabled:opacity-50"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(note.id)}
                          disabled={isPending}
                          className="font-medium text-red-500 hover:text-red-700 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
