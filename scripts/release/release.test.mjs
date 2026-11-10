import { test } from "node:test";
import assert from "node:assert/strict";
import { assertApplyTarget, authTemplates, localTemplates, applyMigrations } from "./lib.mjs";

test("release writes require an explicit reviewed target", () => {
  assert.throws(() => assertApplyTarget({}));
  assert.throws(() => assertApplyTarget({ RELEASE_TARGET: "production" }));
  assert.doesNotThrow(() => assertApplyTarget({ RELEASE_TARGET: "staging", RELEASE_APPLY_CONFIRM: "APPLY_REVIEWED_TIRGUS_RELEASE" }));
});

test("missing hosted credentials never perform HTTP or claim template publication", async () => {
  const results = await authTemplates({}, true, () => { throw new Error("network forbidden"); });
  assert.equal(results[0].status, "blocked");
});

test("hosted template apply only sends five reviewed templates and verifies readback", async () => {
  const payload = await localTemplates();
  let requests = 0;
  const results = await authTemplates({
    SUPABASE_ACCESS_TOKEN: "nonfunctional-test-value", SUPABASE_PROJECT_REF: "abcdefghijklmnopqrst",
    RELEASE_EXPECTED_PROJECT_REF: "abcdefghijklmnopqrst", RELEASE_TARGET: "staging",
    RELEASE_APPLY_CONFIRM: "APPLY_REVIEWED_TIRGUS_RELEASE",
  }, true, async (url, options) => {
    assert.equal(url, "https://api.supabase.com/v1/projects/abcdefghijklmnopqrst/config/auth");
    requests++;
    if (options.method === "PATCH") {
      assert.deepEqual(JSON.parse(options.body), payload);
      assert.equal(Object.keys(payload).length, 5);
      return Response.json({});
    }
    return Response.json({ ...payload, mailer_autoconfirm: false, site_url: "https://tirgus.izipizi.lv" });
  });
  assert.equal(requests, 2);
  assert.ok(results.every(r => r.status === "pass"));
});

test("wrong database identity cannot execute migration SQL", async () => {
  let writes = 0;
  const client = { query: async sql => { if (!sql.startsWith("SELECT current_database")) writes++; return { rows: [{ name: "other" }] }; } };
  await assert.rejects(applyMigrations(client, {
    DATABASE_URL: "postgresql://localhost/other", RELEASE_TARGET: "staging",
    RELEASE_APPLY_CONFIRM: "APPLY_REVIEWED_TIRGUS_RELEASE",
    RELEASE_EXPECTED_DB_HOST: "localhost", RELEASE_EXPECTED_DATABASE: "intended",
  }, []), /database_identity_mismatch/);
  assert.equal(writes, 0);
});
