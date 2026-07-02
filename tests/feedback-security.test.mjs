// ============================================================
// Feedback system — security / RLS / permission test suite.
//
// Proves the "Send Feedback" feature (migrations 0028–0030) does NOT weaken
// Casetra's tenant isolation or platform-admin trust boundary:
//   * a normal user may submit feedback only for their OWN company + as
//     themselves (no company/reporter spoofing),
//   * a normal user may read only their OWN reports (never another company's),
//   * a normal user may NOT update status, insert status history, or add/read
//     internal notes,
//   * the platform read RPCs (platform_list_feedback / _get_feedback /
//     _history / _notes) reject non-platform callers,
//   * a platform admin can read all reports, update status, and add notes,
//   * screenshots live in a PRIVATE bucket: no anon/public read, no signed URL
//     for normal users; only the service role (the platform-admin path) can
//     mint one,
//   * the enum CHECK constraints reject invalid feedback_type / severity /
//     category / status.
//
// Everything user-facing runs through the public anon key (the same path the
// browser uses), so RLS + SECURITY DEFINER guards are exercised for real.
// The service role is used ONLY for setup/teardown and to model the trusted
// server-side signing path.
//
// Run:  node --test tests/feedback-security.test.mjs
// ============================================================

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  assertConfig,
  serviceClient,
  anonClient,
  createCompanyAdmin,
  signedInClient,
} from "./helpers.mjs";

const SCREENSHOT_BUCKET = "feedback-screenshots";

