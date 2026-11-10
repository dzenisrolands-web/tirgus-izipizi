import { getOpenLocker } from "./locker-policy";

/** Published postcode sets and cold-chain NET tariffs, verified by GET
 * https://izipizi.lv/zonas-cenas on 2026-11-10. Nonthermal tariffs do not apply.
 * City labels on that page are not authoritative geocoding; coverage is postcode-only.
 */
export type DeliveryZone = 0 | 1 | 2 | 3;
export const COLD_CHAIN_NET_CENTS = {
  0: { courier: { single: 640, dual: 730 }, express: { single: 750, dual: 850 } },
  1: { courier: { single: 640, dual: 730 }, express: { single: 900, dual: 1000 } },
  2: { courier: { single: 840, dual: 930 }, express: { single: 1250, dual: 1350 } },
  3: { courier: { single: 990, dual: 1090 }, express: null },
} as const;

export type ZonePricing = {
  zone: DeliveryZone;
  area: string;
  cities: string;
  singleTemp: number;
  dualTemp: number;
  expressSingle: number | null;
  expressDual: number | null;
};

// UI values are gross EUR; all actual quotes use integer-cent NET tariffs above.
export const ZONE_PRICING = Object.fromEntries(
  ([0, 1, 2, 3] as const).map(zone => {
    const tariff = COLD_CHAIN_NET_CENTS[zone];
    const gross = (net: number) => Math.round(net * 121 / 100) / 100;
    return [zone, {
      zone, area: `Pasta indeksu zona ${zone}`, cities: "Pārbaudi pasta indeksu",
      singleTemp: gross(tariff.courier.single), dualTemp: gross(tariff.courier.dual),
      expressSingle: tariff.express ? gross(tariff.express.single) : null,
      expressDual: tariff.express ? gross(tariff.express.dual) : null,
    }];
  })
) as Record<DeliveryZone, ZonePricing>;

// Pasta indeksu saraksti pa zonām
const ZONE_0_CODES = [1001, 1002, 1003, 1004, 1009, 1010, 1011, 1012, 1013, 1019, 1045, 1046, 1048, 1050];
const ZONE_1_CODES = [1005, 1006, 1007, 1014, 1015, 1021, 1023, 1024, 1026, 1029, 1034, 1035, 1039, 1053, 1055, 1057, 1058, 1063, 1064, 1067, 1069, 1073, 1076, 1079, 1082, 1083, 1084, 2101, 2108, 2111, 2112, 2119, 2128, 2130, 2167];
const ZONE_2_CODES = [1016, 1030, 2103, 2107, 2114, 2117, 2118, 2121, 2123, 2127, 2137, 2163, 2164, 2166, 2169];
const ZONE_3_CODES = [2008, 2010, 2011, 2012, 2015, 2016, 2105, 5001, 5015, 5016, 5041, 5052, 5060, 5070, 5071];

