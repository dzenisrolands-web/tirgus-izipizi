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

const { data: rows } = await supabase.from("listings").select("id, title, status, image_url, price, variants").eq("status", "active");
console.log(`Active listings: ${rows.length}`);

// Find zero-price ones
const zero = rows.filter((r) => r.price == null || r.price === 0);
console.log(`\nZero/null price: ${zero.length}`);
for (const r of zero) {
  console.log(`  ${r.id} | "${r.title}" | price=${r.price} | variants=${JSON.stringify(r.variants)}`);
}
