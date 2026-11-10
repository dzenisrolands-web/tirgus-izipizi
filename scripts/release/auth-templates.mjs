import { authTemplates } from "./lib.mjs";

try {
  const results = await authTemplates(process.env, process.argv.includes("--apply"));
  console.log(JSON.stringify({ applied: process.argv.includes("--apply") && results.every(r => r.status === "pass"), results }, null, 2));
  process.exitCode = results.every(r => r.status === "pass") ? 0 : 2;
} catch {
  console.log(JSON.stringify({ applied: false, reason: "auth_template_release_blocked" }));
  process.exitCode = 2;
}
