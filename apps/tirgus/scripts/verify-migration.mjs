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

const { data: rows } = await supabase
  .from("listings")
  .select("id, title, description, price, variants")
  .in("id", [
    "8700d073-3457-4a67-bd2e-30ff839b4910", // Josephine, 2 variants
    "d6586809-4eca-4ff8-92e2-4485cc4c00b2", // Signature, 1 variant
  ]);

for (const r of rows ?? []) {
  console.log(`--- ${r.title} ---`);
  console.log("price:", r.price);
  console.log("variants:", JSON.stringify(r.variants));
  console.log("desc tail:", r.description.slice(-120));
  console.log("still polluted?:", /Pievienot grozam|&euro;/i.test(r.description));
  console.log("");
}

// Also check overall stats
const { data: all } = await supabase.from("listings").select("description, variants");
const stillPolluted = (all ?? []).filter((l) => /Pievienot grozam|&euro;/i.test(l.description ?? "")).length;
const withVariants = (all ?? []).filter((l) => Array.isArray(l.variants) && l.variants.length > 0).length;
console.log(`Total: ${all?.length ?? 0}`);
console.log(`Still polluted: ${stillPolluted}`);
console.log(`With variants: ${withVariants}`);
