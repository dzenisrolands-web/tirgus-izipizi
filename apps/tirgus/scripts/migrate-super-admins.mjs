/**
 * Migrate existing super admins: set app_metadata.is_super_admin = true
 *
 * Run BEFORE the SQL migration (0023_super_admin_app_metadata.sql).
 *
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SECRET_KEY=... node scripts/migrate-super-admins.mjs
 *
 * Or set env vars in .env.local and run:
 *   node -e "require('dotenv').config({path:'.env.local'})" && node scripts/migrate-super-admins.mjs
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY");
  process.exit(1);
}

const supabase = createClient(url, key);

// 1. Find all profiles with role = 'super_admin'
const { data: admins, error } = await supabase
  .from("profiles")
  .select("id")
  .eq("role", "super_admin");

if (error) {
  console.error("Failed to query profiles:", error.message);
  process.exit(1);
}

if (!admins || admins.length === 0) {
  console.log("No super_admin profiles found. Nothing to migrate.");
  process.exit(0);
}

console.log(`Found ${admins.length} super admin(s). Setting app_metadata...`);

for (const admin of admins) {
  const { error: updateErr } = await supabase.auth.admin.updateUserById(admin.id, {
    app_metadata: { is_super_admin: true },
  });

  if (updateErr) {
    console.error(`  ✗ ${admin.id}: ${updateErr.message}`);
  } else {
    console.log(`  ✓ ${admin.id}: app_metadata.is_super_admin = true`);
  }
}

console.log("\nDone. Now run the SQL migration to downgrade profiles.role.");
