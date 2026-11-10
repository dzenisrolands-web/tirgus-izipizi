import { authTemplates } from "./lib.mjs";

try {
  const results = await authTemplates(process.env, process.argv.includes("--apply"));
  const templates = results.filter(result => result.check.startsWith("mailer_templates_"));
  console.log(JSON.stringify({ applied: process.argv.includes("--apply") &&
    templates.length === 5 && templates.every(result => result.status === "pass"), results }, null, 2));
  process.exitCode = results.every(r => r.status === "pass") ? 0 : 2;
} catch {
  console.log(JSON.stringify({ applied: process.argv.includes("--apply") ? "unverified" : false, reason: "auth_template_release_blocked" }));
  process.exitCode = 2;
}
