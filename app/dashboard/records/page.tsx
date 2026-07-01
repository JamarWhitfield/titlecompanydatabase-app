import { redirect } from "next/navigation";
import { getProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import RecordsList from "./RecordsList";
import type { CompanyRecordSearchResult, RecordFile } from "@/types/database";

// Explicit column lists keep the heavy full-text-search columns
// (company_records.fts, record_files.fts / content_text) off the wire.
// `has_text` is a cheap stored boolean used only to show the search-index
// status badge — the full extracted text is never sent to the client.
const RECORD_COLUMNS =
  "id, company_id, created_by, title, description, record_type, data, county, state, is_shared, shared_at, created_at, updated_at";
const FILE_COLUMNS =
  "id, company_id, record_id, name, path, size, mime_type, has_text, created_at";

const PAGE_SIZE = 20;

function parsePage(raw?: string): number {
  const n = Number.parseInt(raw ?? "1", 10);
  return Number.isFinite(n) && n > 1 ? n : 1;
}

export default async function RecordsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    type?: string;
    status?: string;
    state?: string;
    page?: string;
  }>;
}) {
  const sp = await searchParams;
  const query = sp.q?.trim() ?? "";
  const typeFilter = sp.type ?? "all";
  const statusFilter = sp.status ?? "all";
  const stateFilter = sp.state ?? "all";
  const page = parsePage(sp.page);

  const profile = await getProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // When searching, run the Postgres full-text search RPC (already scoped to
  // the caller's company_id). Otherwise list this company's own records only.
  //
  // SECURITY: "My Records" must show ONLY records owned by the current user's
  // company. RLS permits SELECT on (own company OR is_shared = TRUE), so an
  // unscoped select would also return every other company's *shared* records.
  // The search RPC scopes to get_my_company_id() and the list path adds an
  // explicit company_id filter; RLS remains the database-level backstop.
  //
  // PAGINATION: filters + LIMIT/OFFSET are applied at the query level (.eq /
  // .range), so the client never receives more than one page of rows.
  let recordsQuery = query
    ? supabase.rpc("search_company_records", { search_query: query }, {
        count: "exact",
      })
    : supabase
        .from("company_records")
        .select(RECORD_COLUMNS, { count: "exact" })
        .eq("company_id", profile.company_id);

  if (typeFilter !== "all") {
    recordsQuery = recordsQuery.eq("record_type", typeFilter);
  }
  if (statusFilter === "shared") {
    recordsQuery = recordsQuery.eq("is_shared", true);
  } else if (statusFilter === "private") {
    recordsQuery = recordsQuery.eq("is_shared", false);
  }
  if (stateFilter !== "all") {
    recordsQuery = recordsQuery.eq("state", stateFilter);
  }

  recordsQuery = query
    ? recordsQuery
        // Search path: order by full-text relevance (title > description >
        // location > document), newest-first as a stable tiebreak.
        .order("relevance_rank", { ascending: false })
        .order("created_at", { ascending: false })
        .range(from, to)
    : recordsQuery.order("created_at", { ascending: false }).range(from, to);

  // Distinct state options for the filter dropdown. Selects a single narrow
  // column (no description/data/fts), scoped to this company by RLS + the
  // explicit filter — cheap relative to fetching full rows.
  const statesQuery = supabase
    .from("company_records")
    .select("state")
    .eq("company_id", profile.company_id)
    .not("state", "is", null);

  const [recordsRes, statesRes] = await Promise.all([
    recordsQuery,
    statesQuery,
  ]);

  if (recordsRes.error) {
    console.error("Failed to load records:", recordsRes.error.message);
  }

  const records = (recordsRes.data as CompanyRecordSearchResult[]) ?? [];
  const totalCount = recordsRes.count ?? 0;

  const states = [
    ...new Set(
      ((statesRes.data as { state: string | null }[]) ?? [])
        .map((r) => r.state)
        .filter((s): s is string => Boolean(s))
    ),
  ].sort((a, b) => a.localeCompare(b));

  // Attachments only for the records on the current page.
  let files: RecordFile[] = [];
  if (records.length > 0) {
    const { data: fileRows, error: filesError } = await supabase
      .from("record_files")
      .select(FILE_COLUMNS)
      .eq("company_id", profile.company_id)
      .in(
        "record_id",
        records.map((r) => r.id)
      )
      .order("created_at", { ascending: true });

    if (filesError) {
      console.error("Failed to load attachments:", filesError.message);
    }

    files = ((fileRows as (RecordFile & { has_text?: boolean })[]) ?? []).map(
      ({ has_text, ...f }) => ({ ...f, indexed: has_text ?? false })
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">My Records</h1>
        <p className="mt-1 text-sm text-gray-500">
          {profile.companies?.name} &mdash; Records are private by default.
          Share individual records to make them visible to other companies on
          the network.
        </p>
      </div>

      <RecordsList
        records={records}
        files={files}
        states={states}
        initialQuery={query}
        typeFilter={typeFilter}
        statusFilter={statusFilter}
        stateFilter={stateFilter}
        page={page}
        pageSize={PAGE_SIZE}
        totalCount={totalCount}
      />
    </div>
  );
}

