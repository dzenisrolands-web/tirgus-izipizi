/**
 * One-time migration: set fixed commission rate on ALL existing listings.
 *
 * Usage (from project root):
 *   npx tsx scripts/set-commission.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env or .env.local.
 */

import { createClient } from "@supabase/supabase-js";

// Load .env.local (primary) then .env as fallback
for (const f of [".env.local", ".env"]) {
  try {
    const text = require("node:fs").readFileSync(f, "utf8") as string;
    for (const line of text.split("\n")) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
}

const COMMISSION_RATE = 15;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in environment");
  process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
  console.log(`Setting commission_rate=${COMMISSION_RATE} on all listings...`);

  const { data, error, count } = await supabase
    .from("listings")
    .update({
      commission_rate: COMMISSION_RATE,
      commission_status: "approved",
      commission_proposed_at: null,
      commission_approved_at: null,
      commission_approved_by: null,
    })
    .neq("id", "00000000-0000-0000-0000-000000000000") // match all rows
    .select("id");

  if (error) {
    console.error("Error updating listings:", error.message);
    process.exit(1);
  }

  console.log(`✅ Updated ${count ?? data?.length ?? 0} listings to ${COMMISSION_RATE}% commission.`);
}

main();
