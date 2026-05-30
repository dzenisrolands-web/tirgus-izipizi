/**
 * Aizpilda sellers tabulas juridiskos rekvizītus no Latvijas Uzņēmumu Reģistra
 * atvērtajiem datiem (bezmaksas CSV, CC0 licence).
 *
 * Ko aizpilda:
 *   - registration_number  (no UR regcode)
 *   - legal_name           (no UR name)
 *   - legal_address        (no UR address)
 *
 * Ko nevar aizpildīt automātiski (vajadzīgi no paša tirgotāja):
 *   - bank_iban, bank_name, bank_swift
 *   - vat_number, is_vat_registered
 *   - self_billing_agreed
 *
 * Palaist:
 *   node scripts/fill-seller-rekviziti.mjs          # sauss izdrukājums (dry-run)
 *   node scripts/fill-seller-rekviziti.mjs --apply  # piemēro izmaiņas
 */

import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

// ─── Env ──────────────────────────────────────────────────────────────────────

function loadEnv(path) {
  try {
    const lines = readFileSync(path, "utf8").split(/\r?\n/);
    const env = {};
    for (const line of lines) {
      const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
      if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
    }
    return env;
  } catch { return {}; }
}

const envFile = loadEnv(".env.local");
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || envFile["NEXT_PUBLIC_SUPABASE_URL"];
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || envFile["SUPABASE_SECRET_KEY"];
const APPLY       = process.argv.includes("--apply");

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Trūkst NEXT_PUBLIC_SUPABASE_URL vai SUPABASE_SECRET_KEY.");
  console.error("Palaid ar: $env:NEXT_PUBLIC_SUPABASE_URL='https://...'; $env:SUPABASE_SECRET_KEY='eyJ...'");
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── UR CSV lejupielāde ────────────────────────────────────────────────────────

const UR_CSV_URL =
  "https://data.gov.lv/dati/dataset/4de9697f-850b-45ec-8bba-61fa09ce932f" +
  "/resource/25e80bf3-f107-4ab4-89ef-251b5b9374e9/download/register.csv";

console.log("\n[1/4] Lejupielādē UR CSV (var aizņemt 10–30 s)...");
const resp = await fetch(UR_CSV_URL);
if (!resp.ok) { console.error("Neizdevās lejupielādēt CSV:", resp.status); process.exit(1); }
const raw = await resp.text();
const csvLines = raw.split(/\r?\n/);
console.log(`      ${csvLines.length.toLocaleString()} rindiņas lejupielādētas.`);

// ─── CSV parsēšana ────────────────────────────────────────────────────────────

// CSV kolonu indeksi (0-based):
// regcode;sepa;name;name_before_quotes;name_in_quotes;name_after_quotes;
// without_quotes;regtype;regtype_text;type;type_text;registered;terminated;
// closed;address;index;addressid;region;city;atvk;reregistration_term
const COL = { regcode:0, name:2, type_text:10, registered:11, closed:13, address:14 };

/** Parsē CSV rindiņu ar semikolu separatoru, atbalsta "" escape quotes */
function parseCsvRow(line) {
  const cols = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === ';' && !inQ) {
      cols.push(cur); cur = "";
    } else {
      cur += ch;
    }
  }
  cols.push(cur);
  return cols;
}

