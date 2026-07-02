"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { submitFeedbackReport } from "@/app/actions/feedback";

// Value/label pairs kept in sync with the DB CHECK constraints (migration 0028)
// and the server action's controlled vocabularies (app/actions/feedback.ts).
const FEEDBACK_TYPES = [
  { value: "bug", label: "Report a bug" },
  { value: "feature_request", label: "Request a feature" },
  { value: "confusing_ux", label: "Something is confusing" },
  { value: "data_import_issue", label: "Data/import issue" },
  { value: "other", label: "Other" },
] as const;

const CATEGORIES = [
  { value: "general", label: "General" },
  { value: "search_issue", label: "Search issue" },
  { value: "upload_issue", label: "Upload issue" },
  { value: "permission_issue", label: "Permission issue" },
  { value: "file_download_issue", label: "File download issue" },
  { value: "record_issue", label: "Record issue" },
  { value: "network_sharing_issue", label: "Network sharing issue" },
  { value: "data_import_issue", label: "Data/import issue" },
  { value: "feature_request", label: "Feature request" },
  { value: "confusing_ui", label: "Confusing UI" },
  { value: "other", label: "Other" },
] as const;

const SEVERITIES = [
  { value: "low", label: "Low", meaning: "Annoying but not blocking work" },
  { value: "medium", label: "Medium", meaning: "Slows down workflow" },
  { value: "high", label: "High", meaning: "Blocks an important task" },
  {
    value: "critical",
    label: "Critical",
    meaning: "Data, security, or access issue",
  },
] as const;

const MAX_TITLE = 200;
const MAX_DESCRIPTION = 5000;
const MAX_EXPECTED = 3000;
const MAX_RELATED = 1000;
const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_SCREENSHOT_MIME = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
];

interface Props {
  open: boolean;
  onClose: () => void;
  // Optional record id derived from the current route (best-effort).
  relatedRecordId?: string | null;
}

