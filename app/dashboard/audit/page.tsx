import { redirect } from "next/navigation";
import { getProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import AuditLogList, { type AuditLogRow } from "./AuditLogList";
import type { Json } from "@/types/database";

const MAX_LOGS = 250;

// Safely read a string field from a JSONB snapshot (old_data / new_data).
function jsonField(value: Json | null, key: string): string | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const v = (value as Record<string, Json | undefined>)[key];
    return typeof v === "string" ? v : null;
  }
  return null;
}

export default async function AuditPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  // Admin-only: members are bounced back to the dashboard. RLS (0012) is the
  // database-level backstop — a non-admin would get zero rows regardless.
  if (profile.role !== "admin") redirect("/dashboard");

  const supabase = await createClient();

  // Company isolation: explicit company_id filter AND RLS both scope this to
  // the admin's own company. No other company's logs can ever be returned.
  const { data: logs, error } = await supabase
    .from("audit_logs")
    .select(
      "id, action, user_id, record_id, old_data, new_data, created_at"
    )
    .eq("company_id", profile.company_id)
    .order("created_at", { ascending: false })
    .limit(MAX_LOGS);

  if (error) {
    console.error("Failed to load audit logs:", error.message);
  }

  const rows = logs ?? [];

  // Resolve actor names (audit_logs.user_id -> profiles.full_name). The
  // profiles RLS already restricts this to the caller's own company.
  const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))] as string[];
  const userMap = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: people } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);
    for (const p of people ?? []) {
      userMap.set(p.id, p.full_name ?? "Unknown user");
    }
  }

  // Resolve parent-record titles for events whose snapshot lacks one
  // (e.g. attachment events store the file row, not the record).
  const recordIds = [
    ...new Set(rows.map((r) => r.record_id).filter(Boolean)),
  ] as string[];
  const titleMap = new Map<string, string>();
  if (recordIds.length > 0) {
    const { data: records } = await supabase
      .from("company_records")
      .select("id, title")
      .in("id", recordIds);
    for (const rec of records ?? []) {
      titleMap.set(rec.id, rec.title);
    }
  }

  const display: AuditLogRow[] = rows.map((r) => {
    const recordTitle =
      jsonField(r.new_data, "title") ??
      jsonField(r.old_data, "title") ??
      (r.record_id ? titleMap.get(r.record_id) ?? null : null);

    // Attachment events store the file row — surface the file name as detail.
    const fileName =
      jsonField(r.new_data, "name") ?? jsonField(r.old_data, "name");
    const recordType =
      jsonField(r.new_data, "record_type") ??
      jsonField(r.old_data, "record_type");

    const isAttachment = r.action.startsWith("ATTACHMENT");

    return {
      id: r.id,
      action: r.action,
      userName: r.user_id ? userMap.get(r.user_id) ?? "Unknown user" : "System",
      recordTitle,
      recordId: r.record_id,
      createdAt: r.created_at,
      detail: isAttachment ? fileName : recordType,
    };
  });

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Audit Logs
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Review important company record activity.
        </p>
      </div>

      <AuditLogList rows={display} />
    </div>
  );
}
