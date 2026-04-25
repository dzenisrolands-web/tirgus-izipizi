import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import { sellers as mockSellers, listings as mockListings } from "../lib/mock-data";
import { sellersMeta } from "../lib/sellers-meta";

// Load .env.local
try {
  const env = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
  for (const line of env.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch {}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SECRET_KEY!;

if (!url || !serviceKey) {
  console.error("Nav NEXT_PUBLIC_SUPABASE_URL vai SUPABASE_SECRET_KEY .env.local failā");
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

async function main() {
  // Notīrām tabulas pirms importēšanas
  console.log("Notīra vecos ierakstus...");
  await supabase.from("listings").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("sellers").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  console.log("Notīrīts.\n");

  console.log("Importē ražotājus...\n");
  const sellerIdMap: Record<string, string> = {};

  for (const seller of mockSellers) {
    const meta = sellersMeta[seller.id];

    const { data, error } = await supabase
      .from("sellers")
      .insert({
        slug:             seller.id,
        name:             seller.name,
        description:      meta?.description ?? "",
        short_desc:       meta?.shortDesc ?? "",
        logo_url:         seller.avatar,
        cover_url:        meta?.cover ?? "",
        location:         seller.location,
        website:          meta?.website ?? null,
        facebook:         meta?.facebook ?? null,
        instagram:        meta?.instagram ?? null,
        youtube_video_id: meta?.youtubeVideoId ?? null,
        quote_text:       meta?.quote?.text ?? null,
        quote_author:     meta?.quote?.author ?? null,
        rating:           seller.rating,
        review_count:     seller.reviewCount,
        verified:         seller.verified,
        status:           "approved",
      })
      .select("id, slug")
      .single();

    if (error) {
      console.error(`KĻŪDA ${seller.name}: ${error.message}`);
    } else if (data) {
      sellerIdMap[data.slug] = data.id;
      console.log(`OK  ${seller.name}  →  ${data.id}`);
    }
  }

  const found = Object.keys(sellerIdMap).length;
  console.log(`\nAtrasti/insertēti ${found} pārdevāji.\n`);

  if (found === 0) {
    console.error("Nav pārdevāju — produktus nevar importēt. Pārbaud kļūdas augstāk.");
    process.exit(1);
  }

  console.log(`Importē ${mockListings.length} produktus...\n`);

  let ok = 0;
  let fail = 0;

  for (const listing of mockListings) {
    const sellerId = sellerIdMap[listing.sellerId];
    if (!sellerId) {
      console.warn(`Nav ražotāja "${listing.sellerId}", izlaist ${listing.id}`);
      fail++;
      continue;
    }

    const { error } = await supabase
      .from("listings")
      .insert({
        slug:           listing.id,
        seller_id:      sellerId,
        user_id:        null,
        title:          listing.title,
        description:    listing.description,
        price:          listing.price,
        unit:           listing.unit,
        category:       listing.category,
        image_url:      listing.image,
        locker_id:      listing.lockerId,
        quantity:       listing.quantity,
        freshness_date: listing.freshnessDate,
        status:         "active",
      });

    if (error) {
      console.error(`KĻŪDA "${listing.title}": ${error.message}`);
      fail++;
    } else {
      ok++;
      process.stdout.write(".");
    }
  }

  console.log(`\n\nGatavs! ${ok} produkti importēti, ${fail} kļūdas.`);
}

main().catch(console.error);
