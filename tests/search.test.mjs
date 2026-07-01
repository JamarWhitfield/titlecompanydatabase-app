// ============================================================
// Full-text record search test suite.
//
// Exercises search_company_records() end-to-end through the public anon key
// (the same path the browser uses), proving:
//   - metadata matches (title / description / county+state)
//   - document matches (record_files.content_text — the column populated by
//     PDF / DOCX / TXT extraction on upload)
//   - match metadata (match_source, matched_file_name)
//   - relevance ranking (title > description > document)
//   - empty query lists records, gibberish returns nothing
//   - company isolation: Company A can never find Company B's private
//     document text, and vice versa.
//   - index numbers: partial / hyphenated / numeric codes found via
//     trigram ILIKE (the primary real-world search pattern for abstracts)
//
// content_text is inserted directly here: extraction (unpdf / mammoth /
// text) always funnels its output into that one column, so seeding it is a
// faithful stand-in for "a user uploaded a PDF/DOCX/TXT containing this text"
// and keeps the suite runnable under plain `node --test` (no native parsers).
//
// Run:  node --test tests/search.test.mjs
// ============================================================

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  assertConfig,
  serviceClient,
  createCompanyAdmin,
  signedInClient,
} from "./helpers.mjs";

describe("Full-text record search", () => {
  const ts = Date.now();
  const password = `Search-Test-${ts}-Xy!`;
  const emailA = `search-a-${ts}@example.com`;
  const emailB = `search-b-${ts}@example.com`;

  // A unique token stamped into every seeded row so the suite only ever sees
  // its own data, regardless of what else lives in the database.
  const TAG = `zqx${ts}`;

  const s = {
    svc: null,
    userAId: null,
    userBId: null,
    companyA: null,
    companyB: null,
    clientA: null,
    clientB: null,
    recTitle: null, // matches in TITLE
    recDesc: null, // matches in DESCRIPTION
    recLoc: null, // matches in COUNTY/STATE
    recPdf: null, // matches inside a .pdf document
    recDocx: null, // matches inside a .docx document
    recTxt: null, // matches inside a .txt document
    recBSecret: null, // Company B private record with secret document text
    // Index-number search records — realistic abstract document content.
    recIndexFull: null,    // abstract with a deed index number (full match)
    recIndexPartial: null, // abstract matched by the numeric suffix only
    recIndexHyphen: null,  // abstract matched by hyphenated APN-style code
    indexNumber: null,
    indexSuffix: null,
    apnCode: null,
  };

  const insertRecord = async (client, companyId, userId, fields) => {
    const { data, error } = await client
      .from("company_records")
      .insert({
        company_id: companyId,
        created_by: userId,
        record_type: "abstract",
        ...fields,
      })
      .select("id")
      .single();
    if (error) throw new Error(`seed record failed: ${error.message}`);
    return data.id;
  };

  const insertFile = async (client, companyId, recordId, name, contentText) => {
    const ext = name.split(".").pop();
    const { data, error } = await client
      .from("record_files")
      .insert({
        company_id: companyId,
        record_id: recordId,
        name,
        path: `${companyId}/${recordId}/${randomUUID()}.${ext}`,
        size: 2048,
        mime_type: "application/octet-stream",
        content_text: contentText,
      })
      .select("id")
      .single();
    if (error) throw new Error(`seed file failed: ${error.message}`);
    return data.id;
  };

  before(async () => {
    assertConfig();
    const svc = serviceClient();
    s.svc = svc;

    const a = await createCompanyAdmin(svc, {
      email: emailA,
      password,
      companyName: `Search Co A ${ts}`,
    });
    s.userAId = a.userId;
    s.companyA = a.companyId;

    const b = await createCompanyAdmin(svc, {
      email: emailB,
      password,
      companyName: `Search Co B ${ts}`,
    });
    s.userBId = b.userId;
    s.companyB = b.companyId;

    s.clientA = await signedInClient({ email: emailA, password });
    s.clientB = await signedInClient({ email: emailB, password });

    // --- Company A: one record per match source ---
    s.recTitle = await insertRecord(s.clientA, s.companyA, s.userAId, {
      title: `Titlematch ${TAG}`,
      description: "nothing relevant here",
    });
    s.recDesc = await insertRecord(s.clientA, s.companyA, s.userAId, {
      title: "Plain record",
      description: `A description containing ${TAG} keyword`,
    });
    s.recLoc = await insertRecord(s.clientA, s.companyA, s.userAId, {
      title: "Located record",
      county: `${TAG}county`,
      state: "Florida",
    });
    s.recPdf = await insertRecord(s.clientA, s.companyA, s.userAId, {
      title: "Record with a PDF",
    });
    await insertFile(
      s.clientA,
      s.companyA,
      s.recPdf,
      "closing_documents.pdf",
      `This PDF body mentions ${TAG} deep inside the closing paperwork.`
    );
    s.recDocx = await insertRecord(s.clientA, s.companyA, s.userAId, {
      title: "Record with a DOCX",
    });
    await insertFile(
      s.clientA,
      s.companyA,
      s.recDocx,
      "agreement.docx",
      `The Word document text references ${TAG} in a clause.`
    );
    s.recTxt = await insertRecord(s.clientA, s.companyA, s.userAId, {
      title: "Record with a TXT",
    });
    await insertFile(
      s.clientA,
      s.companyA,
      s.recTxt,
      "notes.txt",
      `Plain text notes: ${TAG} appears here.`
    );

    // --- Company B: a private record whose DOCUMENT text holds a secret ---
    const secret = `bsecret${ts}`;
    s.bSecretToken = secret;
    s.recBSecret = await insertRecord(s.clientB, s.companyB, s.userBId, {
      title: "B private",
      is_shared: false,
    });
    await insertFile(
      s.clientB,
      s.companyB,
      s.recBSecret,
      "confidential.pdf",
      `Company B confidential document containing ${secret}.`
    );

    // --- Index-number records: realistic abstract document content ---
    // Full deed index number, e.g. "2024-001234"
    s.indexNumber = `2024-${ts.toString().slice(-6)}`;
    s.recIndexFull = await insertRecord(s.clientA, s.companyA, s.userAId, {
      title: "Deed of Trust",
    });
    await insertFile(
      s.clientA,
      s.companyA,
      s.recIndexFull,
      "deed_abstract.pdf",
      `ABSTRACT OF TITLE\nInstrument No: ${s.indexNumber}\nGrantor: John Smith\nGrantee: Jane Smith\nCounty: Broward`
    );

    // Partial suffix match — user types just the numeric part
    s.indexSuffix = s.indexNumber.split("-")[1]; // e.g. "001234"
    s.recIndexPartial = await insertRecord(s.clientA, s.companyA, s.userAId, {
      title: "Warranty Deed",
    });
    await insertFile(
      s.clientA,
      s.companyA,
      s.recIndexPartial,
      "warranty_deed.pdf",
      `Document Index: DOC-${s.indexSuffix} | Filed: 2024-01-15 | Book 1234 Page 56`
    );

    // Hyphenated APN-style parcel number
    s.apnCode = `APN-${ts.toString().slice(-4)}-${ts.toString().slice(-3)}`;
    s.recIndexHyphen = await insertRecord(s.clientA, s.companyA, s.userAId, {
      title: "Lien Search Report",
    });
    await insertFile(
      s.clientA,
      s.companyA,
      s.recIndexHyphen,
      "lien_search.pdf",
      `LIEN SEARCH RESULTS\nParcel ID: ${s.apnCode}\nNo liens found as of search date.`
    );
  });

  after(async () => {
    const svc = s.svc;
    if (!svc) return;
    const ids = [
      s.recTitle,
      s.recDesc,
      s.recLoc,
      s.recPdf,
      s.recDocx,
      s.recTxt,
      s.recBSecret,
      s.recIndexFull,
      s.recIndexPartial,
      s.recIndexHyphen,
    ].filter(Boolean);
    const companies = [s.companyA, s.companyB].filter(Boolean);
    try {
      if (ids.length) await svc.from("record_files").delete().in("record_id", ids);
      if (ids.length) await svc.from("company_records").delete().in("id", ids);
      if (companies.length)
        await svc.from("audit_logs").delete().in("company_id", companies);
      if (companies.length)
        await svc.from("companies").delete().in("id", companies);
      if (s.userAId) await svc.auth.admin.deleteUser(s.userAId);
      if (s.userBId) await svc.auth.admin.deleteUser(s.userBId);
    } catch (err) {
      console.error("Cleanup warning:", err.message);
    }
  });

  // Run the RPC as a signed-in client and return its rows.
  const search = async (client, query) => {
    const { data, error } = await client.rpc("search_company_records", {
      search_query: query,
    });
    if (error) throw new Error(`search failed: ${error.message}`);
    return data;
  };

  const byId = (rows, id) => rows.find((r) => r.id === id);

  it("1. finds a record by TITLE and labels the match source", async () => {
    const rows = await search(s.clientA, TAG);
    const hit = byId(rows, s.recTitle);
    assert.ok(hit, "title record should be returned");
    assert.equal(hit.match_source, "title");
  });

  it("2. finds a record by DESCRIPTION", async () => {
    const rows = await search(s.clientA, TAG);
    const hit = byId(rows, s.recDesc);
    assert.ok(hit, "description record should be returned");
    assert.equal(hit.match_source, "description");
  });

  it("3. finds a record by COUNTY/STATE location", async () => {
    const rows = await search(s.clientA, `${TAG}county`);
    const hit = byId(rows, s.recLoc);
    assert.ok(hit, "location record should be returned");
    assert.equal(hit.match_source, "location");
  });

  it("4. finds a record by text inside a PDF and names the file", async () => {
    const rows = await search(s.clientA, TAG);
    const hit = byId(rows, s.recPdf);
    assert.ok(hit, "PDF-content record should be returned");
    assert.equal(hit.match_source, "document");
    assert.equal(hit.matched_file_name, "closing_documents.pdf");
  });

  it("5. finds a record by text inside a DOCX", async () => {
    const rows = await search(s.clientA, TAG);
    const hit = byId(rows, s.recDocx);
    assert.ok(hit, "DOCX-content record should be returned");
    assert.equal(hit.match_source, "document");
    assert.equal(hit.matched_file_name, "agreement.docx");
  });

  it("6. finds a record by text inside a TXT", async () => {
    const rows = await search(s.clientA, TAG);
    const hit = byId(rows, s.recTxt);
    assert.ok(hit, "TXT-content record should be returned");
    assert.equal(hit.match_source, "document");
    assert.equal(hit.matched_file_name, "notes.txt");
  });

  it("7. returns nothing for a query that matches no record", async () => {
    const rows = await search(s.clientA, `nomatch${ts}zzz`);
    assert.equal(rows.length, 0);
  });

  it("8. ranks title matches above document-only matches", async () => {
    const rows = await search(s.clientA, TAG);
    const posTitle = rows.findIndex((r) => r.id === s.recTitle);
    const posPdf = rows.findIndex((r) => r.id === s.recPdf);
    assert.ok(posTitle !== -1 && posPdf !== -1, "both records present");
    assert.ok(
      posTitle < posPdf,
      "title match should rank before a document-only match"
    );
    // And ranks are ordered descending.
    assert.ok(rows[posTitle].relevance_rank >= rows[posPdf].relevance_rank);
  });

  it("9. an empty query lists the company's records (browse mode)", async () => {
    const rows = await search(s.clientA, "");
    assert.ok(rows.length >= 6, "all six Company A records should list");
    // Browse mode carries no match explanation.
    assert.equal(rows[0].match_source, null);
  });

  it("10. Company A cannot find Company B's private document text", async () => {
    const rows = await search(s.clientA, s.bSecretToken);
    assert.equal(
      rows.length,
      0,
      "LEAK: Company A found Company B's private document contents"
    );
  });

  it("11. Company B cannot find Company A's document text", async () => {
    const rows = await search(s.clientB, TAG);
    assert.equal(
      rows.length,
      0,
      "LEAK: Company B found Company A's document/metadata contents"
    );
  });

  it("12. Company B CAN find its own private document text", async () => {
    const rows = await search(s.clientB, s.bSecretToken);
    const hit = byId(rows, s.recBSecret);
    assert.ok(hit, "B should find its own document match");
    assert.equal(hit.match_source, "document");
    assert.equal(hit.matched_file_name, "confidential.pdf");
  });

  // ── Index-number tests (trigram ILIKE path) ─────────────────────────────

  it("13. finds an abstract by its full deed index number", async () => {
    const rows = await search(s.clientA, s.indexNumber);
    const hit = byId(rows, s.recIndexFull);
    assert.ok(hit, `should find record containing index number ${s.indexNumber}`);
    assert.equal(hit.match_source, "document");
    assert.equal(hit.matched_file_name, "deed_abstract.pdf");
  });

  it("14. finds an abstract by the numeric suffix of the index number (partial match)", async () => {
    // User types only the trailing digits, e.g. '001234' not '2024-001234'.
    // FTS cannot do this; trigram ILIKE handles it correctly.
    const rows = await search(s.clientA, s.indexSuffix);
    const hit = byId(rows, s.recIndexPartial);
    assert.ok(
      hit,
      `partial suffix '${s.indexSuffix}' should match the document containing DOC-${s.indexSuffix}`
    );
    assert.equal(hit.match_source, "document");
  });

  it("15. finds an abstract by a hyphenated APN-style parcel number", async () => {
    const rows = await search(s.clientA, s.apnCode);
    const hit = byId(rows, s.recIndexHyphen);
    assert.ok(hit, `APN-style code '${s.apnCode}' should be found in lien_search.pdf`);
    assert.equal(hit.match_source, "document");
    assert.equal(hit.matched_file_name, "lien_search.pdf");
  });

  it("16. partial APN search (last segment only) also finds the record", async () => {
    // Simulate a user typing just the last 3-digit segment of the APN.
    const segment = s.apnCode.split("-").pop(); // e.g. '234'
    const rows = await search(s.clientA, segment);
    const hit = byId(rows, s.recIndexHyphen);
    assert.ok(
      hit,
      `last segment '${segment}' of APN should still locate the abstract`
    );
  });
});