// "Pārējā Latvija" — pasta indeksi ārpus standarta zonām.
// Šajos indeksos kurjers/ekspres NAV pieejami, tikai pakomāts.
// Atdalīta kā atsevišķa grupa (nevis zona) — netiek izmantota cenu aprēķinā.
export const OUTSIDE_ZONES_CODES = [
  2113, 2124, 2125, 2133, 2135, 2142, 2144, 2145, 2151, 2152, 2154, 2160, 2161, 2162, 2170,
  3001, 3002, 3003, 3004, 3007, 3008, 3011, 3014, 3016, 3017, 3018, 3020, 3021, 3022, 3023, 3026, 3028, 3031, 3034, 3036, 3037, 3040, 3042, 3043, 3045,
  3101, 3104, 3110, 3113, 3118, 3119, 3120, 3122, 3123, 3124, 3128, 3129, 3131, 3132, 3133, 3134, 3135, 3137, 3139, 3140, 3142, 3145, 3146, 3147, 3148,
  3201, 3251, 3253, 3257, 3258, 3260, 3261, 3262, 3264, 3270, 3275, 3280, 3281, 3283, 3284, 3285, 3287, 3291, 3292, 3294, 3297, 3298,
  3301, 3306, 3307, 3309, 3310, 3312, 3313, 3314, 3317, 3319, 3320, 3321, 3322, 3323, 3324, 3325, 3326, 3328, 3329, 3330, 3332, 3333,
  3401, 3402, 3405, 3407, 3411, 3414, 3416, 3430, 3431, 3433, 3434, 3435, 3436, 3438, 3440, 3441, 3442, 3443, 3444, 3445, 3446, 3447, 3452, 3453, 3455, 3456, 3457, 3461, 3463, 3466, 3473, 3474, 3475, 3476, 3477, 3480, 3482, 3484, 3485, 3486, 3487,
  3601, 3602, 3612, 3613, 3614, 3615, 3617, 3619, 3620, 3621, 3623, 3624, 3626, 3627,
  3701, 3708, 3709, 3710, 3711, 3713, 3714, 3716, 3717, 3718, 3719, 3721, 3722, 3723, 3724, 3725, 3729, 3730, 3731, 3732,
  3801, 3851, 3852, 3853, 3861, 3862, 3871, 3873, 3875, 3876, 3880, 3882, 3883, 3890, 3891, 3892, 3893, 3894, 3895, 3896, 3897, 3898, 3899,
  3901, 3905, 3906, 3907, 3908, 3910, 3913, 3914, 3915, 3917, 3918, 3921, 3924, 3925, 3926, 3927, 3929, 3931, 3932, 3933, 3936,
  4001, 4004, 4010, 4011, 4012, 4013, 4020, 4022, 4023, 4025, 4033, 4035, 4043, 4050, 4052, 4054, 4061, 4062, 4063, 4064, 4068,
  4101, 4108, 4110, 4112, 4113, 4116, 4118, 4119, 4122, 4123, 4125, 4126, 4128, 4129, 4131, 4132, 4133, 4136, 4139, 4141, 4142, 4143, 4144, 4146, 4151, 4152, 4154,
  4201, 4206, 4208, 4210, 4211, 4213, 4215, 4216, 4219, 4220, 4222, 4223, 4224, 4227, 4228, 4232, 4234, 4240, 4241, 4242, 4244, 4245, 4247, 4248,
  4301, 4332, 4333, 4334, 4335, 4336, 4337, 4339, 4340, 4341, 4342, 4344, 4345, 4348, 4350, 4351, 4352, 4354, 4355, 4358, 4359,
  4401, 4405, 4406, 4409, 4410, 4412, 4415, 4416, 4417, 4420, 4421, 4424, 4425, 4426, 4428, 4429,
  4501, 4561, 4562, 4566, 4567, 4570, 4571, 4572, 4573, 4574, 4576, 4577, 4580, 4582, 4583, 4584, 4585, 4586, 4587, 4590, 4591, 4592, 4594, 4595,
  4601, 4604, 4611, 4612, 4614, 4615, 4616, 4617, 4618, 4619, 4621, 4622, 4623, 4624, 4625, 4626, 4627, 4628, 4630, 4631, 4633, 4634, 4635, 4636, 4638, 4640, 4641, 4642, 4643, 4645, 4647, 4648, 4649, 4650, 4652,
  4701, 4706, 4707, 4708, 4711, 4712, 4713, 4715, 4716, 4718, 4723, 4724, 4726, 4727, 4728, 4729, 4730, 4731, 4733, 4735,
  4801, 4824, 4825, 4826, 4828, 4830, 4833, 4834, 4835, 4836, 4837, 4838, 4840, 4841, 4844, 4846, 4847, 4852, 4853, 4855, 4860, 4862, 4863, 4865, 4870, 4871, 4873, 4884,
  5011, 5012, 5020, 5022, 5033, 5044, 5045, 5047, 5062, 5064, 5065,
  5101, 5106, 5108, 5109, 5110, 5111, 5112, 5113, 5115, 5118, 5120, 5123, 5124, 5125, 5128, 5129, 5130, 5133, 5134, 5135,
  5201, 5202, 5204, 5208, 5209, 5210, 5211, 5212, 5214, 5215, 5216, 5217, 5218, 5220, 5221, 5222, 5223, 5224, 5226, 5228, 5229, 5230, 5232, 5236, 5237, 5238, 5239,
  5301, 5304, 5305, 5311, 5312, 5315, 5316, 5318, 5320, 5323, 5325, 5326, 5327, 5328, 5329, 5330, 5331, 5333, 5334, 5335, 5337,
  5401, 5404, 5410, 5412, 5413, 5414, 5417, 5422, 5438, 5439, 5440, 5441, 5442, 5443, 5444, 5447, 5449, 5450, 5451, 5456, 5458, 5459, 5460, 5461, 5462, 5463, 5465, 5469, 5470, 5471, 5473, 5474, 5477, 5481,
  5601, 5651, 5652, 5653, 5655, 5656, 5660, 5662, 5664, 5666, 5668, 5671, 5674, 5676, 5677, 5680, 5681, 5685, 5687, 5692, 5695, 5696, 5697, 5698,
  5701, 5704, 5705, 5706, 5707, 5708, 5709, 5711, 5716, 5717, 5719, 5722, 5725, 5726, 5729, 5730, 5733, 5735, 5736, 5737, 5739, 5740, 5742, 5745, 5748, 5750, 5751, 5752,
];

