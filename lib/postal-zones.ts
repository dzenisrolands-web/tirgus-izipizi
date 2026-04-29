/**
 * Pasta indeksu → piegādes zonu datu mape.
 * Avots: izipizi.lv/zonas-cenas (atjaunināts 2026-04-29)
 *
 * Cenas ar PVN 21%. Atjaunināt manuāli, ja izipizi maina cenas vai zonu sastāvu.
 */

export type DeliveryZone = 0 | 1 | 2 | 3;

export type ZonePricing = {
  zone: DeliveryZone;
  area: string;
  cities: string;
  singleTemp: number;
  dualTemp: number;
  expressSingle: number | null;
  expressDual: number | null;
};

export const ZONE_PRICING: Record<DeliveryZone, ZonePricing> = {
  0: {
    zone: 0,
    area: "Rīgas centrs",
    cities: "Rīga (centrs)",
    singleTemp: 5.45,
    dualTemp: 8.83,
    expressSingle: 6.66,
    expressDual: 10.29,
  },
  1: {
    zone: 1,
    area: "Rīgas mikrorajoni + tuvākā Pierīga",
    cities: "Imanta, Pļavnieki, Mežaparks, Jugla, Salaspils, Stopiņi",
    singleTemp: 6.66,
    dualTemp: 8.83,
    expressSingle: 10.89,
    expressDual: 12.10,
  },
  2: {
    zone: 2,
    area: "Tālākā Pierīga",
    cities: "Mārupe, Olaine, Babīte, Saulkrasti, Ādaži, Carnikava",
    singleTemp: 9.08,
    dualTemp: 11.25,
    expressSingle: 15.13,
    expressDual: 16.34,
  },
  3: {
    zone: 3,
    area: "Reģionālā Latvija",
    cities: "Jelgava, Tukums, Ogre, Sigulda, Cēsis, Daugavpils, Valmiera",
    singleTemp: 10.77,
    dualTemp: 13.19,
    expressSingle: null,
    expressDual: null,
  },
};

// Pasta indeksu saraksti pa zonām
const ZONE_0_CODES = [1001, 1002, 1003, 1004, 1009, 1010, 1011, 1012, 1013, 1019, 1045, 1046, 1048, 1050];
const ZONE_1_CODES = [1005, 1006, 1007, 1014, 1015, 1021, 1023, 1024, 1026, 1029, 1034, 1035, 1039, 1053, 1055, 1057, 1058, 1063, 1064, 1067, 1069, 1073, 1076, 1079, 1082, 1083, 1084, 2101, 2108, 2111, 2112, 2119, 2128, 2130, 2167];
const ZONE_2_CODES = [1016, 1030, 2103, 2107, 2114, 2117, 2118, 2121, 2123, 2127, 2137, 2163, 2164, 2166, 2169];
const ZONE_3_CODES = [2008, 2010, 2011, 2012, 2015, 2016, 2105, 5001, 5015, 5016, 5041, 5052, 5060, 5070, 5071];

const POSTAL_CODE_ZONE: Map<number, DeliveryZone> = new Map();
for (const c of ZONE_0_CODES) POSTAL_CODE_ZONE.set(c, 0);
for (const c of ZONE_1_CODES) POSTAL_CODE_ZONE.set(c, 1);
for (const c of ZONE_2_CODES) POSTAL_CODE_ZONE.set(c, 2);
for (const c of ZONE_3_CODES) POSTAL_CODE_ZONE.set(c, 3);

export function postalCodesByZone(zone: DeliveryZone): number[] {
  if (zone === 0) return ZONE_0_CODES;
  if (zone === 1) return ZONE_1_CODES;
  if (zone === 2) return ZONE_2_CODES;
  return ZONE_3_CODES;
}

export type LookupResult =
  | { found: true; zone: DeliveryZone; pricing: ZonePricing; code: number }
  | { found: false; reason: "invalid_format" | "not_in_zone"; code?: number };

/**
 * Search for a postal code's zone.
 * Accepts: "1010", "LV-1010", "LV1010", " 1010 ", etc.
 */
export function lookupPostalCode(input: string): LookupResult {
  const cleaned = input.replace(/[^0-9]/g, "");
  if (cleaned.length !== 4) return { found: false, reason: "invalid_format" };
  const code = parseInt(cleaned, 10);
  if (isNaN(code) || code < 1000 || code > 9999) {
    return { found: false, reason: "invalid_format" };
  }
  const zone = POSTAL_CODE_ZONE.get(code);
  if (zone === undefined) return { found: false, reason: "not_in_zone", code };
  return { found: true, zone, pricing: ZONE_PRICING[zone], code };
}
