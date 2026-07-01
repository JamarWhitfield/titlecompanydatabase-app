"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CompanyInvitation } from "@/types/database";
import { revokeInvitation } from "@/app/actions/team";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function InvitesList({
  invitations,
}: {
  invitations: CompanyInvitation[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // Capture "now" once on mount so render stays pure (no Date.now in render).
  const [now] = useState(() => Date.now());

  function handleRevoke(inv: CompanyInvitation) {
    if (!confirm(`Revoke the invitation for ${inv.email}?`)) return;
    startTransition(async () => {
      const result = await revokeInvitation(inv.id);
      if (result.error) alert(result.error);
      else router.refresh();
    });
  }

  function copyLink(token: string) {
    const link = `${window.location.origin}/register?invite=${token}`;
    navigator.clipboard?.writeText(link).catch(() => {});
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">
          Pending invitations
          <span className="ml-2 text-xs font-normal text-gray-400">
            {invitations.length}
          </span>
        </h2>
      </div>

      {invitations.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="text-sm text-gray-500">No pending invitations.</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {invitations.map((inv) => {
            const expired = new Date(inv.expires_at).getTime() < now;
            return (
              <li
                key={inv.id}
                className="flex items-center gap-3 px-4 py-3 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-gray-800">
                    {inv.email}
                  </p>
                  <p className="truncate text-xs text-gray-400">
                    <span className="capitalize">{inv.role}</span>
                    {" · "}
                    {expired ? (
                      <span className="text-red-500">
                        expired {formatDate(inv.expires_at)}
                      </span>
                    ) : (
                      <>expires {formatDate(inv.expires_at)}</>
                    )}
                  </p>
                </div>
                {!expired && (
                  <button
                    onClick={() => copyLink(inv.token)}
                    className="shrink-0 rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
                  >
                    Copy link
                  </button>
                )}
                <button
                  onClick={() => handleRevoke(inv)}
                  disabled={isPending}
                  className="shrink-0 rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  Revoke
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
