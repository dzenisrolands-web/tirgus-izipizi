/**
 * Check all active listings for working image URLs.
 * Pauses listings whose image_url returns 404 or fails to load.
 * Inserts notifications for affected sellers.
 *
 * Usage:
 *   node scripts/check-broken-images.mjs
 *   node scripts/check-broken-images.mjs --dry-run  (just report, no changes)
 *
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// ── Load .env.local manually (no dotenv dep) ──────────────────────────────────
const envPath = join(dirname(fileURLToPath(import.meta.url)), "..", ".env.local");
try {
  const envText = readFileSync(envPath, "utf8");
  for (const line of envText.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {
  console.error(`Could not read ${envPath} — is it set up?`);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local");
  process.exit(1);
}

const dryRun = process.argv.includes("--dry-run");
const CONCURRENCY = 10;
const TIMEOUT_MS = 10_000;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkUrl(url) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(url, { method: "HEAD", signal: ctrl.signal, redirect: "follow" });
    clearTimeout(t);
    return { ok: res.ok, status: res.status };
  } catch (e) {
    return { ok: false, status: 0, error: e.message };
  }
}

async function checkInBatches(items, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const batch = items.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
    process.stdout.write(`\r  Checked ${Math.min(i + CONCURRENCY, items.length)}/${items.length}...`);
  }
  process.stdout.write("\n");
  return results;
}

async function main() {
  console.log(`\n🔍 Checking image URLs for active listings... ${dryRun ? "(DRY RUN — no changes)" : ""}\n`);

  // Fetch all active listings with non-empty image_url
  const { data: listings, error } = await supabase
    .from("listings")
    .select("id, user_id, title, image_url")
    .eq("status", "active")
    .not("image_url", "is", null)
    .neq("image_url", "");

  if (error) { console.error("Failed to fetch listings:", error); process.exit(1); }
  console.log(`Found ${listings.length} active listings to check.\n`);

  const checked = await checkInBatches(listings, async (l) => ({
    ...l,
    ...(await checkUrl(l.image_url)),
  }));

  const broken = checked.filter((l) => !l.ok);
  console.log(`\n📊 Results:`);
  console.log(`   ✓ OK:     ${checked.length - broken.length}`);
  console.log(`   ✗ Broken: ${broken.length}`);

  if (broken.length === 0) {
    console.log("\n✨ No broken images. Done.\n");
    return;
  }

  console.log(`\n📋 Broken listings:`);
  for (const b of broken.slice(0, 20)) {
    console.log(`   [${b.status}] ${b.title.slice(0, 50)} — ${b.image_url.slice(0, 80)}`);
  }
  if (broken.length > 20) console.log(`   ... and ${broken.length - 20} more`);

  if (dryRun) {
    console.log("\n🚫 DRY RUN — no changes made. Re-run without --dry-run to apply.\n");
    return;
  }

  // Pause broken listings
  const brokenIds = broken.map((b) => b.id);
  console.log(`\n💾 Pausing ${brokenIds.length} listings...`);
  const { error: pauseErr } = await supabase
    .from("listings")
    .update({ status: "paused", updated_at: new Date().toISOString() })
    .in("id", brokenIds);
  if (pauseErr) { console.error("Pause failed:", pauseErr); process.exit(1); }

  // Insert notifications for each affected seller
  console.log(`📨 Sending notifications to ${broken.length} sellers...`);
  const notifications = broken.map((b) => ({
    user_id: b.user_id,
    title: "⚠️ Produkts deaktivizēts — bilde nav pieejama",
    message: `Produkts "${b.title}" automātiski deaktivizēts, jo tā bilde neielādējas (URL atgriež kļūdu vai nereaģē). Lūdzu, ielogojies un augšupielādē bildi no jauna, lai produkts atkal kļūtu redzams pircējiem.`,
    listing_id: b.id,
  }));
  const { error: notifyErr } = await supabase.from("notifications").insert(notifications);
  if (notifyErr) { console.error("Notify failed:", notifyErr); process.exit(1); }

  console.log(`\n✅ Done. Paused ${broken.length} listings, sent ${broken.length} notifications.\n`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