/** Normalizē nosaukumu salīdzināšanai: lowercase, noņem pieturzīmes un papildus atstarpes */
function norm(s) {
  return (s ?? "")
    .toLowerCase()
    .replace(/["""''«»]/g, "")
    .replace(/sia|as|ik|z\/s|zs|ps|ks|kb|se|nod|bdr/g, "")
    .replace(/[^a-zāčēģīķļņōŗšūž\d]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Indeksē CSV pa regcode un pa normalizētu nosaukumu
const byRegcode  = new Map(); // regcode → {name, address, type_text, closed}
const byNameNorm = new Map(); // norm(name) → {regcode, name, address, type_text, closed}

let header = true;
for (const line of csvLines) {
  if (!line.trim()) continue;
  if (header) { header = false; continue; }
  const cols = parseCsvRow(line);
  const regcode   = cols[COL.regcode]?.trim();
  const name      = cols[COL.name]?.trim();
  const address   = cols[COL.address]?.trim();
  const type_text = cols[COL.type_text]?.trim();
  const closed    = cols[COL.closed]?.trim();
  if (!regcode) continue;
  const rec = { regcode, name, address, type_text, closed };
  byRegcode.set(regcode, rec);
  const key = norm(name);
  if (key && !byNameNorm.has(key)) byNameNorm.set(key, rec); // pirmais sakritums
}
console.log(`      Indeksēts: ${byRegcode.size.toLocaleString()} uzņēmumi.`);

// ─── Sellers ar trūkstošiem rekvizītiem ──────────────────────────────────────

console.log("\n[2/4] Ielādē sellers ar trūkstošiem rekvizītiem...");
const { data: sellers, error: selErr } = await db
  .from("sellers")
  .select("id, name, legal_name, registration_number, legal_address, bank_iban, self_billing_agreed")
  .or("legal_name.is.null,registration_number.is.null,legal_address.is.null");

if (selErr) { console.error("DB kļūda:", selErr.message); process.exit(1); }
if (!sellers || sellers.length === 0) {
  console.log("  Nav tirgotāju ar trūkstošiem rekvizītiem. Viss kārtībā!");
  process.exit(0);
}
console.log(`  Atrasti ${sellers.length} tirgotāji ar nepilniem datiem.`);

// ─── Matching ─────────────────────────────────────────────────────────────────

console.log("\n[3/4] Meklē UR datos...\n");

const updates = [];
const noMatch = [];

for (const s of sellers) {
  let rec = null;
  let matchHow = "";

  // 1) Ja ir registration_number — meklē pēc regcode
  if (s.registration_number) {
    rec = byRegcode.get(s.registration_number.trim());
    if (rec) matchHow = `regcode=${s.registration_number}`;
  }

  // 2) Ja ir legal_name bet nav reg. num. — meklē pēc legal_name
  if (!rec && s.legal_name) {
    rec = byNameNorm.get(norm(s.legal_name));
    if (rec) matchHow = `legal_name="${s.legal_name}"`;
  }

  // 3) Mēģina pēc display name (mazāk uzticams)
  if (!rec && s.name) {
    rec = byNameNorm.get(norm(s.name));
    if (rec) matchHow = `name="${s.name}" (aptuvens!)`;
  }

  if (!rec) {
    noMatch.push(s);
    console.log(`  ✗  ${s.name || s.id} — netika atrasts UR datos`);
    continue;
  }

  if (rec.closed) {
    console.log(`  ⚠  ${s.name} (${matchHow}) — uzņēmums SLĒGTS (${rec.closed})`);
  }

  // Ko vajag aizpildīt?
  const patch = {};
  if (!s.registration_number && rec.regcode) patch.registration_number = rec.regcode;
  if (!s.legal_name           && rec.name)    patch.legal_name = rec.name;
  if (!s.legal_address        && rec.address) patch.legal_address = rec.address;

  const filled = Object.keys(patch);
  if (filled.length === 0) {
    console.log(`  ○  ${s.name} (${matchHow}) — visi lauki jau aizpildīti`);
    continue;
  }

  updates.push({ id: s.id, name: s.name, matchHow, patch, urRec: rec });
  console.log(`  ✓  ${s.name}`);
  console.log(`     Atrasts: ${matchHow}`);
  if (patch.registration_number) console.log(`     + registration_number: ${patch.registration_number}`);
  if (patch.legal_name)           console.log(`     + legal_name:          ${patch.legal_name}`);
  if (patch.legal_address)        console.log(`     + legal_address:       ${patch.legal_address}`);
  if (rec.type_text)              console.log(`     Uzņēmuma tips: ${rec.type_text}`);
  if (!s.bank_iban)               console.log(`     ⚠ Joprojām trūkst: bank_iban (jāaizpilda tirgotājam)`);
  console.log("");
}

// ─── Kopsavilkums un piemērošana ─────────────────────────────────────────────

console.log("─────────────────────────────────────────────────────────────────");
console.log(`Atrastas izmaiņas: ${updates.length}   Nesaskrienas: ${noMatch.length}`);

if (updates.length === 0) {
  console.log("Nav ko atjaunināt.");
  process.exit(0);
}

if (!APPLY) {
  console.log("\nSauss izdrukājums (dry-run). Lai piemērotu, palaid ar --apply:\n");
  console.log("  node scripts/fill-seller-rekviziti.mjs --apply\n");
  process.exit(0);
}

// ─── Piemēro DB ───────────────────────────────────────────────────────────────

console.log("\n[4/4] Piemēro izmaiņas DB...\n");

let ok = 0, fail = 0;
for (const { id, name, patch } of updates) {
  const { error } = await db.from("sellers").update(patch).eq("id", id);
  if (error) {
    console.error(`  ✗  ${name}: ${error.message}`);
    fail++;
  } else {
    console.log(`  ✓  ${name}: atjaunināts (${Object.keys(patch).join(", ")})`);
    ok++;
  }
}

console.log(`\nPiemērots: ${ok} ✓   Kļūdas: ${fail} ✗`);

if (noMatch.length > 0) {
  console.log("\nNeatrastie tirgotāji (jāaizpilda manuāli vai jānorāda reg. numurs):");
  for (const s of noMatch) {
    console.log(`  • ${s.name || s.id}`);
  }
}

console.log("\nPiezīme: bank_iban, vat_number, self_billing_agreed jāaizpilda tirgotājam pašam.");
