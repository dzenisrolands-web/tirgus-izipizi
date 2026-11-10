import { connectDatabase, databasePreflight, controlledTestEvidence, authTemplates, outcome } from "./lib.mjs";

const results = [];
let client;
try {
  client = await connectDatabase();
  results.push(...await databasePreflight(client));
  results.push(await controlledTestEvidence(client, process.env));
} catch {
  results.push(outcome("database", "blocked", process.env.DATABASE_URL ? "database_preflight_failed" : "DATABASE_URL_required"));
} finally {
  if (client) await client.end();
}
try { results.push(...await authTemplates(process.env)); }
catch { results.push(outcome("hosted_auth", "blocked", "auth_preflight_failed")); }
for (const key of ["CRON_SECRET", "PAYSERA_PROJECT_ID", "PAYSERA_SIGN_PASSWORD", "RESEND_API_KEY"]) {
  results.push(outcome(`configuration:${key}`, process.env[key] ? "pass" : "blocked", process.env[key] ? undefined : "not_available_in_this_environment"));
}
console.log(JSON.stringify({ ready: results.every(r => r.status === "pass"), results }, null, 2));
process.exitCode = results.every(r => r.status === "pass") ? 0 : 2;
