/**
 * Converts lib/real-products.json → lib/mock-data.ts
 * Run: node scripts/build-mock-data.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, "../lib/real-products.json");
const OUT = path.join(__dirname, "../lib/mock-data.ts");

const raw = JSON.parse(fs.readFileSync(SRC, "utf8"));

// ── Categorisation ────────────────────────────────────────────────────────────
function categorize(name, sellerId) {
  const n = name.toLowerCase();
  if (sellerId === 14) return "Jūras veltes";
  if (sellerId === 9) return "Jūras veltes";
  if (sellerId === 12) return "Konditorija";
  if (n.includes("pelmeņ") || n.includes("pankūk") || n.includes("burger") || n.includes("frikadel") || n.includes("kotlet") || n.includes("rullīš") || n.includes("pankuka") || n.includes("tīteņ") || n.includes("lazanja") || n.includes("sardel") || n.includes("cīsiņ") || n.includes("kebab") || n.includes("ola") && sellerId === 7) return "Saldēta pārtika";
  if (n.includes("ola") || n.includes("paipalu")) return "Olas";
  if (n.includes("kafija") || n.includes("kombuča") || n.includes("kombucha") || n.includes("sula") || n.includes("sīrups") || n.includes("tēj")) return "Dzērieni";
  if (n.includes("eļļa")) return "Eļļas";
  if (n.includes("pulveris") || n.includes("proteīn")) return "Uztura bagātinātāji";
  if (n.includes("ikri") || n.includes("forele") || n.includes("lasis") || n.includes("nēģ") || n.includes("zivi")) return "Jūras veltes";
  if (n.includes("kartupeļ") || n.includes("biete") || n.includes("burkān") || n.includes("kāpost") || n.includes("sīpol") || n.includes("kāļ") || n.includes("kolrāb") || n.includes("rutk") || n.includes("redīs") || n.includes("ķiplok") || n.includes("dārzeņ")) return "Dārzeņi";
  if (n.includes("ketčup") || n.includes("garšviel") || n.includes("marmelād") || n.includes("medniek") || n.includes("konserv") || n.includes("konservs") || n.includes("buljons") || n.includes("bundžā") || n.includes("burciņā")) return "Konservi";
  if (n.includes("steik") || n.includes("filejas") || n.includes("šašlik") || n.includes("osso") || n.includes("velington") || n.includes("maltas") || n.includes("gaļas masa") || n.includes("kotlešu masa") || n.includes("asinsdesa") || n.includes("desa") || n.includes("servelāde") || n.includes("kupāt") || n.includes("medniek")) return "Gaļa";
  if (n.includes("torte") || n.includes("kūka") || n.includes("mafin") || n.includes("profitr") || n.includes("piparkūk") || n.includes("sapnis")) return "Konditorija";
  if (n.includes("medus")) return "Medus";
  if (n.includes("maize") || n.includes("baton") || n.includes("rulla")) return "Maize";
  if (sellerId === 7) return "Saldēta pārtika";
  if (sellerId === 8) return "Gaļa";
  if (sellerId === 13) return "Dārzeņi";
  return "Citi";
}

// ── Freshness by category ─────────────────────────────────────────────────────
function freshnessDate(category, name) {
  const n = name.toLowerCase();
  // Oysters / raw fish — short
  if (category === "Jūras veltes" && (n.includes("oster") || n.includes("austere") || n.includes("forele"))) return "2026-04-28";
  // Fresh veg
  if (category === "Dārzeņi") return "2026-05-10";
  // Pastry / cakes
  if (category === "Konditorija") return "2026-04-27";
  // Frozen
  if (category === "Saldēta pārtika" || category === "Gaļa") return "2026-09-30";
  // Ikri / fish roe
  if (category === "Jūras veltes") return "2026-05-05";
  // Drinks / oils / supplements
  return "2026-12-31";
}

// ── Quantity by category ──────────────────────────────────────────────────────
const quantities = { "Jūras veltes": [4, 8], "Konditorija": [3, 6], "Dārzeņi": [20, 50], "Saldēta pārtika": [10, 25], "Gaļa": [5, 15], default: [5, 20] };
function qty(cat, idx) {
  const [lo, hi] = quantities[cat] || quantities.default;
  return lo + (idx % (hi - lo + 1));
}

// ── Locker round-robin ────────────────────────────────────────────────────────
const LOCKER_IDS = ["brivibas", "salaspils", "agenskalna", "tukums", "dundaga", "ikskile"];
function lockerId(idx) { return LOCKER_IDS[idx % LOCKER_IDS.length]; }
function lockerIdx(id) { return LOCKER_IDS.indexOf(id); }

// ── createdAt spread ──────────────────────────────────────────────────────────
function createdAt(idx) {
  const d = new Date("2026-04-22");
  d.setDate(d.getDate() - (idx % 7));
  return d.toISOString().slice(0, 10);
}

// ── Unit label ────────────────────────────────────────────────────────────────
function unit(name) {
  const n = name.toLowerCase();
  if (n.match(/\d+\s*g\b/)) return n.match(/\d+\s*g\b/)[0];
  if (n.match(/\d+\s*kg/)) return n.match(/\d+\s*kg/)[0];
  if (n.match(/\d+\s*ml/)) return n.match(/\d+\s*ml/)[0];
  if (n.match(/\d+\s*l\b/)) return n.match(/\d+\s*l\b/)[0];
  if (n.includes("gab")) return "gab.";
  if (n.includes("/kg")) return "kg";
  if (n.includes("kg")) return "kg";
  return "gab.";
}

// ── Build sellers list ────────────────────────────────────────────────────────
const SELLER_META = {
  7:  { location: "Rīga",            rating: 4.9, reviews: 84 },
  8:  { location: "Vidzemes novads", rating: 4.8, reviews: 61 },
  9:  { location: "Rīga",            rating: 5.0, reviews: 38 },
  12: { location: "Suntaži",         rating: 4.9, reviews: 112 },
  13: { location: "Pierīgas novads", rating: 4.7, reviews: 55 },
  14: { location: "Rīga",            rating: 4.9, reviews: 47 },
};

const sellers = Object.entries(raw).map(([id, s]) => {
  const meta = SELLER_META[id] || { location: "Latvija", rating: 4.8, reviews: 20 };
  return {
    id: `s${id}`,
    name: s.name,
    farmName: s.name,
    avatar: s.logo || "",
    verified: true,
    rating: meta.rating,
    reviewCount: meta.reviews,
    location: meta.location,
  };
});

// ── Build listings ────────────────────────────────────────────────────────────
let listingIdx = 0;
const listings = [];

for (const [sid, s] of Object.entries(raw)) {
  const seller = sellers.find((x) => x.id === `s${sid}`);
  for (const p of s.products) {
    if (!p.image) continue; // skip products without images
    const cat = categorize(p.name, parseInt(sid));
    const lid = lockerId(listingIdx);
    const lockerIndex = lockerIdx(lid);
    listings.push({
      id: `l${listingIdx + 1}`,
      title: p.name,
      description: p.description || p.name,
      price: p.price ?? 0,
      unit: unit(p.name),
      category: cat,
      image: p.image,
      sellerId: seller.id,
      _sellerIdx: sellers.indexOf(seller),
      lockerId: lid,
      _lockerIdx: lockerIndex,
      freshnessDate: freshnessDate(cat, p.name),
      quantity: qty(cat, listingIdx),
      createdAt: createdAt(listingIdx),
    });
    listingIdx++;
  }
}

// ── Collect all categories ────────────────────────────────────────────────────
const categorySet = new Set(listings.map((l) => l.category));
const categories = ["Visi", ...Array.from(categorySet).sort()];

// ── Generate TypeScript ───────────────────────────────────────────────────────
const lockers = [
  { id: "brivibas",  name: "Brīvības iela 253",   address: "Brīvības iela 253 / NESTE",    city: "Rīga",     hours: "24/7" },
  { id: "salaspils", name: "Salaspils",             address: "Zviedru iela 1C / NESTE",       city: "Salaspils",hours: "24/7" },
  { id: "agenskalna",name: "Āgenskalna tirgus",    address: "Nometņu iela 64 / Tirgus",     city: "Rīga",     hours: "24/7" },
  { id: "tukums",    name: "Tukuma tirgus",         address: "J. Raiņa iela 30 / Tirgus",    city: "Tukums",   hours: "24/7" },
  { id: "dundaga",   name: "Dundagas tirgus",       address: "Pils 3B / Tirgus",             city: "Dundaga",  hours: "24/7" },
  { id: "ikskile",   name: "Ikšķile",               address: "Daugavas iela 63 / Labumu bode",city: "Ikšķile", hours: "10:00–20:00" },
];

function j(v) { return JSON.stringify(v, null, 2); }

let ts = `// AUTO-GENERATED by scripts/build-mock-data.mjs — do not edit manually

export type Locker = {
  id: string; name: string; address: string; city: string; hours: string;
};
export type Seller = {
  id: string; name: string; farmName: string; avatar: string;
  verified: boolean; rating: number; reviewCount: number; location: string;
};
export type Listing = {
  id: string; title: string; description: string; price: number; unit: string;
  category: string; image: string; sellerId: string; seller: Seller;
  lockerId: string; locker: Locker; freshnessDate: string; quantity: number; createdAt: string;
};
export type Review = {
  id: string; listingId: string; buyerName: string; buyerAvatar: string;
  stars: 1 | 2 | 3 | 4 | 5; comment: string; date: string;
};

export const lockers: Locker[] = ${j(lockers)};

export const sellers: Seller[] = ${j(sellers)};

`;

// Write listings with inline seller/locker references
ts += `export const listings: Listing[] = [\n`;
for (const l of listings) {
  const seller = sellers[l._sellerIdx];
  const locker = lockers[l._lockerIdx];
  const { _sellerIdx, _lockerIdx, ...rest } = l;
  ts += `  ${JSON.stringify({ ...rest, seller, locker })},\n`;
}
ts += `];\n\n`;

// Static reviews
ts += `export const reviews: Review[] = [
  {
    id: "r1", listingId: "l1",
    buyerName: "Kristīne L.",
    buyerAvatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=48&h=48&fit=crop",
    stars: 5,
    comment: "Izcili pelmeņi! Garša kā no vecmāmiņas virtuves. Pakomātā viss bija kārtīgi saldēts.",
    date: "2026-04-20",
  },
  {
    id: "r2", listingId: "l1",
    buyerName: "Mārtiņš K.",
    buyerAvatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=48&h=48&fit=crop",
    stars: 5,
    comment: "Pasūtīju pirmo reizi un jau esmu pastāvīgais klients. Ātrs, svaigi, garšīgi!",
    date: "2026-04-18",
  },
  {
    id: "r3", listingId: "l41",
    buyerName: "Ilze V.",
    buyerAvatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=48&h=48&fit=crop",
    stars: 5,
    comment: "Savvaļas brieža steiks — neticams! Grilēts ar sviesta un garšaugu mērci. Labākais ko ēdusi.",
    date: "2026-04-19",
  },
  {
    id: "r4", listingId: "l41",
    buyerName: "Andris Z.",
    buyerAvatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=48&h=48&fit=crop",
    stars: 4,
    comment: "Laba gaļa, svaiga. Pakomātā saņemšana bija ļoti ērta alternatīva veikalam.",
    date: "2026-04-15",
  },
  {
    id: "r5", listingId: "l81",
    buyerName: "Santa R.",
    buyerAvatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=48&h=48&fit=crop",
    stars: 5,
    comment: "Deserta torte bija svētku galda zvaigzne! Visi viesi prasīja recepti :)",
    date: "2026-04-21",
  },
  {
    id: "r6", listingId: "l81",
    buyerName: "Normunds B.",
    buyerAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=48&h=48&fit=crop",
    stars: 5,
    comment: "Mājas gatavošanas kvalitāte ir neapšaubāma. Pakomātā saņēmu svaigo stāvoklī.",
    date: "2026-04-17",
  },
  {
    id: "r7", listingId: "l101",
    buyerName: "Evija P.",
    buyerAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=48&h=48&fit=crop",
    stars: 5,
    comment: "Bio kartupeļi no Ekoloģisks.lv — milzīga atšķirība salīdzinājumā ar veikala produktiem!",
    date: "2026-04-16",
  },
  {
    id: "r8", listingId: "l121",
    buyerName: "Jānis S.",
    buyerAvatar: "https://images.unsplash.com/photo-1463453091185-61582044d556?w=48&h=48&fit=crop",
    stars: 5,
    comment: "Austeres svaigas, iepakojums perfekts. BURŽUJS ir labākā austerju izvēle Latvijā!",
    date: "2026-04-20",
  },
];

export const categories = ${j(categories)};
`;

fs.writeFileSync(OUT, ts, "utf8");
console.log(`Written ${listings.length} listings from ${sellers.length} sellers`);
console.log("Categories:", categories.join(", "));
