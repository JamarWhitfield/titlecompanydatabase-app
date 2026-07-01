"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateProfile } from "@/app/actions/profile";

export default function ProfileSettings({
  currentName,
  email,
  role,
}: {
  currentName: string;
  email: string;
  role: "admin" | "member";
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
      const result = await updateProfile(trimmed);
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
        <h2 className="text-sm font-semibold text-gray-900">Your profile</h2>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4 py-4">
        {error && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-1">
          <label
            htmlFor="full_name"
            className="text-xs font-medium uppercase tracking-wide text-gray-400"
          >
            Full name
          </label>
          <input
            id="full_name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={255}
            placeholder="Your name"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-400">
              Email
            </span>
            <p className="text-sm text-gray-700">{email || "—"}</p>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-400">
              Role
            </span>
            <p className="text-sm text-gray-700">
              {role === "admin" ? "Admin" : "Member"}
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending || !dirty}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {isPending ? "Saving…" : saved ? "Saved" : "Save"}
          </button>
        </div>
      </form>
    </section>
  );
}
