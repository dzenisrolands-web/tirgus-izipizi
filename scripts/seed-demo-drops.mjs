/**
 * Insert demo bulletin board drops (Sludinājumu dēlis) into Supabase.
 * Uses existing approved sellers + locker IDs.
 *
 * Usage:
 *   node scripts/seed-demo-drops.mjs        — insert 8 demo drops
 *   node scripts/seed-demo-drops.mjs --clean — first delete demo drops, then insert
 *
 * Demo drops are tagged in description with "(DEMO)" so they can be cleaned up later.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// ── Load .env.local ──
const envPath = join(dirname(fileURLToPath(import.meta.url)), "..", ".env.local");
try {
  const envText = readFileSync(envPath, "utf8");
  for (const line of envText.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {
  console.error(`Could not read ${envPath}`);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const clean = process.argv.includes("--clean");

const LOCKERS = ["brivibas", "agenskalna", "salaspils", "tukums", "dundaga", "ikskile"];

// Demo drops with realistic Latvian content
const DEMOS = [
  {
    title: "Pelmeņi vegānie 400g",
    description: "(DEMO) Tikko gatavoti vegānie pelmeņi ar burkānu un kāpostu pildījumu. Saldēti uz vietas. 400g iepak.",
    category: "Saldēta pārtika",
    unit: "gab.",
    priceCents: 400,
    totalQty: 10,
    sold: 2,
    temp: "frozen",
    location: "Tīnūžu tirgus",
    expireH: 6,
    cover: "https://images.unsplash.com/photo-1576675466766-aa8e10b5d9ed?w=800",
  },
  {
    title: "Brieža steiks 300g",
    description: "(DEMO) Svaigs brieža steiks no Vidzemes mežiem. Ideāli grilam vai pannai. 300g vakuuma iepak.",
    category: "Gaļa",
    unit: "gab.",
    priceCents: 1250,
    totalQty: 5,
    sold: 1,
    temp: "chilled",
    location: "manā fermā Vidzemē",
    expireH: 12,
    cover: "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=800",
  },
  {
    title: "Mājas paipalu olas 30 gab.",
    description: "(DEMO) Bioloģiski audzētas paipalas. Olas uztaisītas šodienā. 30 gab. iepakojumā.",
    category: "Olas",
    unit: "iepak.",
    priceCents: 550,
    totalQty: 8,
    sold: 0,
    temp: "chilled",
    location: "Salaspils tirgus",
    expireH: 8,
    cover: "https://images.unsplash.com/photo-1569288063643-5d29ad6deb24?w=800",
  },
  {
    title: "Tīrradzes medus 0.5L",
    description: "(DEMO) Šī gada vasaras medus no manas dravas. Burka 500ml. Bez piedevām, tīrs, dabīgs.",
    category: "Konservi",
    unit: "burka",
    priceCents: 600,
    totalQty: 12,
    sold: 4,
    temp: "chilled",
    location: "manā saimniecībā",
    expireH: 48,
    cover: "https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800",
  },
  {
    title: "Bioloģiskie kartupeļi 5kg",
    description: "(DEMO) Šķirne Gala. Audzēti bez ķīmijas. 5kg iepakojumā. Ideāli vārīšanai un cepšanai.",
    category: "Dārzeņi",
    unit: "iepak.",
    priceCents: 395,
    totalQty: 15,
    sold: 3,
    temp: "chilled",
    location: "Cēsu novads",
    expireH: 24,
    cover: "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=800",
  },
  {
    title: "Saldēti spinātu plāceņi 6 gab.",
    description: "(DEMO) Roku darbs, ātri sasaldēti. Bez glutēna. Pagatavošana — atlaidināt 30min, apcept pannā.",
    category: "Saldēta pārtika",
    unit: "iepak.",
    priceCents: 600,
    totalQty: 6,
    sold: 1,
    temp: "frozen",
    location: "Suntažu pagasts",
    expireH: 16,
    cover: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800",
  },
  {
    title: "Kūpināta cūkgaļa 500g",
    description: "(DEMO) Tradicionāli kūpināta cūkgaļa. Vakuuma iepak. 500g. Ideāli sviestmaizēm.",
    category: "Gaļa",
    unit: "iepak.",
    priceCents: 950,
    totalQty: 7,
    sold: 2,
    temp: "chilled",
    location: "Tukuma tirgus",
    expireH: 36,
    cover: "https://images.unsplash.com/photo-1602030638412-bb8dcc0bc8b0?w=800",
  },
  {
    title: "Sieri ar zaļumiem 250g",
    description: "(DEMO) Mājražots siers ar svaigiem dilles un sīpoliem. 250g. Glabāšanas termiņš 5 dienas.",
    category: "Konditorija",
    unit: "iepak.",
    priceCents: 480,
    totalQty: 9,
    sold: 0,
    temp: "chilled",
    location: "Bauskas piensaimniecība",
    expireH: 10,
    cover: "https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=800",
  },
];

async function main() {
  // Optionally clean previous demo drops
  if (clean) {
    console.log("🧹 Removing previous DEMO drops...");
    const { error, count } = await supabase
      .from("hot_drops")
      .delete({ count: "exact" })
      .like("description", "%(DEMO)%");
    if (error) console.error("Clean failed:", error);
    else console.log(`   Removed ${count ?? 0} drops.\n`);
  }

  // Get approved sellers
  const { data: sellers, error: sErr } = await supabase
    .from("sellers")
    .select("id, user_id, name, farm_name")
    .eq("status", "approved")
    .limit(10);

  if (sErr || !sellers || sellers.length === 0) {
    console.error("No approved sellers found. Approve at least 1 seller first.");
    if (sErr) console.error(sErr);
    process.exit(1);
  }

  // Need a fallback user_id for sellers without one (legacy migrated data)
  const { data: usersResp } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
  const fallbackUserId = usersResp?.users?.[0]?.id ?? null;

  if (!fallbackUserId) {
    console.error("No auth users found. Register at least one user (admin) first.");
    process.exit(1);
  }

  const sellersWithUser = sellers.map((s) => ({
    ...s,
    effective_user_id: s.user_id ?? fallbackUserId,
  }));

  console.log(`📋 Found ${sellers.length} approved sellers:`);
  sellersWithUser.forEach((s) => {
    const marker = s.user_id ? "" : " (using fallback user)";
    console.log(`   - ${s.name} (${s.id})${marker}`);
  });
  console.log(`\n🔑 Fallback user_id: ${fallbackUserId}\n`);

  // Insert drops, distributing across sellers + lockers
  const inserted = [];
  for (let i = 0; i < DEMOS.length; i++) {
    const d = DEMOS[i];
    const seller = sellersWithUser[i % sellersWithUser.length];
    const locker = LOCKERS[i % LOCKERS.length];
    const postedAt = new Date(Date.now() - Math.random() * 6 * 3600 * 1000).toISOString();
    const expiresAt = new Date(Date.now() + d.expireH * 3600 * 1000).toISOString();

    const { data, error } = await supabase
      .from("hot_drops")
      .insert({
        seller_id: seller.id,
        user_id: seller.effective_user_id,
        title: d.title,
        description: d.description,
        category: d.category,
        unit: d.unit,
        price_cents: d.priceCents,
        total_quantity: d.totalQty,
        reserved_quantity: 0,
        sold_quantity: d.sold,
        pickup_locker_id: locker,
        temperature_zone: d.temp,
        expires_at: expiresAt,
        cover_image_url: d.cover,
        location_text: d.location,
        posted_at: postedAt,
        status: "active",
        published_at: postedAt,
      })
      .select("id, title")
      .single();

    if (error) {
      console.error(`✗ ${d.title}:`, error.message);
    } else {
      inserted.push(data);
      console.log(`✓ ${data.title} → ${seller.name} @ ${locker}`);
    }
  }

  console.log(`\n✨ Done. Inserted ${inserted.length} demo drops.\n`);
  console.log(`Atver: http://localhost:3000/keriens`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
