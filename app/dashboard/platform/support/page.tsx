import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/fileMeta";
import type { PlatformSupportSession } from "@/types/database";

export default async function PlatformSupportPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("platform_list_my_support_sessions");
  const sessions = (data ?? []) as PlatformSupportSession[];

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold text-gray-900">
        Support sessions
      </h2>
      <p className="mb-4 text-sm text-gray-500">
        Break-glass access is time-boxed and audited. Start a new session from a
        company&apos;s detail page.
      </p>

      {sessions.length === 0 ? (
        <p className="text-sm text-gray-500">
          You have no support sessions.{" "}
          <Link
            href="/dashboard/platform/companies"
            className="font-medium text-purple-700 hover:underline"
          >
            Browse companies
          </Link>
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
          {sessions.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between px-4 py-3"
            >
              <div className="min-w-0">
                <div className="font-medium text-gray-900">
                  {s.company_name}
                </div>
                <div className="truncate text-xs text-gray-500">
                  {s.reason}
                </div>
                <div className="text-xs text-gray-400">
                  Started {formatDate(s.created_at)}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {s.active ? (
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                    Active
                  </span>
                ) : (
                  <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">
                    Expired
                  </span>
                )}
                {s.active && (
                  <Link
                    href={`/dashboard/platform/support/${s.id}`}
                    className="text-sm font-medium text-purple-700 hover:underline"
                  >
                    Open
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