describe("Feedback security & RLS", () => {
  const ts = Date.now();
  const password = `Fb-Test-${ts}-Xy!`;

  const s = {
    svc: null,
    // company A (reporter), company B (other tenant), platform owner
    userA: null,
    userB: null,
    owner: null,
    reportA: null, // report submitted by user A
    reportB: null, // report submitted by user B
    screenshotPath: null,
  };

  const email = (label) => `fb-${label}-${ts}@example.com`;

  async function insertFeedback(client, { companyId, reporterId, title }) {
    return client
      .from("feedback_reports")
      .insert({
        company_id: companyId,
        reporter_id: reporterId,
        feedback_type: "bug",
        category: "general",
        severity: "low",
        status: "open",
        title,
        description: "Automated test feedback body.",
      })
      .select("id, company_id, reporter_id, status")
      .single();
  }

  before(async () => {
    assertConfig();
    const svc = serviceClient();
    s.svc = svc;

    const a = await createCompanyAdmin(svc, {
      email: email("a"),
      password,
      companyName: `FB Co A ${ts}`,
    });
    const b = await createCompanyAdmin(svc, {
      email: email("b"),
      password,
      companyName: `FB Co B ${ts}`,
    });
    const owner = await createCompanyAdmin(svc, {
      email: email("owner"),
      password,
      companyName: `FB Platform ${ts}`,
    });

    s.userA = { ...a, email: email("a") };
    s.userB = { ...b, email: email("b") };
    s.owner = { ...owner, email: email("owner") };

    // Grant the owner an ENABLED platform role (service role bypasses RLS).
    await svc
      .from("platform_admins")
      .insert({ user_id: owner.userId, role: "owner", enabled: true });

    // Sign everyone in through the anon key (browser-equivalent).
    s.userA.client = await signedInClient({ email: s.userA.email, password });
    s.userB.client = await signedInClient({ email: s.userB.email, password });
    s.owner.client = await signedInClient({ email: s.owner.email, password });

    // Seed one report per company, each submitted by its own user.
    const ra = await insertFeedback(s.userA.client, {
      companyId: s.userA.companyId,
      reporterId: s.userA.userId,
      title: "A report",
    });
    if (ra.error) throw new Error(`seed report A: ${ra.error.message}`);
    s.reportA = ra.data.id;

    const rb = await insertFeedback(s.userB.client, {
      companyId: s.userB.companyId,
      reporterId: s.userB.userId,
      title: "B report",
    });
    if (rb.error) throw new Error(`seed report B: ${rb.error.message}`);
    s.reportB = rb.data.id;
  });

  after(async () => {
    const svc = s.svc;
    if (!svc) return;
    const userIds = [s.userA, s.userB, s.owner]
      .filter(Boolean)
      .map((u) => u.userId);
    const companyIds = [s.userA, s.userB, s.owner]
      .filter(Boolean)
      .map((u) => u.companyId);
    try {
      if (s.screenshotPath) {
        await svc.storage.from(SCREENSHOT_BUCKET).remove([s.screenshotPath]);
      }
      // feedback_status_history + feedback_internal_notes cascade from reports.
      await svc.from("feedback_reports").delete().in("reporter_id", userIds);
      await svc.from("platform_admins").delete().in("user_id", userIds);
      if (companyIds.length) {
        await svc.from("audit_logs").delete().in("company_id", companyIds);
        await svc.from("companies").delete().in("id", companyIds);
      }
      for (const id of userIds) await svc.auth.admin.deleteUser(id);
    } catch (err) {
      console.error("Cleanup warning:", err.message);
    }
  });

  // ── Test 1: normal user submits feedback for their own company ──────
  it("1. submission stores the caller's real company + reporter", async () => {
    const { data, error } = await s.userA.client
      .from("feedback_reports")
      .select("company_id, reporter_id")
      .eq("id", s.reportA)
      .single();
    assert.equal(error, null);
    assert.equal(data.company_id, s.userA.companyId);
    assert.equal(data.reporter_id, s.userA.userId);
  });

  // ── Test 2: company-id spoofing is rejected ─────────────────────────
  it("2a. cannot submit feedback under another company's id", async () => {
    const { data, error } = await insertFeedback(s.userA.client, {
      companyId: s.userB.companyId, // forged
      reporterId: s.userA.userId,
      title: "spoofed company",
    });
    assert.ok(error, "expected RLS to reject a forged company_id");
    assert.equal(data, null);
  });

  it("2b. cannot submit feedback as another user (reporter spoof)", async () => {
    const { data, error } = await insertFeedback(s.userA.client, {
      companyId: s.userA.companyId,
      reporterId: s.userB.userId, // forged
      title: "spoofed reporter",
    });
    assert.ok(error, "expected RLS to reject a forged reporter_id");
    assert.equal(data, null);
  });

  // ── Test 8: normal user cannot read another company's report ────────
  it("8. A cannot read B's report by id", async () => {
    const { data } = await s.userA.client
      .from("feedback_reports")
      .select("id")
      .eq("id", s.reportB)
      .maybeSingle();
    assert.equal(data, null, "LEAK: A can read B's feedback report");
  });

  it("8b. A's full report list contains only A's own reports", async () => {
    const { data, error } = await s.userA.client
      .from("feedback_reports")
      .select("id, reporter_id");
    assert.equal(error, null);
    for (const row of data) {
      assert.equal(
        row.reporter_id,
        s.userA.userId,
        "LEAK: a foreign report appears in A's list"
      );
    }
    assert.ok(data.some((r) => r.id === s.reportA));
  });

  it("8c. anonymous (signed-out) users see no reports", async () => {
    const { data } = await anonClient()
      .from("feedback_reports")
      .select("id");
    assert.equal((data ?? []).length, 0);
  });

  // ── Test 5: normal user cannot update status ────────────────────────
  it("5. A cannot update a report's status", async () => {
    const { data } = await s.userA.client
      .from("feedback_reports")
      .update({ status: "fixed" })
      .eq("id", s.reportA)
      .select("id");
    assert.equal((data ?? []).length, 0, "update should affect 0 rows");

    const { data: after } = await s.userA.client
      .from("feedback_reports")
      .select("status")
      .eq("id", s.reportA)
      .single();
    assert.equal(after.status, "open", "status must be unchanged");
  });

  // ── Test 5b: normal user cannot insert fake status history ──────────
  it("5b. A cannot insert status history directly", async () => {
    const { data, error } = await s.userA.client
      .from("feedback_status_history")
      .insert({
        feedback_report_id: s.reportA,
        changed_by: s.userA.userId,
        old_status: "open",
        new_status: "fixed",
      })
      .select("id");
    assert.ok(error || (data ?? []).length === 0, "history insert must fail");
  });

  it("5c. A may read status history of their OWN report (initial row)", async () => {
    const { data, error } = await s.userA.client
      .from("feedback_status_history")
      .select("id, new_status")
      .eq("feedback_report_id", s.reportA);
    assert.equal(error, null);
    assert.ok(
      data.length >= 1,
      "reporter should see the auto-logged initial status row"
    );
  });

  it("5d. A cannot read status history of B's report", async () => {
    const { data } = await s.userA.client
      .from("feedback_status_history")
      .select("id")
      .eq("feedback_report_id", s.reportB);
    assert.equal((data ?? []).length, 0, "LEAK: foreign status history visible");
  });

  // ── Test 6/7: internal notes are platform-admin only ────────────────
  it("6. A cannot add an internal note", async () => {
    const { data, error } = await s.userA.client
      .from("feedback_internal_notes")
      .insert({
        feedback_report_id: s.reportA,
        author_id: s.userA.userId,
        note: "should be blocked",
      })
      .select("id");
    assert.ok(error || (data ?? []).length === 0, "note insert must fail");
  });

  it("7. A cannot read internal notes", async () => {
    // Seed a note via the platform owner first.
    const seeded = await s.owner.client
      .from("feedback_internal_notes")
      .insert({
        feedback_report_id: s.reportA,
        author_id: s.owner.userId,
        note: "platform-only note",
      })
      .select("id")
      .single();
    assert.equal(seeded.error, null, "owner should be able to add a note");

    const { data } = await s.userA.client
      .from("feedback_internal_notes")
      .select("id");
    assert.equal((data ?? []).length, 0, "LEAK: normal user read an internal note");
  });

  // ── Test 3/4 (RPC guards): platform read RPCs reject normal users ───
  it("3. A cannot call platform_list_feedback", async () => {
    const { error } = await s.userA.client.rpc("platform_list_feedback");
    assert.ok(error, "non-platform caller must be rejected");
  });

  it("4. A cannot call platform_get_feedback / history / notes", async () => {
    for (const fn of [
      "platform_get_feedback",
      "platform_list_feedback_history",
      "platform_list_feedback_notes",
    ]) {
      const { error } = await s.userA.client.rpc(fn, { p_id: s.reportA });
      assert.ok(error, `${fn} must reject a non-platform caller`);
    }
  });

  // ── Test 9: platform admin can view + manage all feedback ───────────
  it("9. owner sees reports from BOTH companies via platform_list_feedback", async () => {
    const { data, error } = await s.owner.client.rpc("platform_list_feedback");
    assert.equal(error, null);
    const ids = (data ?? []).map((r) => r.id);
    assert.ok(ids.includes(s.reportA), "owner should see company A's report");
    assert.ok(ids.includes(s.reportB), "owner should see company B's report");
  });

  it("9b. owner can read a full report + resolved reporter via platform_get_feedback", async () => {
    const { data, error } = await s.owner.client.rpc("platform_get_feedback", {
      p_id: s.reportB,
    });
    assert.equal(error, null);
    assert.equal(data?.[0]?.id, s.reportB);
    assert.ok(data[0].reporter_email, "reporter email should be resolved");
  });

  it("10. owner can update status and record history", async () => {
    const upd = await s.owner.client
      .from("feedback_reports")
      .update({ status: "in_review" })
      .eq("id", s.reportA)
      .select("id");
    assert.equal(upd.error, null);
    assert.equal((upd.data ?? []).length, 1, "owner update should affect 1 row");

    const hist = await s.owner.client.from("feedback_status_history").insert({
      feedback_report_id: s.reportA,
      changed_by: s.owner.userId,
      old_status: "open",
      new_status: "in_review",
      note: "owner triage",
    });
    assert.equal(hist.error, null, "owner should be able to log history");
  });

  // ── Test 10 (storage): screenshot bucket is private ─────────────────
  it("11a. a user can upload a screenshot only into their OWN company folder", async () => {
    const ownPath = `${s.userA.companyId}/${s.reportA}/shot.png`;
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    // Matches the production upload path (upsert:false) — the bucket has an
    // INSERT policy only, no UPDATE policy, so upsert is intentionally denied.
    const ok = await s.userA.client.storage
      .from(SCREENSHOT_BUCKET)
      .upload(ownPath, bytes, { contentType: "image/png" });
    assert.equal(ok.error, null, "own-company upload should succeed");
    s.screenshotPath = ownPath;

    const foreign = await s.userA.client.storage
      .from(SCREENSHOT_BUCKET)
      .upload(`${s.userB.companyId}/${s.reportA}/x.png`, bytes, {
        contentType: "image/png",
      });
    assert.ok(foreign.error, "upload into another company's folder must fail");
  });

  it("11b. screenshots are not publicly / anonymously readable", async () => {
    const anon = await anonClient()
      .storage.from(SCREENSHOT_BUCKET)
      .download(s.screenshotPath);
    assert.ok(anon.error, "anonymous download of a private object must fail");
  });

  it("11c. a normal user cannot mint a signed screenshot URL", async () => {
    const { data, error } = await s.userA.client.storage
      .from(SCREENSHOT_BUCKET)
      .createSignedUrl(s.screenshotPath, 3600);
    assert.ok(
      error || !data?.signedUrl,
      "authenticated non-admin must not sign a screenshot URL"
    );
  });

  it("11d. the service role (platform-admin server path) CAN sign a URL", async () => {
    const { data, error } = await s.svc.storage
      .from(SCREENSHOT_BUCKET)
      .createSignedUrl(s.screenshotPath, 3600);
    assert.equal(error, null);
    assert.ok(data?.signedUrl, "service role should mint a signed URL");
  });

  // ── Test 11 (invalid input): enum CHECK constraints ─────────────────
  it("12. invalid enum values are rejected by CHECK constraints", async () => {
    const bad = {
      feedback_type: { feedback_type: "not_a_type" },
      severity: { severity: "urgent" },
      category: { category: "nonsense" },
      status: { status: "reopened" },
    };
    for (const [label, override] of Object.entries(bad)) {
      const { error } = await s.userA.client
        .from("feedback_reports")
        .insert({
          company_id: s.userA.companyId,
          reporter_id: s.userA.userId,
          feedback_type: "bug",
          category: "general",
          severity: "low",
          status: "open",
          title: `invalid ${label}`,
          description: "x",
          ...override,
        })
        .select("id");
      assert.ok(error, `invalid ${label} should violate its CHECK constraint`);
    }
  });
});
