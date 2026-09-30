import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const raw = readFileSync(".env.local", "utf-8").replace(/^﻿/, "");
const env = {};
for (const line of raw.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  env[m[1]] = v;
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

const { data: rows } = await supabase
  .from("listings")
  .select("category, title")
  .eq("status", "active");

const byCat = {};
for (const r of rows) {
  if (!byCat[r.category]) byCat[r.category] = [];
  byCat[r.category].push(r.title);
}
const sorted = Object.entries(byCat).sort((a, b) => b[1].length - a[1].length);
for (const [cat, titles] of sorted) {
  console.log(`\n=== ${cat} (${titles.length}) ===`);
  for (const t of titles.slice(0, 8)) console.log("  -", t);
  if (titles.length > 8) console.log(`  ... + ${titles.length - 8} more`);
}
