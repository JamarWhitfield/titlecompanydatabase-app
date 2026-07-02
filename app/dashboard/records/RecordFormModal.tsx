"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createRecord, updateRecord } from "@/app/actions/records";
import { deleteFile, getSignedUrl } from "@/app/actions/files";
import { formatBytes, fileTypeLabel } from "@/lib/fileMeta";
import type { CompanyRecord, RecordFile } from "@/types/database";

const US_STATES = [
  "Alabama",
  "Florida",
  "Louisiana",
  "Mississippi",
];

interface Props {
  open: boolean;
  onClose: () => void;
  record: CompanyRecord | null;
  files: RecordFile[];
}

export default function RecordFormModal({ open, onClose, record, files }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const isEditing = record !== null;
  const [fileActionPending, startFileAction] = useTransition();

  const [state, formAction, pending] = useActionState(
    isEditing ? updateRecord : createRecord,
    undefined
  );

  function handleDownload(file: RecordFile) {
    startFileAction(async () => {
      const result = await getSignedUrl(file.path);
      if (result.error) {
        alert(result.error);
        return;
      }
      if (result.url) window.open(result.url, "_blank");
    });
  }

  function handleRemove(file: RecordFile) {
    if (!confirm(`Remove "${file.name}" from this record? This cannot be undone.`))
      return;
    startFileAction(async () => {
      const result = await deleteFile(file.id, file.path);
      if (result.error) {
        alert(result.error);
        return;
      }
      router.refresh();
    });
  }

  // Open or close the native <dialog> when the `open` prop changes
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Sync React state when the user presses ESC (native dialog close)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.addEventListener("close", onClose);
    return () => dialog.removeEventListener("close", onClose);
  }, [onClose]);

  // Auto-close after a successful save
  useEffect(() => {
    if (state?.success) onClose();
  }, [state?.success, onClose]);

  return (
    <dialog
      ref={dialogRef}
      className="m-auto w-full max-w-md rounded-xl border border-gray-200 bg-white p-0 shadow-xl backdrop:bg-black/40"
      onClick={(e) => {
        // Close when clicking the backdrop (the dialog element itself, not its children)
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <div className="p-6">
        <h2 className="mb-5 text-lg font-semibold text-gray-900">
          {isEditing ? "Edit Record" : "New Record"}
        </h2>

        <form action={formAction} className="flex flex-col gap-4">
          {isEditing && (
            <input type="hidden" name="id" value={record.id} />
          )}

          {state?.error && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {state.error}
            </p>
          )}

          <div className="flex flex-col gap-1">
            <label
              htmlFor="modal-title"
              className="text-sm font-medium text-gray-700"
            >
              Title <span className="text-red-500">*</span>
            </label>
            <input
              id="modal-title"
              name="title"
              type="text"
              required
              defaultValue={state?.values?.title ?? record?.title ?? ""}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="e.g. 123 Main St — Lien Search"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="modal-type"
              className="text-sm font-medium text-gray-700"
            >
              Type
            </label>
            <select
              id="modal-type"
              name="record_type"
              defaultValue={
                state?.values?.record_type ?? record?.record_type ?? "abstract"
              }
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="abstract">Abstract</option>
              <option value="qualia_file">Qualia File</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label
                htmlFor="modal-state"
                className="text-sm font-medium text-gray-700"
              >
                State
              </label>
              <select
                id="modal-state"
                name="state"
                defaultValue={state?.values?.state ?? record?.state ?? ""}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">— Select state —</option>
                {US_STATES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor="modal-county"
                className="text-sm font-medium text-gray-700"
              >
                County/Parish
              </label>
              <input
                id="modal-county"
                name="county"
                type="text"
                defaultValue={state?.values?.county ?? record?.county ?? ""}
                placeholder="e.g. Jefferson"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {isEditing && (
            <div className="flex flex-col gap-1">
              <label
                htmlFor="modal-description"
                className="text-sm font-medium text-gray-700"
              >
                Description
              </label>
              <textarea
                id="modal-description"
                name="description"
                rows={3}
                defaultValue={
                  state?.values?.description ?? record?.description ?? ""
                }
                className="resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Optional notes or details…"
              />
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label
              htmlFor="modal-files"
              className="text-sm font-medium text-gray-700"
            >
              Attachments
            </label>
            {isEditing && files.length > 0 && (
              <div className="mb-1 flex flex-col gap-1.5">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs"
                  >
                    <span className="min-w-0 flex-1 truncate font-medium text-gray-800">
                      {file.name}
                    </span>
                    <span className="shrink-0 rounded bg-gray-200/70 px-1.5 py-0.5 font-medium text-gray-600">
                      {fileTypeLabel(file.mime_type, file.name)}
                    </span>
                    <span className="shrink-0 text-gray-400">
                      {formatBytes(file.size)}
                    </span>
                    <span
                      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-medium ${
                        file.indexed
                          ? "bg-green-50 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                      title={
                        file.indexed
                          ? "Text was extracted and is searchable"
                          : "No searchable text was extracted from this file"
                      }
                    >
                      {file.indexed ? "Indexed" : "No text"}
                    </span>
                    <div className="ml-auto flex shrink-0 gap-3">
                      <button
                        type="button"
                        onClick={() => handleDownload(file)}
                        disabled={fileActionPending}
                        className="font-medium text-blue-600 hover:underline disabled:opacity-50"
                      >
                        Download
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemove(file)}
                        disabled={fileActionPending}
                        className="font-medium text-red-500 hover:underline disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {isEditing && files.length === 0 && (
              <p className="mb-1 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
                No attachments yet. Upload PDFs, images, or documents to make
                this record easier to search.
              </p>
            )}
            <input
              id="modal-files"
              name="files"
              type="file"
              multiple
              className="text-sm text-gray-600 file:mr-3 file:rounded-lg file:border file:border-gray-300 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-gray-700 hover:file:bg-gray-50"
            />
            <p className="text-xs text-gray-400">
              {isEditing
                ? "Existing attachments stay on the record. Add more below (up to 5, 10 MB each)."
                : "Up to 5 files, 10 MB each. Any file type accepted."}
            </p>
          </div>

          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {pending
                ? "Saving…"
                : isEditing
                  ? "Save changes"
                  : "Create record"}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
