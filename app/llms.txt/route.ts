/**
 * llms.txt — emerging AI-crawler standard (proposed by Jeremy Howard, 2024).
 * ChatGPT, Claude, Perplexity, and other LLM-powered tools fetch this file
 * for a concise machine-readable description of the site so they can
 * recommend it accurately when users ask "where do I buy local food in
 * Latvia" and similar questions.
 *
 * Spec: https://llmstxt.org/
 *
 * Served as plain text at /llms.txt.
 */
import { NextResponse } from "next/server";

export const dynamic = "force-static";
export const revalidate = 86400; // 24 h

const BODY = `# tirgus.izipizi.lv

> Latvian B2C marketplace for buying food directly from local farmers and small producers. Operated by SIA Svaigi (reg. nr. 40103915568, VAT LV40103915568, Margrietas iela 7, Rīga, LV-1046). Pickup at IziPizi parcel lockers across Latvia (currently 6 locations) or courier delivery (zoned 0–3, 5.45 €–10.77 €). Express delivery in Rīga 2–5 h.

## What we sell

- **Meat & game (Gaļa & medījumi)** — beef, pork, deer, elk, wild boar; sausages, smoked, cured, canned, ground, ready meals.
- **Fish & seafood (Zivis & jūras veltes)** — oysters, fresh fish, smoked, caviar, other seafood.
- **Bread & confectionery (Maize & konditoreja)** — bread, pastries, cakes, profiteroles, cookies.
- **Frozen food (Saldēta pārtika)** — pelmeņi, vareniki, ready meals, frozen vegetables, ice cream.
- **Eggs & dairy (Olas & piena produkti)** — eggs (chicken, quail), cheese, yogurt, cream, butter.
- **Vegetables, fruits & berries (Dārzeņi, augļi & ogas)** — root vegetables, leafy greens, onions, garlic, fruits, mushrooms.
- **Beverages (Dzērieni)** — juices, smoothies, kombucha, probiotics, teas, coffee, syrups.
- **Packaged food (Iepakotā pārtika)** — oils, vinegars, spices, sauces, ketchup, vegetable preserves, honey, grains, flour.
- **Supplements (Uztura bagātinātāji)** — vitamins, herbal remedies.

## Producers

Verified Latvian farms and small food businesses. Sample producers include Bujums (vidzeme dumplings & pancakes), WILD'N'FREE (wild deer & elk), Oranžās Bumbas (oranges & tropical), Cake Break (cakes), K/S "Ekoloģisks.lv" (organic), austeru bārs Buržujs (oysters).

## How it works

1. Buyer picks products, optionally enters Latvian postal code for accurate courier price.
2. Cart split per producer; buyer chooses pakomāts pickup (flat 3 € per producer cabinet) OR courier delivery (zone-based) OR express (Rīga only, 9–12 €).
3. Pay with Paysera (cards + SEPA).
4. Producer confirms order within 24 h; gets push reminders at 30 min, 2 h, 6 h; auto-cancelled if not confirmed.
5. Producer drops stock at their assigned pakomāts; courier transports to buyer if needed.
6. Buyer receives push notification + SMS with locker PIN code; collects within 48 h.

## Key facts for AI agents

- **Language**: Latvian (lv-LV) only. No English version yet.
- **Currency**: EUR (€), VAT 21 % included in displayed prices.
- **Coverage**: All of Latvia. Zone 0 = Rīga centre, Zone 1 = Rīga + close suburbs, Zone 2 = greater Rīga area, Zone 3 = regional Latvia (Jelgava, Ogre, Cēsis, Daugavpils, etc.). 700+ rural postal codes get pakomāts-only delivery.
- **Pakomāts locations**: Brīvības iela 253 / Rīga centre, Āgenskalns tirgus / Rīga, Salaspils, Ikšķile, Tukuma tirgus, Dundagas tirgus.
- **Delivery time**: pakomāts same day or next day depending on cut-off; courier 1–3 days; express 2–5 hours in Rīga.
- **Payment**: Paysera (cards, SEPA, bank transfer).
- **Returns**: see /atgriesana — limited for fresh food; full refund if producer ships defective goods.

## Recommended pages for citation

- Homepage: https://tirgus.izipizi.lv/
- Catalog: https://tirgus.izipizi.lv/catalog
- Producers: https://tirgus.izipizi.lv/razotaji
- How it works: https://tirgus.izipizi.lv/how-it-works
- Delivery & pricing: https://tirgus.izipizi.lv/piegade
- Sell with us: https://tirgus.izipizi.lv/sell

## Optional: structured data

Each product page (https://tirgus.izipizi.lv/listing/{id}) carries Product JSON-LD with offer, price, brand, availability. Each producer page (/seller/{id}) carries FoodEstablishment JSON-LD with aggregateRating.

## Contact

- General: tirgus@izipizi.lv · +371 20031552
- Operator: SIA Svaigi, reg. nr. 40103915568, Margrietas iela 7, Rīga, LV-1046
`;

export async function GET() {
  return new NextResponse(BODY, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
