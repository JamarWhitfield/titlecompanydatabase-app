"use client";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <div className="flex max-w-5xl flex-col items-center justify-center rounded-xl border border-red-100 bg-red-50 py-20 text-center">
      <p className="font-medium text-red-800">Failed to load your records</p>
      <p className="mt-1 text-sm text-red-600">
        {error.digest
          ? `Something went wrong (ref: ${error.digest}). Please try again.`
          : "Something went wrong. Please try again."}
      </p>
      <button
        onClick={unstable_retry}
        className="mt-4 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
      >
        Try again
      </button>
    </div>
  );
}
