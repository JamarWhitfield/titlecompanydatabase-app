"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setCompanyBilling, type Plan } from "@/app/actions/platform-billing";

export type CompanyUsage = {
  id: string;
  name: string;
  slug: string;
  plan: Plan;
  storage_bytes: number;
  storage_limit_bytes: number | null;
  user_count: number;
  user_limit: number | null;
  record_count: number;
  record_limit: number | null;
  file_count: number;
};

const GB = 1024 ** 3;

const PLAN_LABELS: Record<Plan, string> = {
  trial: "Trial",
  starter: "Starter",
  growth: "Growth",
  enterprise: "Enterprise",
};

// Company-scale byte formatter (up to TB). Fed by SUM(record_files.size).
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

type Tone = "over" | "near" | "ok" | "none";

function tone(count: number, limit: number | null): Tone {
  if (limit == null) return "none";
  if (limit === 0) return count > 0 ? "over" : "ok";
  if (count > limit) return "over";
  if (count / limit >= 0.8) return "near";
  return "ok";
}

const TONE_TEXT: Record<Tone, string> = {
  over: "text-red-700",
  near: "text-amber-700",
  ok: "text-gray-700",
  none: "text-gray-400",
};

const TONE_BAR: Record<Tone, string> = {
  over: "bg-red-500",
  near: "bg-amber-500",
  ok: "bg-green-500",
  none: "bg-gray-300",
};

function pct(count: number, limit: number | null): number {
  if (!limit || limit <= 0) return count > 0 ? 100 : 0;
  return Math.min(100, Math.round((count / limit) * 100));
}

