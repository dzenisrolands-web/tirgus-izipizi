/**
 * Aizpilda 4 pārdevēju juridiskos rekvizītus no reķiniem un pavadzīmēm.
 *
 * Avoti:
 *   - K/S Ekoloģisks.lv    — svaigi rēķins.pdf (rēķins Nr.260375)
 *   - LĨVMALE, SIA          — 71-Rekins_260100-MWF-IP_260530.pdf (rēķins MWF-260100)
 *   - SIA DIAMONDS FOOD GROUP — Pavadzime Nr. 2026-049_svaigi.lv.pdf
 *   - JUMMIS SIA             — piegādātāja teksts
 *
 * Ko aizpilda: legal_name, registration_number, vat_number, is_vat_registered,
 *              legal_address, bank_name, bank_iban, bank_swift
 *
 * Palaist:
 *   $env:NEXT_PUBLIC_SUPABASE_URL="https://XXXX.supabase.co"
 *   $env:SUPABASE_SECRET_KEY="eyJ..."
 *   node scripts/fill-all-seller-rekviziti.mjs          # dry-run
 *   node scripts/fill-all-seller-rekviziti.mjs --apply  # raksta DB
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

// ─── Rekvizīti no dokumentiem ────────────────────────────────────────────────

const SELLERS_DATA = [
  {
    // Avots: svaigi rēķins.pdf — Rēķins Nr.260375
    _search: ["ekolo", "40203287000"],
    legal_name:          "K/S Ekoloģisks.lv",
    registration_number: "40203287000",
    vat_number:          "LV40203287000",
    is_vat_registered:   true,
    legal_address:       "ZvaigžņuKalns, Allažu pagasts, Siguldas novads",
    bank_name:           "Citadele banka AS",
    bank_iban:           "LV59PARX0033479870001",
    bank_swift:          "PARXLV22",
  },
  {
    // Avots: 71-Rekins_260100-MWF-IP.pdf — Wild&Free, Rēķins MWF-260100
    _search: ["livmale", "līvmale", "40003688350", "wild"],
    legal_name:          "LĨVMALE, SIA",
    registration_number: "40003688350",
    vat_number:          "LV40003688350",
    is_vat_registered:   true,
    legal_address:       '"Kārandas", Melnsils, Rojas pagasts, Talsu novads, LV-3264',
    bank_name:           "Swedbanka AS",
    bank_iban:           "LV42HABA0551008021064",
    bank_swift:          "HABALV22",
  },
  {
    // Avots: Pavadzime Nr. 2026-049_svaigi.lv.pdf — Cake Break
    _search: ["diamonds", "cake", "40203030654"],
    legal_name:          'SIA "DIAMONDS FOOD GROUP"',
    registration_number: "40203030654",
    vat_number:          "LV40203030654",
    is_vat_registered:   true,
    legal_address:       '"Pasts", Suntaži, Suntažu pag., Ogres nov., LV-5060',
    bank_name:           'A/S "Citadele"',
    bank_iban:           "LV58PARX0020009500001",
    bank_swift:          "PARXLV22",
  },
  {
    // Avots: piegādātāja teksts
    _search: ["jummis", "40103593164", "burzujs"],
    legal_name:          "JUMMIS SIA",
    registration_number: "40103593164",
    vat_number:          "LV40103593164",
    is_vat_registered:   true,
    legal_address:       "Dzirnavu iela 84, Rīga, LV-1050",
    // bank_iban nav zināms — jāaizpilda tirgotājam
  },
];

// ─── Palīgfunkcija — normalizē nosaukumu meklēšanai ──────────────────────────

function toLower(s) { return (s ?? "").toLowerCase(); }

// ─── Galvenā logika ───────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(64)}`);
console.log(`  Pārdevēju rekvizītu aizpilde — ${APPLY ? "PIEMĒRO" : "dry-run"}`);
console.log(`${"─".repeat(64)}\n`);

// Ielādē VISUS sellers (to ir maz, tāpēc ielādēsim vienreiz)
const { data: allSellers, error: selErr } = await db
  .from("sellers")
  .select("id, name, legal_name, registration_number, legal_address, bank_iban");

if (selErr) { console.error("DB kļūda:", selErr.message); process.exit(1); }
if (!allSellers || allSellers.length === 0) {
  console.error("Nav neviena pārdevēja DB."); process.exit(1);
}

console.log(`DB: ${allSellers.length} pārdevēji kopā.\n`);

let totalUpdated = 0, totalSkipped = 0, totalNotFound = 0;

for (const data of SELLERS_DATA) {
  const { _search, ...patch_full } = data;

  // Meklē pēc reg. numura vai daļēja nosaukuma
  const regNr = patch_full.registration_number;
  let match = allSellers.find(s =>
    s.registration_number === regNr ||
    _search.some(q => toLower(s.name).includes(q) || toLower(s.legal_name).includes(q))
  );

  console.log(`── ${patch_full.legal_name}`);
  console.log(`   Reģ.Nr.: ${regNr}`);

  if (!match) {
    console.log(`   ✗  Nav atrasts sellers tabulā (netika atrasts pēc: ${_search.join(", ")})\n`);
    totalNotFound++;
    continue;
  }

  console.log(`   ✓  Atrasts: "${match.name}" (ID: ${match.id})`);

  // Izveido patch — tikai lauki, kurus vajag aizpildīt
  const patch = {};
  for (const [k, v] of Object.entries(patch_full)) {
    if (v !== undefined && (match[k] === null || match[k] === undefined || match[k] === "")) {
      patch[k] = v;
    }
  }

  if (Object.keys(patch).length === 0) {
    console.log(`   ○  Visi lauki jau aizpildīti, nekas nav jādara.\n`);
    totalSkipped++;
    continue;
  }

  for (const [k, v] of Object.entries(patch)) {
    console.log(`   + ${k}: ${v}`);
  }
  if (!data.bank_iban) {
    console.log(`   ⚠ bank_iban nav zināms — jāaizpilda pārdevējam`);
  }

  if (APPLY) {
    const { error: updErr } = await db
      .from("sellers")
      .update(patch)
      .eq("id", match.id);
    if (updErr) {
      console.error(`   ✗  Kļūda: ${updErr.message}`);
    } else {
      console.log(`   ✓  Atjaunināts!`);
      totalUpdated++;
    }
  } else {
    console.log(`   (dry-run — nav rakstīts)`);
    totalUpdated++;
  }
  console.log("");
}

// ─── Kopsavilkums ─────────────────────────────────────────────────────────────
console.log(`${"─".repeat(64)}`);
console.log(`  Atjaunināti: ${totalUpdated}   Jau pilni: ${totalSkipped}   Nav atrasti: ${totalNotFound}`);
if (!APPLY && totalUpdated > 0) {
  console.log(`\n  Lai piemērotu, palaid ar --apply:`);
  console.log(`  node scripts/fill-all-seller-rekviziti.mjs --apply`);
}
if (totalNotFound > 0) {
  console.log(`\n  Neatrastie pārdevēji nav registrēti platformā`);
  console.log(`  vai nosaukums atšķiras — pārbaudi manuāli /admin/razotaji`);
}
console.log(`${"─".repeat(64)}\n`);
