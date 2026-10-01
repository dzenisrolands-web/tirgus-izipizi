// Replicate what fetchActiveListings does to see if anything throws
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const raw = readFileSync(".env.local", "utf-8").replace(/^﻿/, "");
const env = {};
for (const line of raw.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  env[m[1]] = v;
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

const { data: rows, error } = await supabase
  .from("listings")
  .select("id, title, description, price, unit, category, image_url, locker_id, seller_id, quantity, created_at, variants")
  .eq("status", "active")
  .order("created_at", { ascending: false });

if (error) {
  console.error("ERROR fetching:", error);
  process.exit(1);
}
console.log(`Fetched ${rows.length} active rows`);

// Check variants column type
const withVariants = rows.filter((r) => r.variants != null);
console.log(`Rows with variants !== null: ${withVariants.length}`);
console.log(`First few variants types:`);
for (const r of withVariants.slice(0, 3)) {
  console.log(`  ${r.id}: typeof=${typeof r.variants}, isArray=${Array.isArray(r.variants)}, value=`, r.variants);
}

// Check rows with non-array, non-null variants
const weird = rows.filter((r) => r.variants != null && !Array.isArray(r.variants));
console.log(`\nWeird variants (not null, not array): ${weird.length}`);
for (const r of weird.slice(0, 5)) {
  console.log(`  ${r.id}: ${typeof r.variants}`, r.variants);
}