export default function UsageTable({
  rows,
  canEdit,
}: {
  rows: CompanyUsage[];
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState<CompanyUsage | null>(null);

  const totalStorage = rows.reduce((s, r) => s + r.storage_bytes, 0);
  const overCount = rows.filter(
    (r) =>
      tone(r.storage_bytes, r.storage_limit_bytes) === "over" ||
      tone(r.user_count, r.user_limit) === "over" ||
      tone(r.record_count, r.record_limit) === "over"
  ).length;

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Companies" value={String(rows.length)} />
        <SummaryCard label="Total storage" value={formatSize(totalStorage)} />
        <SummaryCard
          label="Over a limit"
          value={String(overCount)}
          tone={overCount > 0 ? "over" : "ok"}
        />
        <SummaryCard
          label="Total files"
          value={rows.reduce((s, r) => s + r.file_count, 0).toLocaleString()}
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Storage</th>
              <th className="px-4 py-3 text-right">Users</th>
              <th className="px-4 py-3 text-right">Records</th>
              <th className="px-4 py-3 text-right">Files</th>
              {canEdit && <th className="px-4 py-3 text-right">Limits</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r) => {
              const storageTone = tone(r.storage_bytes, r.storage_limit_bytes);
              return (
                <tr key={r.id} className="align-top hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{r.name}</div>
                    <div className="text-xs text-gray-400">{r.slug}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                      {PLAN_LABELS[r.plan]}
                    </span>
                  </td>
                  <td className="min-w-[180px] px-4 py-3">
                    <div className={`font-medium ${TONE_TEXT[storageTone]}`}>
                      {formatSize(r.storage_bytes)}
                      <span className="font-normal text-gray-400">
                        {" / "}
                        {r.storage_limit_bytes == null
                          ? "No limit"
                          : formatSize(r.storage_limit_bytes)}
                      </span>
                    </div>
                    {r.storage_limit_bytes != null && (
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                        <div
                          className={`h-full ${TONE_BAR[storageTone]}`}
                          style={{
                            width: `${pct(
                              r.storage_bytes,
                              r.storage_limit_bytes
                            )}%`,
                          }}
                        />
                      </div>
                    )}
                    {storageTone === "over" && (
                      <div className="mt-1 text-xs font-medium text-red-600">
                        Over by{" "}
                        {formatSize(
                          r.storage_bytes - (r.storage_limit_bytes ?? 0)
                        )}
                      </div>
                    )}
                  </td>
                  <MetricCell count={r.user_count} limit={r.user_limit} />
                  <MetricCell count={r.record_count} limit={r.record_limit} />
                  <td className="px-4 py-3 text-right text-gray-700">
                    {r.file_count.toLocaleString()}
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setEditing(r)}
                        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Edit
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <EditLimitsModal
          company={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone: t,
}: {
  label: string;
  value: string;
  tone?: "over" | "ok";
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-gray-400">
        {label}
      </div>
      <div
        className={`mt-1 text-xl font-semibold ${
          t === "over" ? "text-red-600" : "text-gray-900"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function MetricCell({
  count,
  limit,
}: {
  count: number;
  limit: number | null;
}) {
  const t = tone(count, limit);
  return (
    <td className="px-4 py-3 text-right">
      <span className={`font-medium ${TONE_TEXT[t]}`}>
        {count.toLocaleString()}
      </span>
      <span className="text-gray-400">
        {" / "}
        {limit == null ? "∞" : limit.toLocaleString()}
      </span>
      {t === "over" && limit != null && (
        <div className="text-xs font-medium text-red-600">
          +{(count - limit).toLocaleString()}
        </div>
      )}
    </td>
  );
}

function EditLimitsModal({
  company,
  onClose,
}: {
  company: CompanyUsage;
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [plan, setPlan] = useState<Plan>(company.plan);
  const [storageGb, setStorageGb] = useState(
    company.storage_limit_bytes == null
      ? ""
      : String(+(company.storage_limit_bytes / GB).toFixed(3))
  );
  const [userLimit, setUserLimit] = useState(
    company.user_limit == null ? "" : String(company.user_limit)
  );
  const [recordLimit, setRecordLimit] = useState(
    company.record_limit == null ? "" : String(company.record_limit)
  );

  function parseLimit(raw: string): number | null | undefined {
    const trimmed = raw.trim();
    if (trimmed === "") return null; // unlimited
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n < 0) return undefined; // invalid
    return Math.floor(n);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const users = parseLimit(userLimit);
    const records = parseLimit(recordLimit);
    const gbTrim = storageGb.trim();
    let storageBytes: number | null = null;
    if (gbTrim !== "") {
      const gb = Number(gbTrim);
      if (!Number.isFinite(gb) || gb < 0) {
        setError("Storage limit must be a non-negative number of GB.");
        return;
      }
      storageBytes = Math.round(gb * GB);
    }
    if (users === undefined || records === undefined) {
      setError("User and record limits must be whole, non-negative numbers.");
      return;
    }

    startTransition(async () => {
      const result = await setCompanyBilling({
        companyId: company.id,
        plan,
        storageLimitBytes: storageBytes,
        userLimit: users,
        recordLimit: records,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-gray-200 px-5 py-4">
          <h3 className="text-sm font-semibold text-gray-900">
            Plan &amp; limits — {company.name}
          </h3>
          <p className="mt-0.5 text-xs text-gray-500">
            Monitoring thresholds only. Leave a limit blank for unlimited.
            Nothing is billed or enforced.
          </p>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-4 px-5 py-4">
          {error && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-gray-700">Plan</span>
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value as Plan)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              {(Object.keys(PLAN_LABELS) as Plan[]).map((p) => (
                <option key={p} value={p}>
                  {PLAN_LABELS[p]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-gray-700">
              Storage limit (GB)
            </span>
            <input
              type="number"
              min="0"
              step="0.1"
              value={storageGb}
              onChange={(e) => setStorageGb(e.target.value)}
              placeholder="Unlimited"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-gray-700">User limit</span>
              <input
                type="number"
                min="0"
                step="1"
                value={userLimit}
                onChange={(e) => setUserLimit(e.target.value)}
                placeholder="Unlimited"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-gray-700">Record limit</span>
              <input
                type="number"
                min="0"
                step="1"
                value={recordLimit}
                onChange={(e) => setRecordLimit(e.target.value)}
                placeholder="Unlimited"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </label>
          </div>

          <div className="mt-1 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-60"
            >
              {isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
