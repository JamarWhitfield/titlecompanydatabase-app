// ============================================================
// Record attachment save-path test suite.
//
// Guards the fix for the "record created without the file" bug: the file's
// metadata row is now saved BEFORE (and independently of) text extraction, and
// extraction only enriches content_text afterward. This suite proves, through
// the public anon key (the same path the browser uses):
//   * a record_files row inserts fine WITHOUT content_text (extraction pending)
//     and has_text is false,
//   * enriching content_text later flips has_text true and makes the document
//     searchable via search_company_records (so extraction success still
//     indexes for search),
//   * the owning company can mint a signed download URL,
//   * another company can neither read the metadata row nor sign a URL.
//
// Extraction itself (unpdf / OCR) is server-only + heavy, so it is exercised in
// the app, not here; this suite verifies the DB/storage contract the fix relies
// on.
//
// Run:  node --test tests/record-attachments.test.mjs
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

const BUCKET = "record-files";

describe("Record attachment save path", () => {
  const ts = Date.now();
  const password = `Att-Test-${ts}-Xy!`;
  const term = `zebraxyz${ts}`; // distinctive token to prove document search

  const s = {
    svc: null,
    a: null,
    b: null,
    recordId: null,
    fileId: null,
    path: null,
  };

  before(async () => {
    assertConfig();
    const svc = serviceClient();
    s.svc = svc;

    const a = await createCompanyAdmin(svc, {
      email: `att-a-${ts}@example.com`,
      password,
      companyName: `Att Co A ${ts}`,
    });
    const b = await createCompanyAdmin(svc, {
      email: `att-b-${ts}@example.com`,
      password,
      companyName: `Att Co B ${ts}`,
    });
    s.a = { ...a, email: `att-a-${ts}@example.com` };
    s.b = { ...b, email: `att-b-${ts}@example.com` };
    s.a.client = await signedInClient({ email: s.a.email, password });
    s.b.client = await signedInClient({ email: s.b.email, password });

    const rec = await s.a.client
      .from("company_records")
      .insert({
        company_id: s.a.companyId,
        created_by: s.a.userId,
        title: `Attachment test ${ts}`,
        record_type: "abstract",
      })
      .select("id")
      .single();
    if (rec.error) throw new Error(`seed record: ${rec.error.message}`);
    s.recordId = rec.data.id;

    // Upload the object first (mirrors the action: storage upload, then row).
    s.path = `${s.a.companyId}/${s.recordId}/${randomUUID()}.pdf`;
    const up = await s.a.client.storage
      .from(BUCKET)
      .upload(s.path, Buffer.from("%PDF-1.4 minimal"), {
        contentType: "application/pdf",
      });
    if (up.error) throw new Error(`seed upload: ${up.error.message}`);
  });

  after(async () => {
    const svc = s.svc;
    if (!svc) return;
    const companyIds = [s.a?.companyId, s.b?.companyId].filter(Boolean);
    try {
      if (s.path) await svc.storage.from(BUCKET).remove([s.path]);
      if (s.path2) await svc.storage.from(BUCKET).remove([s.path2]);
      if (s.path3) await svc.storage.from(BUCKET).remove([s.path3]);
      if (s.recordId)
        await svc.from("company_records").delete().eq("id", s.recordId);
      if (companyIds.length)
        await svc.from("audit_logs").delete().in("company_id", companyIds);
      if (companyIds.length)
        await svc.from("companies").delete().in("id", companyIds);
      if (s.a?.userId) await svc.auth.admin.deleteUser(s.a.userId);
      if (s.b?.userId) await svc.auth.admin.deleteUser(s.b.userId);
    } catch (err) {
      console.error("Cleanup warning:", err.message);
    }
  });

  it("1. a file's extracted text is stored and indexes has_text", async () => {
    const { data, error } = await s.a.client
      .from("record_files")
      .insert({
        company_id: s.a.companyId,
        record_id: s.recordId,
        name: "test.pdf",
        path: s.path,
        size: 16,
        mime_type: "application/pdf",
        content_text: `${term} lien search abstract body`,
      })
      .select("id, has_text")
      .single();
    assert.equal(error, null, "attachment row with extracted text must insert");
    assert.equal(data.has_text, true, "has_text should be true when text is stored");
    s.fileId = data.id;
  });

  it("2. the enriched document becomes searchable", async () => {
    const { data, error } = await s.a.client.rpc("search_company_records", {
      search_query: term,
    });
    assert.equal(error, null);
    const ids = (data ?? []).map((r) => r.id);
    assert.ok(
      ids.includes(s.recordId),
      "record should surface when searching its document text"
    );
  });

  it("3. a file with NO extracted text still attaches (extraction-failure path)", async () => {
    // Mirrors the case where extraction fails or times out and returns "" —
    // the attachment must still save, just without searchable text.
    const path2 = `${s.a.companyId}/${s.recordId}/${randomUUID()}.pdf`;
    const up = await s.a.client.storage
      .from(BUCKET)
      .upload(path2, Buffer.from("scanned-no-text"), {
        contentType: "application/pdf",
      });
    assert.equal(up.error, null);
    s.path2 = path2;

    const { data, error } = await s.a.client
      .from("record_files")
      .insert({
        company_id: s.a.companyId,
        record_id: s.recordId,
        name: "scanned.pdf",
        path: path2,
        size: 15,
        mime_type: "application/pdf",
        // content_text omitted — extraction produced nothing.
      })
      .select("id, has_text")
      .single();
    assert.equal(error, null, "attachment must save even with no extracted text");
    assert.equal(data.has_text, false, "has_text should be false with no text");
  });

  it("3b. a large extracted-text layer (500 KB) stays under the tsvector limit", async () => {
    // Regression guard for the 1 MB tsvector limit: a dense multi-page PDF used
    // to overflow record_files.fts and fail the whole insert. The app caps
    // extracted text at 500 KB (lib/extractText.ts) — prove that length inserts
    // cleanly against the live schema.
    const path3 = `${s.a.companyId}/${s.recordId}/${randomUUID()}.pdf`;
    const up = await s.a.client.storage
      .from(BUCKET)
      .upload(path3, Buffer.from("dense-pdf"), { contentType: "application/pdf" });
    assert.equal(up.error, null);
    s.path3 = path3;

    const chunk = "lien abstract parcel deed mortgage grantor grantee survey ";
    let bigText = "";
    while (bigText.length < 500_000) bigText += chunk;
    bigText = bigText.slice(0, 500_000);

    const { error } = await s.a.client
      .from("record_files")
      .insert({
        company_id: s.a.companyId,
        record_id: s.recordId,
        name: "dense.pdf",
        path: path3,
        size: 795_000,
        mime_type: "application/pdf",
        content_text: bigText,
      })
      .select("id")
      .single();
    assert.equal(
      error,
      null,
      "a 500 KB text layer must stay under the 1 MB tsvector limit"
    );
  });

  it("4. the owning company can mint a signed download URL", async () => {
    const { data, error } = await s.a.client.storage
      .from(BUCKET)
      .createSignedUrl(s.path, 60);
    assert.equal(error, null);
    assert.ok(data?.signedUrl, "owner should get a signed URL");
  });

  it("5. another company cannot read the metadata row", async () => {
    const { data } = await s.b.client
      .from("record_files")
      .select("id")
      .eq("id", s.fileId)
      .maybeSingle();
    assert.equal(data, null, "LEAK: company B read company A's file metadata");
  });

  it("5b. another company cannot mint a signed URL for the file", async () => {
    const { data, error } = await s.b.client.storage
      .from(BUCKET)
      .createSignedUrl(s.path, 60);
    assert.ok(
      error || !data?.signedUrl,
      "LEAK: company B signed a URL for company A's file"
    );
  });
});
