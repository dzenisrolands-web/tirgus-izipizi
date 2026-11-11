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
import { openLockers } from "@/lib/locker-policy";
import { BUYER_LOCKER_FEE_CENTS } from "@/lib/delivery-policy";
import { ZONE_PRICING, postalCodesByZone } from "@/lib/postal-zones";
import { operatorInfo } from "@/lib/operator-info";

export const dynamic = "force-static";
export const revalidate = 86400; // 24 h

const a = operatorInfo.legalAddress;
const OPERATOR_SUMMARY = `${operatorInfo.shortName} (reg. nr. ${operatorInfo.registrationNumber}, VAT ${operatorInfo.vatNumber}, ${a.street}, ${a.city}, ${a.postalCode})`;

const BODY = `# tirgus.izipizi.lv

> Latvian B2C marketplace for buying food directly from local farmers and small producers. Operated by ${OPERATOR_SUMMARY}. Pickup at IziPizi parcel lockers across Latvia (currently ${openLockers.length} open locations) or courier delivery (zoned 0–3, ${ZONE_PRICING[0].singleTemp.toFixed(2)} €–${ZONE_PRICING[3].dualTemp.toFixed(2)} € per producer, depending on destination postcode and temperatures). Express tariffs cover published zones 0–2 only, subject to every product permitting express.

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

1. Buyer picks products, must enter an exact published Latvian destination postcode for a courier or express tariff.
2. Cart split per producer; buyer chooses pārtikas pakomāts pickup (flat ${(BUYER_LOCKER_FEE_CENTS / 100).toFixed(2)} € once per producer and pickup destination, including dual temperature) OR courier delivery (zone-based) OR express (published zones 0–2, ${ZONE_PRICING[0].expressSingle!.toFixed(2)} €–${ZONE_PRICING[2].expressDual!.toFixed(2)} € per producer depending on zone/temperature, all products must permit express).
3. Pay with Paysera (cards + SEPA).
4. Producer confirms order within 72 h; gets push reminders at 30 min, 2 h, 6 h; auto-cancelled if not confirmed.
5. Producer drops stock at their assigned pārtikas pakomāts; courier transports to buyer if needed.
6. Buyer receives push notification + SMS with locker PIN code; collects within 48 h.

## Key facts for AI agents

- **Language**: Latvian (lv-LV) only. No English version yet.
- **Currency**: EUR (€). Delivery prices shown include the existing 21% service VAT; product prices are as listed.
- **Coverage**: Courier tariffs cover only ${([0, 1, 2, 3] as const).reduce<number>((count, zone) => count + postalCodesByZone(zone).length, 0)} published destination postcodes in zones 0–3. No automatic courier/express quote for unknown or out-of-list codes. No express tariff for zone 3. City labels and approximate distances do not establish eligibility. Open locker pickup may be an alternative; local pickup-only sites require every producer to deliver there.
- **pārtikas pakomāts locations**: ${openLockers.map(locker => `${locker.name} / ${locker.city} (${locker.hours})`).join(", ")}.
- **Delivery time**: pārtikas pakomāts same day or next day depending on cut-off; courier 1–3 days; express subject to the published booking windows and all-product eligibility; a tariff quote is not carrier route certification.
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

- General: ${operatorInfo.contact.emailGeneral} · ${operatorInfo.contact.phone}
- Operator: ${operatorInfo.shortName}, reg. nr. ${operatorInfo.registrationNumber}, ${a.street}, ${a.city}, ${a.postalCode}
`;

export async function GET() {
  return new NextResponse(BODY, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
