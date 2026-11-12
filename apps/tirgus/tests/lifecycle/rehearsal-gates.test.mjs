import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
const script = new URL("../../scripts/rehearse-postgres.mjs", import.meta.url).pathname;
for (const [args, blocker] of [
  [[], "AUTHORITATIVE_SCHEMA_EXPORT_REQUIRED"],
  [["--fixture", "--schema", "/does-not-exist"], "MIXED_SCHEMA_MODES"],
  [["--fixture", "--fixture"], "DUPLICATE_FLAG"],
  [["--db-url", "postgres://do-not-echo.invalid"], "INVALID_FLAGS"],
]) {
  test(`rehearsal input gate ${blocker} never requires Docker or emits full-schema success`, () => {
    const result = spawnSync(process.execPath, [script, ...args], { encoding: "utf8", env: { PATH: "" } });
    assert.equal(result.status, 2);
    const report = JSON.parse(result.stdout);
    assert.equal(report.blocker, blocker);
    assert.equal(report.fullSchemaRehearsed, false);
    assert.equal(report.productionReady, false);
    assert.equal(report.container, undefined);
    assert.ok(!result.stdout.includes("do-not-echo.invalid"));
  });
}
