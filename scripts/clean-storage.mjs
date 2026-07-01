// One-off maintenance script: remove Supabase Storage objects that do not
// belong to a company still present in the database.
//
// Storage layout in the `record-files` bucket is: {company_id}/{record_id}/{file}
// So the top-level folders are company ids. After running the SQL cleanup
// (which leaves only the company you want to keep), this deletes every
// storage folder that no longer maps to an existing company.
//
// Run AFTER the database cleanup, from the project root:
//   node --env-file=.env.local scripts/clean-storage.mjs
//
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the env.
// The service role key bypasses RLS — never expose it to the browser.

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = "record-files";

if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
      "Run with:  node --env-file=.env.local scripts/clean-storage.mjs"
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

// Company ids that should be kept (i.e. still exist in the database).
const { data: companies, error: companiesError } = await supabase
  .from("companies")
  .select("id");

if (companiesError) {
  console.error("Failed to read companies:", companiesError.message);
  process.exit(1);
}

const keep = new Set(companies.map((c) => c.id));
console.log(`Keeping storage for ${keep.size} company folder(s):`, [...keep]);

// Recursively collect every file path under a prefix. In Supabase Storage,
// folder entries have a null id/metadata; real files have populated metadata.
async function listAllFiles(prefix) {
  const results = [];
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(prefix, { limit: 1000 });
  if (error) throw new Error(`list "${prefix}" failed: ${error.message}`);

  for (const entry of data) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    const isFolder = entry.id === null || entry.metadata === null;
    if (isFolder) {
      results.push(...(await listAllFiles(path)));
    } else {
      results.push(path);
    }
  }
  return results;
}

// Top-level folders are company ids.
const { data: topLevel, error: topError } = await supabase.storage
  .from(BUCKET)
  .list("", { limit: 1000 });

if (topError) {
  console.error("Failed to list bucket root:", topError.message);
  process.exit(1);
}

const toRemove = [];
for (const entry of topLevel) {
  if (keep.has(entry.name)) continue; // this company still exists — leave it
  const files = await listAllFiles(entry.name);
  toRemove.push(...files);
}

if (toRemove.length === 0) {
  console.log("Nothing to remove — storage is already clean.");
  process.exit(0);
}

console.log(`Removing ${toRemove.length} orphaned object(s)…`);

// The Storage API caps removals per call, so delete in batches.
for (let i = 0; i < toRemove.length; i += 100) {
  const batch = toRemove.slice(i, i + 100);
  const { error } = await supabase.storage.from(BUCKET).remove(batch);
  if (error) {
    console.error("Remove failed:", error.message);
    process.exit(1);
  }
  console.log(`  removed ${Math.min(i + 100, toRemove.length)}/${toRemove.length}`);
}

console.log("Storage cleanup complete.");
