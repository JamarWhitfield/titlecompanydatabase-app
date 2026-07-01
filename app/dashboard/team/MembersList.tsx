"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Profile } from "@/types/database";
import { setMemberRole, removeMember } from "@/app/actions/team";

function initials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

// Profiles only carry full_name (email lives in auth.users), so fall back to a
// generic label when a member hasn't set a display name.
function memberLabel(member: Profile): string {
  return member.full_name?.trim() || "this member";
}

export default function MembersList({
  members,
  currentUserId,
}: {
  members: Profile[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  function handleRoleChange(member: Profile, newRole: "admin" | "member") {
    if (newRole === member.role) return;
    const verb = newRole === "admin" ? "promote" : "demote";
    if (!confirm(`Are you sure you want to ${verb} ${member.full_name ?? "this member"}?`))
      return;
    startTransition(async () => {
      const result = await setMemberRole(member.id, newRole);
      if (result.error) alert(result.error);
      else router.refresh();
    });
  }

  function handleRemove(member: Profile) {
    // UI guard — the server action + RPC remain the source of truth.
    if (member.id === currentUserId) return;

    const label = memberLabel(member);
    if (
      !confirm(
        `Remove team member?\n\nAre you sure you want to remove ${label} from this company? They will lose access to company records, notes, files, notifications, and team resources.`
      )
    ) {
      return;
    }

    startTransition(async () => {
      const result = await removeMember(member.id);
      if (result.error) {
        setFeedback({ kind: "error", text: result.error });
        return;
      }
      setFeedback({ kind: "success", text: `${label} was removed from the company.` });
      router.refresh();
    });
  }

  return (
    <section className="mb-6 rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">
          Members
          <span className="ml-2 text-xs font-normal text-gray-400">
            {members.length}
          </span>
        </h2>
      </div>

      {feedback && (
        <div
          className={
            feedback.kind === "success"
              ? "border-b border-green-100 bg-green-50 px-4 py-2 text-xs font-medium text-green-700"
              : "border-b border-red-100 bg-red-50 px-4 py-2 text-xs font-medium text-red-700"
          }
        >
          {feedback.text}
        </div>
      )}

      <ul className="divide-y divide-gray-100">
        {members.map((m) => {
          const isSelf = m.id === currentUserId;
          return (
            <li key={m.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600">
                {initials(m.full_name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-gray-800">
                  {m.full_name ?? "Unnamed user"}
                  {isSelf && (
                    <span className="ml-2 text-xs font-normal text-gray-400">
                      (you)
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-gray-400 capitalize">
                  {m.role}
                </p>
              </div>
              {isSelf ? (
                <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium capitalize text-blue-700">
                  {m.role}
                </span>
              ) : (
                <div className="flex shrink-0 items-center gap-2">
                  <select
                    value={m.role}
                    disabled={isPending}
                    onChange={(e) =>
                      handleRoleChange(m, e.target.value as "admin" | "member")
                    }
                    className="rounded-lg border border-gray-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => handleRemove(m)}
                    disabled={isPending}
                    className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
