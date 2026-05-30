/**
 * Backfill SEO slugs for all existing listings that don't have one yet.
 *
 * Slug format: toSlug(title) + '-' + id[:6]
 * This guarantees uniqueness since every ID is unique.
 *
 * After this script completes successfully, run in Supabase SQL editor:
 *   ALTER TABLE listings ADD CONSTRAINT listings_slug_unique UNIQUE (slug);
 *
 * Run:
 *   $env:NEXT_PUBLIC_SUPABASE_URL="https://..."
 *   $env:SUPABASE_SECRET_KEY="eyJ..."
 *   node scripts/backfill-slugs.mjs
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY.");
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Latvian slug generation (mirrors lib/utils.ts toSlug + toUniqueSlug) ──────

function toSlug(title) {
  const lv = [
    [/[āĀ]/g, 'a'], [/[čČ]/g, 'c'], [/[ēĒ]/g, 'e'], [/[ģĢ]/g, 'g'],
    [/[īĪ]/g, 'i'], [/[ķĶ]/g, 'k'], [/[ļĻ]/g, 'l'], [/[ņŅ]/g, 'n'],
    [/[ōŌ]/g, 'o'], [/[ŗŖ]/g, 'r'], [/[šŠ]/g, 's'], [/[ūŪ]/g, 'u'],
    [/[žŽ]/g, 'z'],
  ];
  let s = title.toLowerCase();
  for (const [r, c] of lv) s = s.replace(r, c);
  return s.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

function toUniqueSlug(title, id) {
  return `${toSlug(title)}-${id.slice(0, 6)}`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log("\nFetching listings without slugs...");

const { data: listings, error } = await db
  .from("listings")
  .select("id, title")
  .is("slug", null);

if (error) {
  console.error("DB error:", error.message);
  process.exit(1);
}

if (!listings || listings.length === 0) {
  console.log("All listings already have slugs. Nothing to do.");
  process.exit(0);
}

console.log(`Found ${listings.length} listings to backfill.\n`);

let ok = 0, fail = 0;
for (const l of listings) {
  const slug = toUniqueSlug(l.title, l.id);
  const { error: updErr } = await db
    .from("listings")
    .update({ slug })
    .eq("id", l.id);
  if (updErr) {
    console.error(`  ✗ ${l.id} "${l.title}" → ${slug}: ${updErr.message}`);
    fail++;
  } else {
    console.log(`  ✓ ${l.id.slice(0, 8)}… "${l.title.slice(0, 40)}" → ${slug}`);
    ok++;
  }
}

console.log(`\nDone: ${ok} updated, ${fail} failed.`);
if (fail === 0) {
  console.log("\nNext step — run this in Supabase SQL Editor:");
  console.log("  ALTER TABLE listings ADD CONSTRAINT listings_slug_unique UNIQUE (slug);");
}