const OUTSIDE_ZONES_SET = new Set(OUTSIDE_ZONES_CODES);

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

export function isOutsideZones(code: number): boolean {
  return OUTSIDE_ZONES_SET.has(code);
}

// Pakomāta zonas — kurā piegādes zonā atrodas pats pakomāts (kurjeram nozīmīgi).
// Kurjera cena = MAX(pakomāta zona, pircēja zona) — dārgākā galapunkta zona nosaka cenu.
export const LOCKER_ZONES: Record<string, DeliveryZone> = {
  brivibas:   0, // Rīgas centrs (Brīvības 253)
  agenskalna: 1, // Rīga, Āgenskalns
  salaspils:  1, // Salaspils
  ikskile:    3, // Ikšķile (reģionālā)
  dundaga:    3, // Dundaga (reģionālā, kurjēra vajadzībām)
  iukstes:    1, // Rīga, Ilūkstes iela (Vidzemes prieċp.
  sigulda:    3, // Sigulda (reģionālā)
};

/**
 * Compute the effective courier zone: MAX of seller's drop-off zone and buyer's zone.
 * Buyer zone is mandatory; unknown sender falls back to verified buyer zone.
 */
export function effectiveCourierZone(
  sellerLockerId: string | null | undefined,
  buyerZone: DeliveryZone | null | undefined,
): DeliveryZone | null {
  const sellerZone = sellerLockerId && getOpenLocker(sellerLockerId) ? LOCKER_ZONES[sellerLockerId] : undefined;
  if (sellerZone === undefined && (buyerZone === null || buyerZone === undefined)) return null;
  if (sellerZone === undefined) return buyerZone ?? null;
  if (buyerZone === null || buyerZone === undefined) return null;
  return (Math.max(sellerZone, buyerZone) as DeliveryZone);
}

/**
 * Pricing for a given zone (helper for callers that only have the zone number).
 */
export function pricingForZone(zone: DeliveryZone | null): ZonePricing | null {
  if (zone === null) return null;
  return ZONE_PRICING[zone];
}

export type LookupResult =
  | { found: true; zone: DeliveryZone; pricing: ZonePricing; code: number; place: string; nearestLockers: NearestLocker[] }
  | { found: false; reason: "invalid_format" | "outside_zones" | "not_in_zone"; code?: number; nearestLockers?: NearestLocker[] };

export type NearestLocker = {
  id: string;
  name: string;
  city: string;
  address: string;
  hours: string;
  distanceKm: number;
};

/** No authoritative postcode geocoding is bundled. Do not invent places or distances. */
export function placeForCode(code: number, _zone: DeliveryZone): string {
  void _zone;
  return `LV-${code}`;
}

export function nearestLockersForCode(_code: number, _zone: DeliveryZone, _limit = 3): NearestLocker[] {
  void _code;
  void _zone;
  void _limit;
  return [];
}

/**
 * Search for a postal code's zone.
 * Accepts: "1010", "LV-1010", "LV1010", " 1010 ", etc.
 */
export function lookupPostalCode(input: string): LookupResult {
  const match = /^(?:LV-?)?([0-9]{4})$/i.exec(input.trim());
  if (!match) return { found: false, reason: "invalid_format" };
  const code = parseInt(match[1], 10);
  if (isNaN(code) || code < 1000 || code > 9999) {
    return { found: false, reason: "invalid_format" };
  }
  const zone = POSTAL_CODE_ZONE.get(code);
  if (zone === undefined) {
    // Either explicitly known to be outside zones, or unknown code
    if (OUTSIDE_ZONES_SET.has(code)) {
      // Coverage data is not a geographic origin for distance suggestions.
      return {
        found: false,
        reason: "outside_zones",
        code,
        nearestLockers: nearestLockersForCode(code, 3),
      };
    }
    return { found: false, reason: "not_in_zone", code };
  }
  return {
    found: true,
    zone,
    pricing: ZONE_PRICING[zone],
    code,
    place: placeForCode(code, zone),
    nearestLockers: nearestLockersForCode(code, zone),
  };
}
