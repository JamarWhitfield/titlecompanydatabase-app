import { notFound, redirect } from "next/navigation";
import { getProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import RecordDetail from "./RecordDetail";
import type { CompanyRecord, RecordFile } from "@/types/database";

// Keep the heavy full-text-search columns (fts / content_text) off the wire.
const RECORD_COLUMNS =
  "id, company_id, created_by, title, description, record_type, data, county, state, is_shared, shared_at, created_at, updated_at";

export default async function RecordDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const profile = await getProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();

  // RLS returns the row only if it belongs to the caller's company OR it is
  // shared to the network. A private record from another company yields no
  // row here, so the user simply gets a 404 — no data leak.
  const { data: record, error } = await supabase
    .from("company_records")
    .select(RECORD_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Failed to load record:", error.message);
  }
  if (!record) notFound();

  const typedRecord = record as CompanyRecord;
  const isOwn = typedRecord.company_id === profile.company_id;

  // Owning company name (companies are readable by any authenticated user).
  const { data: company } = await supabase
    .from("companies")
    .select("name")
    .eq("id", typedRecord.company_id)
    .maybeSingle();

  // Attachments — RLS allows own-company files or files of a shared record.
  const { data: fileRows, error: filesError } = await supabase
    .from("record_files")
    .select(
      "id, company_id, record_id, name, path, size, mime_type, has_text, created_at"
    )
    .eq("record_id", id)
    .order("created_at", { ascending: true });

  if (filesError) {
    console.error("Failed to load attachments:", filesError.message);
  }

  const files = (
    (fileRows as (RecordFile & { has_text?: boolean })[]) ?? []
  ).map(({ has_text, ...f }) => ({ ...f, indexed: has_text ?? false }));

  // Record-scoped audit trail. The RPC (0013) enforces its own permission
  // check: owning company always; other companies only for shared records.
  const { data: auditData, error: auditError } = await supabase.rpc(
    "get_record_audit_trail",
    { p_record_id: id }
  );
  if (auditError) {
    console.error("Failed to load audit trail:", auditError.message);
  }

  const auditTrail = (auditData ?? []).map((e) => ({
    id: e.id,
    action: e.action,
    actorName: e.actor_name,
    createdAt: e.created_at,
    detail: e.detail,
  }));

  // Internal notes — RLS restricts these to the caller's own company.
  const { data: noteRows, error: notesError } = await supabase
    .from("record_notes")
    .select("id, user_id, note_text, created_at, updated_at")
    .eq("record_id", id)
    .order("created_at", { ascending: true });

  if (notesError) {
    console.error("Failed to load notes:", notesError.message);
  }

  // Resolve note author names (same company, so profiles RLS allows it).
  const noteUserIds = [
    ...new Set((noteRows ?? []).map((n) => n.user_id).filter(Boolean)),
  ] as string[];
  const noteAuthorMap = new Map<string, string>();
  if (noteUserIds.length > 0) {
    const { data: authors } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", noteUserIds);
    for (const a of authors ?? []) {
      noteAuthorMap.set(a.id, a.full_name ?? "Unknown user");
    }
  }

  const notes = (noteRows ?? []).map((n) => ({
    id: n.id,
    userId: n.user_id,
    authorName: noteAuthorMap.get(n.user_id) ?? "Unknown user",
    text: n.note_text,
    createdAt: n.created_at,
    updatedAt: n.updated_at,
  }));

  return (
    <RecordDetail
      record={typedRecord}
      companyName={company?.name ?? "Unknown company"}
      files={files}
      isOwn={isOwn}
      auditTrail={auditTrail}
      notes={notes}
      currentUserId={profile.id}
      isAdmin={profile.role === "admin"}
    />
  );
}
