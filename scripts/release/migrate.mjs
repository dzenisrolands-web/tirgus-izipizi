import { migrationManifest, connectDatabase, applyMigrations } from "./lib.mjs";

let client;
try {
  const manifest = await migrationManifest();
  if (!process.argv.includes("--apply")) {
    console.log(JSON.stringify({ mode: "plan", mutations: false, migrations: manifest.map(({ name, sha256 }) => ({ name, sha256 })) }, null, 2));
  } else {
    client = await connectDatabase();
    console.log(JSON.stringify({ mode: "apply", migrations: await applyMigrations(client, process.env, manifest) }, null, 2));
  }
} catch (error) {
  // Only our known error identifiers are printed; never raw driver errors or URLs.
  const message = typeof error?.message === "string" &&
    /^(explicit_target_confirmation_required|database_identity_confirmation_required|database_identity_mismatch|applied_migration_changed|invalid_reviewed_manifest|migration_transaction_required|DATABASE_URL_missing|migration_failed:[a-z0-9_.]+)$/.test(error.message)
    ? error.message : "release_migration_failed";
  console.log(JSON.stringify({ mode: "blocked", reason: message }));
  process.exitCode = 2;
} finally {
  if (client) await client.end();
}