export default function FeedbackModal({
  open,
  onClose,
  relatedRecordId,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [screenshotName, setScreenshotName] = useState<string | null>(null);
  const [screenshotError, setScreenshotError] = useState<string | null>(null);
  const [pending, startSubmit] = useTransition();

  // Reset transient state + the form. Called on close so the next open starts
  // clean (done in event callbacks, never synchronously inside an effect).
  const resetState = useCallback(() => {
    setError(null);
    setSuccess(false);
    setScreenshotName(null);
    setScreenshotError(null);
    if (fileRef.current) fileRef.current.value = "";
    formRef.current?.reset();
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [onClose, resetState]);

  // Open/close the native <dialog> in response to the `open` prop.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  // Sync React state when the user presses ESC (native dialog close).
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [handleClose]);

  function validateScreenshot(file: File): string | null {
    if (!ALLOWED_SCREENSHOT_MIME.includes(file.type)) {
      return "Screenshot must be a PNG, JPG, or WEBP file.";
    }
    if (file.size > MAX_SCREENSHOT_BYTES) {
      return "Screenshot must be less than 5 MB.";
    }
    return null;
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setScreenshotName(null);
      setScreenshotError(null);
      return;
    }
    const err = validateScreenshot(file);
    if (err) {
      setScreenshotError(err);
      setScreenshotName(null);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setScreenshotError(null);
    setScreenshotName(file.name);
  }

  function removeScreenshot() {
    if (fileRef.current) fileRef.current.value = "";
    setScreenshotName(null);
    setScreenshotError(null);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = formRef.current;
    if (!form) return;

    // Re-validate the screenshot on the way out (belt and suspenders).
    const file = fileRef.current?.files?.[0];
    if (file) {
      const err = validateScreenshot(file);
      if (err) {
        setScreenshotError(err);
        return;
      }
    }

    const fd = new FormData(form);

    // Automatically captured context — the user never fills these out.
    fd.set("page_url", window.location.href);
    fd.set("pathname", window.location.pathname);
    fd.set("browser_user_agent", navigator.userAgent);
    fd.set("browser_language", navigator.language);
    fd.set("browser_platform", navigator.platform);
    fd.set("screen_width", String(window.screen.width));
    fd.set("screen_height", String(window.screen.height));
    fd.set("viewport_width", String(window.innerWidth));
    fd.set("viewport_height", String(window.innerHeight));
    if (relatedRecordId) fd.set("related_record_id", relatedRecordId);

    startSubmit(async () => {
      const result = await submitFeedbackReport(fd);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccess(true);
      form.reset();
      removeScreenshot();
      // Show the success state briefly, then close.
      setTimeout(() => handleClose(), 1600);
    });
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="feedback-modal-title"
      className="m-auto w-full max-w-lg rounded-xl border border-gray-200 bg-white p-0 shadow-xl backdrop:bg-black/40"
      onClick={(e) => {
        if (e.target === dialogRef.current) handleClose();
      }}
    >
      <div className="max-h-[85vh] overflow-y-auto p-6">
        <div className="mb-1 flex items-start justify-between gap-4">
          <h2
            id="feedback-modal-title"
            className="text-lg font-semibold text-gray-900"
          >
            Send Feedback
          </h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="mb-5 text-sm text-gray-500">
          Report a bug, request a feature, flag something confusing, or let us
          know about a data/import issue.
        </p>

        {success ? (
          <div
            role="status"
            className="rounded-lg bg-green-50 p-4 text-sm font-medium text-green-700"
          >
            Thanks — your feedback was submitted.
          </div>
        ) : (
          <form
            ref={formRef}
            onSubmit={handleSubmit}
            className="flex flex-col gap-4"
          >
            {error && (
              <p
                role="alert"
                className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
              >
                {error}
              </p>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="feedback-type"
                  className="text-sm font-medium text-gray-700"
                >
                  Feedback type <span className="text-red-500">*</span>
                </label>
                <select
                  id="feedback-type"
                  name="feedback_type"
                  required
                  defaultValue="bug"
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {FEEDBACK_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label
                  htmlFor="feedback-category"
                  className="text-sm font-medium text-gray-700"
                >
                  Category
                </label>
                <select
                  id="feedback-category"
                  name="category"
                  defaultValue="general"
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor="feedback-severity"
                className="text-sm font-medium text-gray-700"
              >
                Severity <span className="text-red-500">*</span>
              </label>
              <select
                id="feedback-severity"
                name="severity"
                required
                defaultValue="low"
                aria-describedby="feedback-severity-help"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {SEVERITIES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label} — {s.meaning}
                  </option>
                ))}
              </select>
              <p id="feedback-severity-help" className="text-xs text-gray-400">
                Use Critical only for data, security, access, or work-blocking
                issues.
              </p>
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor="feedback-title"
                className="text-sm font-medium text-gray-700"
              >
                Title <span className="text-red-500">*</span>
              </label>
              <input
                id="feedback-title"
                name="title"
                type="text"
                required
                maxLength={MAX_TITLE}
                placeholder="Short summary of the issue or request"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor="feedback-description"
                className="text-sm font-medium text-gray-700"
              >
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                id="feedback-description"
                name="description"
                required
                rows={4}
                maxLength={MAX_DESCRIPTION}
                placeholder="Describe what happened, what you were trying to do, and any details that might help us understand the issue."
                className="resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor="feedback-expected"
                className="text-sm font-medium text-gray-700"
              >
                Expected behavior
              </label>
              <textarea
                id="feedback-expected"
                name="expected_behavior"
                rows={2}
                maxLength={MAX_EXPECTED}
                placeholder="What did you expect to happen instead?"
                className="resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor="feedback-related"
                className="text-sm font-medium text-gray-700"
              >
                Related record, file, or page
              </label>
              <input
                id="feedback-related"
                name="related_resource_url"
                type="text"
                maxLength={MAX_RELATED}
                placeholder="Paste a record URL, file URL, or describe what this relates to"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor="feedback-screenshot"
                className="text-sm font-medium text-gray-700"
              >
                Screenshot
              </label>
              <input
                ref={fileRef}
                id="feedback-screenshot"
                name="screenshot"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFileChange}
                aria-describedby="feedback-screenshot-help"
                className="text-sm text-gray-600 file:mr-3 file:rounded-lg file:border file:border-gray-300 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-gray-700 hover:file:bg-gray-50"
              />
              {screenshotName && (
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="truncate">{screenshotName}</span>
                  <button
                    type="button"
                    onClick={removeScreenshot}
                    className="font-medium text-red-500 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              )}
              {screenshotError ? (
                <p role="alert" className="text-xs text-red-600">
                  {screenshotError}
                </p>
              ) : (
                <p id="feedback-screenshot-help" className="text-xs text-gray-400">
                  Optional: attach a screenshot to help us understand the issue.
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {pending ? "Submitting…" : "Send feedback"}
              </button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}
