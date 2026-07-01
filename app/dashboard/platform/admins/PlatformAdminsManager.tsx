"use client";

import { useState, useTransition } from "react";
import {
  addPlatformAdmin,
  setPlatformAdminRole,
  setPlatformAdminEnabled,
} from "@/app/actions/platform";
import type { PlatformRole } from "@/types/database";

type AdminRow = {
  user_id: string;
  email: string;
  full_name: string | null;
  role: PlatformRole;
  enabled: boolean;
  created_at: string;
};

const ROLES: PlatformRole[] = ["owner", "support", "auditor"];

export default function PlatformAdminsManager({
  admins,
  currentUserId,
}: {
  admins: AdminRow[];
  currentUserId: string;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<PlatformRole>("support");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function add() {
    setError(null);
    startTransition(async () => {
      const result = await addPlatformAdmin(email, role);
      if (result.error) setError(result.error);
      else setEmail("");
    });
  }

  function changeRole(userId: string, newRole: PlatformRole) {
    setError(null);
    startTransition(async () => {
      const result = await setPlatformAdminRole(userId, newRole);
      if (result.error) setError(result.error);
    });
  }

  function toggleEnabled(userId: string, enabled: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await setPlatformAdminEnabled(userId, enabled);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900">
          Grant platform access
        </h3>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-xs font-medium text-gray-600">
              User email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="operator@example.com"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as PlatformRole)}
              className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={add}
            disabled={pending || email.trim() === ""}
            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
          >
            Add
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          The user must already have a Title Network account.
        </p>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {admins.map((a) => {
              const isSelf = a.user_id === currentUserId;
              return (
                <tr key={a.user_id}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">
                      {a.full_name ?? a.email}
                    </div>
                    <div className="text-xs text-gray-400">{a.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={a.role}
                      disabled={pending}
                      onChange={(e) =>
                        changeRole(a.user_id, e.target.value as PlatformRole)
                      }
                      className="rounded-lg border border-gray-300 px-2 py-1 text-sm disabled:opacity-50"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    {a.enabled ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        Enabled
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">
                        <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                        Disabled
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => toggleEnabled(a.user_id, !a.enabled)}
                      disabled={pending || (isSelf && a.enabled)}
                      title={
                        isSelf && a.enabled
                          ? "You cannot disable your own access"
                          : undefined
                      }
                      className={`rounded px-2.5 py-1.5 text-xs font-medium disabled:opacity-40 ${
                        a.enabled
                          ? "text-red-600 hover:bg-red-50"
                          : "text-green-600 hover:bg-green-50"
                      }`}
                    >
                      {a.enabled ? "Disable" : "Enable"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
