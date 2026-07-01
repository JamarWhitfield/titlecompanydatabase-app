// ============================================================
// Platform Admin Console — authorization & audit test suite.
//
// Verifies the platform-admin trust boundary added in migration 0023:
//   * platform status is separate from company role,
//   * non-platform users (member OR company admin) get nothing,
//   * role gating (owner/support/auditor) is enforced in the database,
//   * break-glass support sessions require a reason, expire, and audit,
//   * platform_audit_logs is append-only,
//   * existing tenant isolation is NOT weakened by any of it.
//
// Everything runs through the public anon key (the same path the browser
// uses), so the SECURITY DEFINER RPC guards + RLS are exercised for real.
//
// Run:  node --test tests/platform-admin.test.mjs
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

describe("Platform Admin Console", () => {
  const ts = Date.now();
  const password = `Plat-Test-${ts}-Xy!`;

  const s = {
    svc: null,
    users: {}, // label -> { userId, companyId, email, client }
    targetCompany: null,
    targetRecord: null,
    targetFile: null,
  };

  const mk = (label) => `plat-${label}-${ts}@example.com`;

  async function makeUser(label, opts = {}) {
    const email = mk(label);
    const { userId, companyId } = await createCompanyAdmin(s.svc, {
      email,
      password,
      companyName: `Plat ${label} ${ts}`,
    });
    if (opts.role === "member") {
      await s.svc.from("profiles").update({ role: "member" }).eq("id", userId);
    }
    const rec = { userId, companyId, email, client: null };
    s.users[label] = rec;
    return rec;
  }

  before(async () => {
    assertConfig();
    const svc = serviceClient();
    s.svc = svc;

    // Platform operators (each also a normal company admin of their own co).
    const owner = await makeUser("owner");
    const support = await makeUser("support");
    const auditor = await makeUser("auditor");
    const disabled = await makeUser("disabled");
    await makeUser("grantee"); // gets granted via RPC
    // Non-platform users.
    await makeUser("admin"); // normal company admin, no platform role
    await makeUser("member", { role: "member" });
    // A separate tenant whose PRIVATE data support/owner will inspect.
    const target = await makeUser("target");
    s.targetCompany = target.companyId;

    // Bootstrap platform roles directly (this mirrors the documented
    // one-time SQL bootstrap; service role bypasses RLS).
    await svc.from("platform_admins").insert([
      { user_id: owner.userId, role: "owner", enabled: true },
      { user_id: support.userId, role: "support", enabled: true },
      { user_id: auditor.userId, role: "auditor", enabled: true },
      { user_id: disabled.userId, role: "support", enabled: false },
    ]);

    // Sign everyone in.
    for (const label of Object.keys(s.users)) {
      s.users[label].client = await signedInClient({
        email: s.users[label].email,
        password,
      });
    }

    // Seed a PRIVATE record + file in the target company (as its owner).
    const { data: rec, error: recErr } = await target.client
      .from("company_records")
      .insert({
        company_id: target.companyId,
        created_by: target.userId,
        title: "Target Private Record",
        record_type: "abstract",
        is_shared: false,
      })
      .select("id")
      .single();
    if (recErr) throw new Error(`seed target record: ${recErr.message}`);
    s.targetRecord = rec.id;

    const { data: file, error: fileErr } = await target.client
      .from("record_files")
      .insert({
        company_id: target.companyId,
        record_id: rec.id,
        name: "confidential.pdf",
        path: `${target.companyId}/${rec.id}/${randomUUID()}.pdf`,
        size: 2048,
        mime_type: "application/pdf",
      })
      .select("id")
      .single();
    if (fileErr) throw new Error(`seed target file: ${fileErr.message}`);
    s.targetFile = file.id;
  });

  after(async () => {
    const svc = s.svc;
    if (!svc) return;
    const userIds = Object.values(s.users).map((u) => u.userId);
    const companyIds = Object.values(s.users).map((u) => u.companyId);
    try {
      await svc.from("platform_audit_logs").delete().in("actor_user_id", userIds);
      await svc
        .from("platform_support_sessions")
        .delete()
        .in("actor_user_id", userIds);
      await svc.from("platform_admins").delete().in("user_id", userIds);
      if (s.targetRecord)
        await svc.from("record_files").delete().eq("record_id", s.targetRecord);
      await svc.from("company_records").delete().in("company_id", companyIds);
      await svc.from("audit_logs").delete().in("company_id", companyIds);
      await svc.from("companies").delete().in("id", companyIds);
      for (const id of userIds) await svc.auth.admin.deleteUser(id);
    } catch (err) {
      console.error("Cleanup warning:", err.message);
    }
  });

  // 1. Normal company MEMBER has no platform access.
  it("1. normal member: no platform role, RPCs rejected", async () => {
    const c = s.users.member.client;
    const { data: role } = await c.rpc("platform_current_role");
    assert.equal(role, null, "member must have no platform role");
    const { error } = await c.rpc("platform_list_companies");
    assert.ok(error, "member must not list companies");
  });

  // 2. Normal company ADMIN (not a platform admin) has no platform access.
  it("2. company admin without platform grant is rejected", async () => {
    const c = s.users.admin.client;
    const { data: role } = await c.rpc("platform_current_role");
    assert.equal(role, null);
    const { error } = await c.rpc("platform_get_stats");
    assert.ok(error, "company admin must not read platform stats");
  });

  // 3. Auditor: read companies + platform audit, but NO support sessions.
  it("3. auditor can read, cannot start support", async () => {
    const c = s.users.auditor.client;
    const { data: companies, error: cErr } = await c.rpc(
      "platform_list_companies"
    );
    assert.equal(cErr, null);
    assert.ok(Array.isArray(companies));
    const { error: auditErr } = await c.rpc(
      "platform_list_platform_audit_logs"
    );
    assert.equal(auditErr, null, "auditor may read platform audit");

    const { error: supErr } = await c.rpc("platform_start_support_session", {
      p_company_id: s.targetCompany,
      p_reason: "should be blocked",
    });
    assert.ok(supErr, "auditor must NOT start support sessions");
  });

  // 4. Support can read companies + start a support session.
  it("4. support can start a support session", async () => {
    const c = s.users.support.client;
    const { data: sid, error } = await c.rpc("platform_start_support_session", {
      p_company_id: s.targetCompany,
      p_reason: "Investigating ticket #100",
    });
    assert.equal(error, null);
    assert.ok(typeof sid === "string");
  });

  // 5. Owner can manage platform admins; support cannot even list them.
  it("5. owner manages admins; support cannot list them", async () => {
    const owner = s.users.owner.client;
    const { error: addErr } = await owner.rpc("platform_add_admin", {
      target_email: s.users.grantee.email,
      target_role: "auditor",
    });
    assert.equal(addErr, null, "owner should add a platform admin");

    const { data: list, error: listErr } = await owner.rpc(
      "platform_list_admins"
    );
    assert.equal(listErr, null);
    const granted = list.find((a) => a.user_id === s.users.grantee.userId);
    assert.ok(granted, "grantee should now appear in the admin roster");
    assert.equal(granted.role, "auditor");

    const { error: supportListErr } = await s.users.support.client.rpc(
      "platform_list_admins"
    );
    assert.ok(supportListErr, "support must NOT list platform admins");
  });

  // 6. Disabled platform admin has no access.
  it("6. disabled platform admin is denied", async () => {
    const c = s.users.disabled.client;
    const { data: role } = await c.rpc("platform_current_role");
    assert.equal(role, null, "disabled admin resolves to no role");
    const { error } = await c.rpc("platform_list_companies");
    assert.ok(error, "disabled admin must not list companies");
  });

  // 7. Support session requires a non-empty reason.
  it("7. empty reason is rejected", async () => {
    const { error } = await s.users.support.client.rpc(
      "platform_start_support_session",
      { p_company_id: s.targetCompany, p_reason: "   " }
    );
    assert.ok(error, "empty reason must be rejected");
  });

  // 8. Expired support session cannot read records.
  it("8. expired session cannot list records", async () => {
    const c = s.users.support.client;
    const { data: sid } = await c.rpc("platform_start_support_session", {
      p_company_id: s.targetCompany,
      p_reason: "expiry test",
    });
    await s.svc
      .from("platform_support_sessions")
      .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
      .eq("id", sid);
    const { error } = await c.rpc("platform_support_list_records", {
      p_session_id: sid,
    });
    assert.ok(error, "expired session must be rejected");
  });

  // 9. Reading a specific record during support writes a platform audit log.
  it("9. support record view is audited", async () => {
    const c = s.users.support.client;
    const { data: sid } = await c.rpc("platform_start_support_session", {
      p_company_id: s.targetCompany,
      p_reason: "record view audit test",
    });
    const { error } = await c.rpc("platform_support_get_record", {
      p_session_id: sid,
      p_record_id: s.targetRecord,
    });
    assert.equal(error, null);

    const { data: logs } = await s.svc
      .from("platform_audit_logs")
      .select("id")
      .eq("action", "support_view_record")
      .eq("target_record_id", s.targetRecord);
    assert.ok((logs ?? []).length >= 1, "record view must be logged");
  });

  // 10. Authorizing a file download during support writes a platform audit log.
  it("10. support file download is audited", async () => {
    const c = s.users.support.client;
    const { data: sid } = await c.rpc("platform_start_support_session", {
      p_company_id: s.targetCompany,
      p_reason: "download audit test",
    });
    const { data: path, error } = await c.rpc(
      "platform_support_authorize_download",
      { p_session_id: sid, p_file_id: s.targetFile }
    );
    assert.equal(error, null);
    assert.ok(typeof path === "string" && path.length > 0);

    const { data: logs } = await s.svc
      .from("platform_audit_logs")
      .select("id")
      .eq("action", "support_download_file")
      .eq("target_record_id", s.targetRecord);
    assert.ok((logs ?? []).length >= 1, "download must be logged");
  });

  // 11. Platform role does NOT grant normal cross-tenant table access.
  it("11. auditor cannot read target's private record via tables (RLS intact)", async () => {
    const { data } = await s.users.auditor.client
      .from("company_records")
      .select("id")
      .eq("id", s.targetRecord)
      .maybeSingle();
    assert.equal(
      data,
      null,
      "LEAK: platform role exposed a private record through normal RLS path"
    );
  });

  // 12. platform_audit_logs is append-only from any client.
  it("12. platform_audit_logs cannot be inserted/updated directly", async () => {
    const owner = s.users.owner.client;
    const { error: insErr } = await owner
      .from("platform_audit_logs")
      .insert({ actor_user_id: s.users.owner.userId, action: "tamper" });
    assert.ok(insErr, "direct audit insert must be blocked by RLS");

    const { data: upd } = await owner
      .from("platform_audit_logs")
      .update({ action: "tampered" })
      .eq("actor_user_id", s.users.owner.userId)
      .select("id");
    assert.equal((upd ?? []).length, 0, "audit rows must be immutable");
  });

  // 13. platform_admins cannot be written directly (RPC-only mutations).
  it("13. platform_admins rejects direct client insert", async () => {
    const { error } = await s.users.owner.client
      .from("platform_admins")
      .insert({ user_id: s.users.member.userId, role: "owner", enabled: true });
    assert.ok(error, "direct platform_admins insert must be blocked");
  });
});
