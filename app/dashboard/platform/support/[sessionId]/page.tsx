import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/lib/platform-auth";
import { formatDate } from "@/lib/fileMeta";
import SupportBrowser from "./SupportBrowser";
import type { PlatformSupportSession } from "@/types/database";

export default async function SupportSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  await requirePlatformAdmin();

  const supabase = await createClient();
  const { data: sessionRows } = await supabase.rpc(
    "platform_get_support_session",
    { p_session_id: sessionId }
  );
  const session = sessionRows?.[0] as PlatformSupportSession | undefined;
  if (!session) notFound();

  // Expired sessions cannot browse data — send back to the session list.
  if (!session.active) {
    redirect("/dashboard/platform/support");
  }

  const { data: records } = await supabase.rpc(
    "platform_support_list_records",
    { p_session_id: sessionId }
  );

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
        <p className="text-sm font-semibold text-amber-900">
          Read-only support access · {session.company_name}
        </p>
        <p className="mt-1 text-xs text-amber-800">
          Reason: {session.reason}. Expires {formatDate(session.expires_at)}.
          Opening a record or downloading a file is recorded in the platform
          audit log. You cannot modify any tenant data.
        </p>
      </div>

      <SupportBrowser
        sessionId={sessionId}
        records={records ?? []}
      />
    </div>
  );
}
