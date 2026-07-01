// ============================================================
// Automated RLS / company-isolation test suite.
//
// Proves that PRIVATE company records never leak across companies and that
// shared records are read-only to other companies — enforced by Supabase
// Row Level Security, exercised here through the public anon key (the same
// path the browser uses). The suite FAILS LOUDLY if a private record leaks.
//
// Run:  npm run test:rls      (or: node --test tests/rls-isolation.test.mjs)
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

describe("RLS company isolation", () => {
  const ts = Date.now();
  const password = `Rls-Test-${ts}-Xy!`;
  const emailA = `rls-a-${ts}@example.com`;
  const emailB = `rls-b-${ts}@example.com`;

  // Shared state seeded in before(), cleaned up in after().
  const s = {
    svc: null,
    userAId: null,
    userBId: null,
    companyA: null,
    companyB: null,
    a1: null, // Company A private record
    a2: null, // Company A shared record
    b1: null, // Company B private record
    fileA1: null, // attachment on the private record
    fileA2: null, // attachment on the shared record
    clientA: null,
    clientB: null,
  };

  before(async () => {
    assertConfig();
    const svc = serviceClient();
    s.svc = svc;

    // --- Two isolated companies, each with one admin user ---
    const a = await createCompanyAdmin(svc, {
      email: emailA,
      password,
      companyName: `RLS Co A ${ts}`,
    });
    s.userAId = a.userId;
    s.companyA = a.companyId;

    const b = await createCompanyAdmin(svc, {
      email: emailB,
      password,
      companyName: `RLS Co B ${ts}`,
    });
    s.userBId = b.userId;
    s.companyB = b.companyId;

    s.clientA = await signedInClient({ email: emailA, password });
    s.clientB = await signedInClient({ email: emailB, password });

    // --- Seed records AS the owning user (so RLS INSERT is exercised too) ---
    const insertRecord = async (client, companyId, userId, title, isShared) => {
      const { data, error } = await client
        .from("company_records")
        .insert({
          company_id: companyId,
          created_by: userId,
          title,
          record_type: "abstract",
          is_shared: isShared,
        })
        .select("id")
        .single();
      if (error) throw new Error(`seed "${title}" failed: ${error.message}`);
      return data.id;
    };

    s.a1 = await insertRecord(s.clientA, s.companyA, s.userAId, "A1 Private", false);
    s.a2 = await insertRecord(s.clientA, s.companyA, s.userAId, "A2 Shared", true);
    s.b1 = await insertRecord(s.clientB, s.companyB, s.userBId, "B1 Private", false);

    // --- Seed one attachment on each Company A record (metadata rows) ---
    const insertFile = async (recordId) => {
      const { data, error } = await s.clientA
        .from("record_files")
        .insert({
          company_id: s.companyA,
          record_id: recordId,
          name: "doc.pdf",
          path: `${s.companyA}/${recordId}/${randomUUID()}.pdf`,
          size: 1024,
          mime_type: "application/pdf",
        })
        .select("id")
        .single();
      if (error) throw new Error(`seed file failed: ${error.message}`);
      return data.id;
    };

    s.fileA1 = await insertFile(s.a1); // attachment on PRIVATE record
    s.fileA2 = await insertFile(s.a2); // attachment on SHARED record
  });

  after(async () => {
    const svc = s.svc;
    if (!svc) return;
    // Order matters: remove children + audit rows before companies/users,
    // because audit_logs.company_id / user_id have no ON DELETE CASCADE.
    const ids = [s.a1, s.a2, s.b1].filter(Boolean);
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

  // Helper: does a signed-in client see a given record id?
  const canSeeRecord = async (client, id) => {
    const { data, error } = await client
      .from("company_records")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data !== null;
  };

  // 1. Company A user can see Company A private records.
  it("1. A sees A's private record", async () => {
    assert.equal(await canSeeRecord(s.clientA, s.a1), true);
  });

  // 2. Company A user can see Company A shared records.
  it("2. A sees A's shared record", async () => {
    assert.equal(await canSeeRecord(s.clientA, s.a2), true);
  });

  // 3. Company A user cannot see Company B private records.
  it("3. A cannot see B's private record", async () => {
    assert.equal(
      await canSeeRecord(s.clientA, s.b1),
      false,
      "LEAK: Company A can see Company B's private record"
    );
  });

  // 4. Company B user can see Company B private records.
  it("4. B sees B's private record", async () => {
    assert.equal(await canSeeRecord(s.clientB, s.b1), true);
  });

  // 5. Company B user cannot see Company A private records.  (critical)
  it("5. B cannot see A's private record", async () => {
    assert.equal(
      await canSeeRecord(s.clientB, s.a1),
      false,
      "LEAK: Company B can see Company A's private record"
    );
  });

  // Generalized leak check: a blanket select as B returns B1 + A2, never A1.
  it("5b. B's full record list excludes every private foreign record", async () => {
    const { data, error } = await s.clientB
      .from("company_records")
      .select("id, is_shared, company_id");
    assert.equal(error, null);
    const visibleIds = data.map((r) => r.id);
    assert.ok(visibleIds.includes(s.b1), "B should see its own private record");
    assert.ok(visibleIds.includes(s.a2), "B should see A's shared record");
    assert.ok(
      !visibleIds.includes(s.a1),
      "LEAK: A's private record appears in Company B's record list"
    );
    // Any foreign-company row that is visible MUST be shared.
    for (const row of data) {
      if (row.company_id !== s.companyB) {
        assert.equal(
          row.is_shared,
          true,
          "LEAK: a non-shared foreign record is visible to Company B"
        );
      }
    }
  });

  // 6. Company B can see Company A's shared record in the Shared Network.
  it("6. B sees A's shared record in the network (and not the private one)", async () => {
    const { data, error } = await s.clientB
      .from("shared_records_network")
      .select("id");
    assert.equal(error, null);
    const ids = data.map((r) => r.id);
    assert.ok(ids.includes(s.a2), "B should see A's shared record in the network");
    assert.ok(
      !ids.includes(s.a1),
      "LEAK: A's private record is exposed in the shared network"
    );
  });

  // 7. Company B cannot edit Company A's shared record.
  it("7. B cannot edit A's shared record", async () => {
    const { data } = await s.clientB
      .from("company_records")
      .update({ title: "HACKED BY B" })
      .eq("id", s.a2)
      .select("id");
    assert.equal((data ?? []).length, 0, "RLS should block the update (0 rows)");

    const { data: check } = await s.svc
      .from("company_records")
      .select("title")
      .eq("id", s.a2)
      .single();
    assert.equal(check.title, "A2 Shared", "Title must be unchanged");
  });

  // 8. Company B cannot delete Company A's shared record.
  it("8. B cannot delete A's shared record", async () => {
    const { data } = await s.clientB
      .from("company_records")
      .delete()
      .eq("id", s.a2)
      .select("id");
    assert.equal((data ?? []).length, 0, "RLS should block the delete (0 rows)");

    const { data: check } = await s.svc
      .from("company_records")
      .select("id")
      .eq("id", s.a2)
      .maybeSingle();
    assert.notEqual(check, null, "Record must still exist");
  });

  // 9. Company B cannot unshare Company A's shared record.
  it("9. B cannot unshare A's shared record", async () => {
    const { data } = await s.clientB
      .from("company_records")
      .update({ is_shared: false })
      .eq("id", s.a2)
      .select("id");
    assert.equal((data ?? []).length, 0, "RLS should block the unshare (0 rows)");

    const { data: check } = await s.svc
      .from("company_records")
      .select("is_shared")
      .eq("id", s.a2)
      .single();
    assert.equal(check.is_shared, true, "Record must remain shared");
  });

  // 10. Company B cannot access Company A's private record by direct URL.
  //     The detail page runs exactly this query; RLS returns no row -> 404.
  it("10. B cannot load A's private record by id (direct URL)", async () => {
    const { data, error } = await s.clientB
      .from("company_records")
      .select("*")
      .eq("id", s.a1)
      .maybeSingle();
    assert.equal(error, null);
    assert.equal(
      data,
      null,
      "LEAK: direct id lookup returned Company A's private record to Company B"
    );
  });

  // 11. Attachments follow the same visibility rules as their parent record.
  it("11. B sees the shared record's attachment but not the private one's", async () => {
    const seesFile = async (client, fileId) => {
      const { data, error } = await client
        .from("record_files")
        .select("id")
        .eq("id", fileId)
        .maybeSingle();
      if (error) throw error;
      return data !== null;
    };

    // Owner sees both of its own files.
    assert.equal(await seesFile(s.clientA, s.fileA1), true);
    assert.equal(await seesFile(s.clientA, s.fileA2), true);

    // B may see the attachment of the SHARED record...
    assert.equal(
      await seesFile(s.clientB, s.fileA2),
      true,
      "B should see attachments of a shared record"
    );
    // ...but NOT the attachment of the PRIVATE record.
    assert.equal(
      await seesFile(s.clientB, s.fileA1),
      false,
      "LEAK: Company B can see an attachment on Company A's private record"
    );
  });
});
