/**
 * Aizpilda K/S Ekoloģisks.lv rekvizītus no rēķina Nr.260375.
 *
 * Palaist:
 *   $env:NEXT_PUBLIC_SUPABASE_URL="https://XXXX.supabase.co"
 *   $env:SUPABASE_SECRET_KEY="eyJ..."
 *   node scripts/fill-ekologisks-rekviziti.mjs
 *   node scripts/fill-ekologisks-rekviziti.mjs --apply
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;
const APPLY        = process.argv.includes("--apply");

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Trūkst NEXT_PUBLIC_SUPABASE_URL vai SUPABASE_SECRET_KEY.");
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Dati no rēķina Nr.260375 ─────────────────────────────────────────────────
const EKOLOGISKS = {
  legal_name:          'K/S Ekoloģisks.lv',
  registration_number: '40203287000',
  vat_number:          'LV40203287000',
  is_vat_registered:   true,
  legal_address:       'ZvaigžņuKalns, Allažu pagasts, Siguldas novads',
  bank_name:           'Citadele banka AS',
  bank_iban:           'LV59PARX0033479870001',
  bank_swift:          'PARXLV22',
};

// ─── Atrast pēc nosaukuma vai reģ. Nr. ───────────────────────────────────────

console.log("\nMeklē K/S Ekoloģisks.lv sellers tabulā...");

const { data: sellers, error } = await db
  .from("sellers")
  .select("id, name, legal_name, registration_number, legal_address, bank_iban")
  .or("name.ilike.%ekolo%,legal_name.ilike.%ekolo%,registration_number.eq.40203287000");

if (error) { console.error("DB kļūda:", error.message); process.exit(1); }

if (!sellers || sellers.length === 0) {
  console.error("Tirgotājs nav atrasts. Pārbaudi sellers tabulu manuāli.");
  process.exit(1);
}

console.log(`\nAtrasti ${sellers.length} tirgotāji:\n`);
for (const s of sellers) {
  console.log(`  ID:              ${s.id}`);
  console.log(`  name:            ${s.name}`);
  console.log(`  legal_name:      ${s.legal_name ?? "(tukšs)"}`);
  console.log(`  registration_nr: ${s.registration_number ?? "(tukšs)"}`);
  console.log(`  legal_address:   ${s.legal_address ?? "(tukšs)"}`);
  console.log(`  bank_iban:       ${s.bank_iban ?? "(tukšs)"}`);
  console.log("");
}

if (sellers.length > 1) {
  console.error("Atrasts vairāk par 1. Precizē meklēšanu skriptā (filtrē pēc ID).");
  process.exit(1);
}

const seller = sellers[0];

// Salīdzini kas mainīsies
const patch = {};
const fields = Object.keys(EKOLOGISKS);
for (const f of fields) {
  if (!seller[f] || seller[f] !== EKOLOGISKS[f]) {
    patch[f] = EKOLOGISKS[f];
  }
}

if (Object.keys(patch).length === 0) {
  console.log("Visi rekvizīti jau aizpildīti. Nekas nav jādara.");
  process.exit(0);
}

console.log("Izmaiņas kas tiks piemērotas:");
for (const [k, v] of Object.entries(patch)) {
  const old = seller[k] ?? "(tukšs)";
  console.log(`  ${k}:`);
  console.log(`    Bija:  ${old}`);
  console.log(`    Būs:   ${v}`);
}

if (!APPLY) {
  console.log("\nSauss izdrukājums. Lai piemērotu:\n");
  console.log("  node scripts/fill-ekologisks-rekviziti.mjs --apply\n");
  process.exit(0);
}

const { error: updErr } = await db
  .from("sellers")
  .update(patch)
  .eq("id", seller.id);

if (updErr) {
  console.error("\nKļūda atjauninot:", updErr.message);
  process.exit(1);
}

console.log(`\n✓ K/S Ekoloģisks.lv (${seller.id}) veiksmīgi atjaunināts!`);
