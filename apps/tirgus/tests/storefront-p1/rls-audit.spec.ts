import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const repo = resolve(__dirname, "../../../..");
const moduleUrl = pathToFileURL(resolve(repo, "scripts/audit-anon-exposure.mjs")).href;
test("anonymous observation never sends write probes, reads rows, invokes RPCs or certifies an empty result", () => {
  const program = `
    const {auditAnonRead}=await import(${JSON.stringify(moduleUrl)});
    const methods=[];
    const result=await auditAnonRead({url:'https://example.invalid',key:'nonfunctional-public',
      candidates:['orders','listings'],fetcher:async(url,init)=>{
        methods.push(init.method??'GET');
        if(url.endsWith('/rest/v1/'))return Response.json({}, {status:401});
        if(init.method!=='HEAD'||!url.endsWith('limit=0'))throw new Error('row or write probe');
        return new Response(null,{status:200});
      }});
    console.log(JSON.stringify({result,methods}));
  `;
  const output = JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e", program], { encoding: "utf8" }));
  expect(output.methods).toEqual(["GET", "HEAD", "HEAD"]);
  expect(output.result.liveAuditComplete).toBe(false);
  expect(output.result.writePrivilegesVerified).toBe(false);
  expect(output.result.tables.every((table: { anonInsert: string; selectExecution: string }) =>
    table.anonInsert === "unknown" && table.selectExecution === "allowed_row_visibility_unknown")).toBe(true);
});
test("catalog diagnostic contains only metadata reads and identifies inherited/public policies and column grants", () => {
  const sql = readFileSync(resolve(repo, "supabase/diagnostics/anon_rls_catalog.sql"), "utf8");
  expect(sql).toContain("BEGIN TRANSACTION READ ONLY");
  expect(sql).toContain("pg_policies");
  expect(sql).toContain("has_column_privilege");
  expect(sql).toContain("pg_has_role");
  expect(sql).toContain("pg_default_acl");
  expect(sql).toContain("TRUNCATE_GRANT_RLS_DOES_NOT_PROTECT");
  const statements = sql.split("\n").filter(line => !line.trim().startsWith("--")).join("\n");
  expect(statements).not.toMatch(/\b(?:INSERT\s+INTO|UPDATE\s+public|DELETE\s+FROM|ALTER\s+TABLE|CREATE\s+POLICY|GRANT\s|REVOKE\s|DROP\s)\b/i);
  expect(statements).not.toMatch(/\bFROM\s+public\./i);
});
test("source policy inventory labels historical mentions and every live privilege as unknown", () => {
  const program = `const {sourcePolicyReview}=await import(${JSON.stringify(moduleUrl)});console.log(JSON.stringify(sourcePolicyReview()));`;
  const result = JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e", program], { encoding: "utf8" }));
  expect(result.liveAuditComplete).toBe(false);
  expect(result.tables.length).toBeGreaterThan(15);
  expect(result.tables.find((table: { table: string }) => table.table === "sellers").risk).toContain("0036");
  expect(result.tables.find((table: { table: string }) => table.table === "user_roles").risk).toContain("0037");
  expect(result.tables.every((table: { anonRead: string }) => table.anonRead === "unknown")).toBe(true);
});
