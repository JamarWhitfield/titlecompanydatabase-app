"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { inviteMember } from "@/app/actions/team";

export default function InviteForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [error, setError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [emailed, setEmailed] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInviteLink(null);
    setEmailed(false);
    setSentTo(null);
    setCopied(false);
    startTransition(async () => {
      const result = await inviteMember(email, role);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSentTo(email.trim());
      setEmailed(Boolean(result.emailed));
      if (result.token) {
        setInviteLink(`${window.location.origin}/register?invite=${result.token}`);
      }
      setEmail("");
      setRole("member");
      router.refresh();
    });
  }

  async function handleCopy() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be unavailable (e.g. insecure context) — ignore.
    }
  }

  return (
    <section className="mb-6 rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">Invite a teammate</h2>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 px-4 py-4">
        {error && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="teammate@titleco.com"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "admin" | "member")}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {isPending ? "Sending…" : "Send invite"}
          </button>
        </div>

        {inviteLink && (
          <div className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
            <p className="mb-2 font-medium">
              {emailed
                ? `Invitation emailed to ${sentTo}.`
                : "Invitation created."}
            </p>
            <p className="mb-2 text-xs text-green-700">
              {emailed
                ? "You can also share this link directly. It expires in 7 days."
                : "Share this link with your teammate. It expires in 7 days."}
            </p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={inviteLink}
                onFocus={(e) => e.target.select()}
                className="flex-1 rounded border border-green-200 bg-white px-2 py-1 text-xs text-gray-700"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="shrink-0 rounded bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        )}
      </form>
    </section>
  );
}
