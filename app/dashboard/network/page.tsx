import { redirect } from "next/navigation";
import Link from "next/link";
import { getProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import NetworkList from "./NetworkList";
import type { SharedRecord, RecordFile } from "@/types/database";

const PAGE_SIZE = 20;

function parsePage(raw?: string): number {
  const n = Number.parseInt(raw ?? "1", 10);
  return Number.isFinite(n) && n > 1 ? n : 1;
}

export default async function NetworkPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    type?: string;
    company?: string;
    state?: string;
    page?: string;
  }>;
}) {
  const sp = await searchParams;
  const query = sp.q?.trim() ?? "";
  const typeFilter = sp.type ?? "all";
  const companyFilter = sp.company ?? "all";
  const stateFilter = sp.state ?? "all";
  const page = parsePage(sp.page);

  const profile = await getProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // When searching, run the Postgres full-text search RPC (matches shared
  // record fields, owning company name, AND extracted file contents — all
  // still scoped by RLS to shared records only). Otherwise list the view.
  //
  // PAGINATION: filters + LIMIT/OFFSET are applied at the query level (.eq /
  // .range), so the client never receives more than one page of rows. RLS on
  // the underlying tables guarantees only shared records are ever returned —
  // private records from other companies are never fetched.
  let recordsQuery = query
    ? supabase.rpc("search_shared_records", { search_query: query }, {
        count: "exact",
      })
    : supabase
        .from("shared_records_network")
        .select("*", { count: "exact" });

  if (typeFilter !== "all") {
    recordsQuery = recordsQuery.eq("record_type", typeFilter);
  }
  if (companyFilter !== "all") {
    recordsQuery = recordsQuery.eq("company_id", companyFilter);
  }
  if (stateFilter !== "all") {
    recordsQuery = recordsQuery.eq("state", stateFilter);
  }

  recordsQuery = recordsQuery
    .order("shared_at", { ascending: false, nullsFirst: false })
    .range(from, to);

  // Distinct state + company options for the filter dropdowns. Selects only
  // narrow columns from the shared view (RLS-scoped to shared records).
  const optionsQuery = supabase
    .from("shared_records_network")
    .select("company_id, company_name, state");

  const [recordsRes, optionsRes] = await Promise.all([
    recordsQuery,
    optionsQuery,
  ]);

  if (recordsRes.error) {
    console.error("Failed to load shared network:", recordsRes.error.message);
  }

  const sharedRecords = (recordsRes.data as SharedRecord[]) ?? [];
  const totalCount = recordsRes.count ?? 0;

  const optionRows =
    (optionsRes.data as {
      company_id: string;
      company_name: string;
      state: string | null;
    }[]) ?? [];

  const states = [
    ...new Set(
      optionRows.map((r) => r.state).filter((s): s is string => Boolean(s))
    ),
  ].sort((a, b) => a.localeCompare(b));

  const companyMap = new Map<string, string>();
  for (const r of optionRows) {
    if (!companyMap.has(r.company_id)) {
      companyMap.set(r.company_id, r.company_name);
    }
  }
  const companies = [...companyMap.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Fetch file attachments only for the records on the current page. RLS only
  // returns files whose parent record is shared, so this is safe.
  const filesByRecord: Record<string, RecordFile[]> = {};
  if (sharedRecords.length > 0) {
    const { data: files, error: filesError } = await supabase
      .from("record_files")
      .select("id, company_id, record_id, name, path, size, mime_type, has_text, created_at")
      .in(
        "record_id",
        sharedRecords.map((r) => r.id)
      )
      .order("created_at", { ascending: true });

    if (filesError) {
      console.error("Failed to load shared files:", filesError.message);
    } else {
      for (const row of (files as (RecordFile & { has_text?: boolean })[]) ?? []) {
        const { has_text, ...file } = row;
        (filesByRecord[file.record_id] ??= []).push({
          ...file,
          indexed: has_text ?? false,
        });
      }
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Shared Network</h1>
        <p className="mt-1 text-sm text-gray-500">
          Records shared by all participating title companies. Read-only — manage
          your own shared records from{" "}
          <Link href="/dashboard/records" className="text-blue-600 hover:underline">
            My Records
          </Link>
          .
        </p>
      </div>

      <NetworkList
        records={sharedRecords}
        filesByRecord={filesByRecord}
        myCompanyId={profile.company_id}
        states={states}
        companies={companies}
        initialQuery={query}
        typeFilter={typeFilter}
        companyFilter={companyFilter}
        stateFilter={stateFilter}
        page={page}
        pageSize={PAGE_SIZE}
        totalCount={totalCount}
      />
    </div>
  );
}

