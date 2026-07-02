"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import FeedbackModal from "./FeedbackModal";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Best-effort: if we're on a record detail page (/dashboard/records/{uuid}),
// pull the record id so it can be attached to the report. The server still
// verifies the id belongs to the user's company, so a wrong guess is harmless.
function deriveRecordId(pathname: string): string | null {
  const match = pathname.match(/^\/dashboard\/records\/([^/]+)/);
  const candidate = match?.[1];
  return candidate && UUID_RE.test(candidate) ? candidate : null;
}

export default function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-30 inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        Send Feedback
      </button>

      <FeedbackModal
        open={open}
        onClose={() => setOpen(false)}
        relatedRecordId={deriveRecordId(pathname)}
      />
    </>
  );
}
