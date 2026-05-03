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
    expressSingle: 9.08,
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

// "Pārējā Latvija" — pasta indeksi ārpus standarta zonām.
// Šajos indeksos kurjers/ekspres NAV pieejami, tikai pakomāts.
// Atdalīta kā atsevišķa grupa (nevis zona) — netiek izmantota cenu aprēķinā.
export const OUTSIDE_ZONES_CODES = [
  2113, 2124, 2125, 2133, 2135, 2136, 2140, 2141, 2142, 2144, 2145, 2150, 2151, 2152, 2154, 2160, 2161, 2162, 2170,
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
  tukums:     3, // Tukums (reģionālā, kurjera vajadzībām)
  dundaga:    3, // Dundaga (reģionālā, kurjera vajadzībām)
};

/**
 * Compute the effective courier zone: MAX of seller's drop-off zone and buyer's zone.
 * Returns null if either is unknown.
 */
export function effectiveCourierZone(
  sellerLockerId: string | null | undefined,
  buyerZone: DeliveryZone | null | undefined,
): DeliveryZone | null {
  const sellerZone = sellerLockerId ? LOCKER_ZONES[sellerLockerId] : undefined;
  if (sellerZone === undefined && (buyerZone === null || buyerZone === undefined)) return null;
  if (sellerZone === undefined) return buyerZone ?? null;
  if (buyerZone === null || buyerZone === undefined) return sellerZone;
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

// Locker geographic coordinates (WGS84, approximate)
const LOCKER_COORDS: Record<string, { lat: number; lng: number; name: string; city: string; address: string; hours: string }> = {
  brivibas:   { lat: 56.9716, lng: 24.1404, name: "Brīvības iela 253",   city: "Rīga",      address: "Brīvības iela 253 / NESTE",   hours: "24/7" },
  agenskalna: { lat: 56.9377, lng: 24.0859, name: "Āgenskalna tirgus",   city: "Rīga",      address: "Nometņu iela 64 / Tirgus",    hours: "24/7" },
  salaspils:  { lat: 56.8651, lng: 24.3526, name: "Salaspils",            city: "Salaspils", address: "Zviedru iela 1C / NESTE",     hours: "24/7" },
  ikskile:    { lat: 56.8359, lng: 24.5026, name: "Ikšķile",              city: "Ikšķile",   address: "Daugavas iela 63 / Labumu bode", hours: "10:00–20:00" },
  tukums:     { lat: 56.9692, lng: 23.1611, name: "Tukuma tirgus",        city: "Tukums",    address: "J. Raiņa iela 30 / Tirgus",   hours: "24/7" },
  dundaga:    { lat: 57.5074, lng: 22.3506, name: "Dundagas tirgus",      city: "Dundaga",   address: "Pils 3B / Tirgus",            hours: "24/7" },
};

// Approximate centroid + place name for each postal code.
// Codes not listed fall back to zone centroid + zone area name.
const POSTAL_DATA: Record<number, { lat: number; lng: number; place: string }> = {
  // Zone 0 — Rīgas centrs
  1001: { lat: 56.951, lng: 24.106, place: "Rīga, Vecrīga" },
  1002: { lat: 56.948, lng: 24.105, place: "Rīga, Centrs" },
  1003: { lat: 56.949, lng: 24.108, place: "Rīga, Centrs" },
  1004: { lat: 56.952, lng: 24.111, place: "Rīga, Centrs" },
  1009: { lat: 56.946, lng: 24.118, place: "Rīga, Centrs" },
  1010: { lat: 56.950, lng: 24.119, place: "Rīga, Centrs" },
  1011: { lat: 56.953, lng: 24.124, place: "Rīga, Grīziņkalns" },
  1012: { lat: 56.950, lng: 24.130, place: "Rīga, Avoti" },
  1013: { lat: 56.961, lng: 24.121, place: "Rīga, Skanste" },
  1019: { lat: 56.954, lng: 24.099, place: "Rīga, Centrs" },
  1045: { lat: 56.955, lng: 24.103, place: "Rīga, Centrs" },
  1046: { lat: 56.943, lng: 24.092, place: "Rīga, Āgenskalns (centrs)" },
  1048: { lat: 56.947, lng: 24.103, place: "Rīga, Centrs" },
  1050: { lat: 56.945, lng: 24.110, place: "Rīga, Vecrīga / Rātslaukums" },
  // Zone 1
  1005: { lat: 56.965, lng: 24.130, place: "Rīga, Mežaparks" },
  1006: { lat: 56.967, lng: 24.140, place: "Rīga, Mežaparks" },
  1007: { lat: 56.952, lng: 24.090, place: "Rīga, Āgenskalns" },
  1014: { lat: 56.959, lng: 24.142, place: "Rīga, Teika" },
  1015: { lat: 56.965, lng: 24.155, place: "Rīga, Brasa / Jugla" },
  1021: { lat: 56.984, lng: 24.179, place: "Rīga, Jugla" },
  1023: { lat: 56.961, lng: 24.198, place: "Rīga, Pļavnieki" },
  1024: { lat: 56.953, lng: 24.207, place: "Rīga, Pļavnieki" },
  1026: { lat: 56.926, lng: 24.156, place: "Rīga, Ķengarags" },
  1029: { lat: 56.910, lng: 24.190, place: "Rīga, Ķengarags" },
  1034: { lat: 56.978, lng: 24.040, place: "Rīga, Imanta" },
  1035: { lat: 56.982, lng: 24.030, place: "Rīga, Imanta" },
  1039: { lat: 56.920, lng: 24.075, place: "Rīga, Iļģuciems" },
  1053: { lat: 56.935, lng: 24.085, place: "Rīga, Āgenskalns" },
  1055: { lat: 56.913, lng: 24.030, place: "Rīga, Bolderāja" },
  1057: { lat: 56.910, lng: 24.060, place: "Rīga, Ziepniekkalns" },
  1058: { lat: 56.892, lng: 24.090, place: "Rīga, Ziepniekkalns" },
  1063: { lat: 56.926, lng: 24.169, place: "Rīga, Maskavas forštate" },
  1064: { lat: 56.918, lng: 24.180, place: "Rīga, Maskavas forštate" },
  1067: { lat: 56.900, lng: 24.041, place: "Rīga, Bolderāja" },
  1069: { lat: 56.967, lng: 24.220, place: "Rīga, Berģi" },
  1073: { lat: 56.989, lng: 24.080, place: "Rīga, Sarkandaugava" },
  1076: { lat: 56.905, lng: 24.220, place: "Rīga, Šķirotava" },
  1079: { lat: 56.985, lng: 24.105, place: "Rīga, Mīlgrāvis" },
  1082: { lat: 56.952, lng: 24.045, place: "Rīga, Pārdaugava" },
  1083: { lat: 56.940, lng: 24.045, place: "Rīga, Torņakalns" },
  1084: { lat: 56.935, lng: 24.040, place: "Rīga, Torņakalns" },
  2101: { lat: 56.864, lng: 24.354, place: "Salaspils" },
  2108: { lat: 56.940, lng: 24.297, place: "Stopiņi" },
  2111: { lat: 56.907, lng: 24.255, place: "Stopiņi, Ulbroka" },
  2112: { lat: 56.935, lng: 24.260, place: "Stopiņi" },
  2119: { lat: 56.890, lng: 24.330, place: "Salaspils" },
  2128: { lat: 56.940, lng: 24.310, place: "Stopiņi" },
  2130: { lat: 56.890, lng: 24.250, place: "Salaspils" },
  2167: { lat: 56.884, lng: 24.368, place: "Salaspils" },
  // Zone 2
  1016: { lat: 56.910, lng: 24.045, place: "Rīga, Bieriņi" },
  1030: { lat: 56.890, lng: 23.985, place: "Mārupe" },
  2103: { lat: 56.752, lng: 23.998, place: "Olaine" },
  2107: { lat: 56.870, lng: 23.945, place: "Babīte" },
  2114: { lat: 56.965, lng: 24.020, place: "Babīte, Spilve" },
  2117: { lat: 57.262, lng: 24.418, place: "Saulkrasti" },
  2118: { lat: 57.090, lng: 24.310, place: "Ādaži" },
  2121: { lat: 57.075, lng: 24.319, place: "Ādaži" },
  2123: { lat: 57.083, lng: 24.281, place: "Carnikava" },
  2127: { lat: 57.110, lng: 24.290, place: "Ādaži, Garkalne" },
  2137: { lat: 57.075, lng: 24.250, place: "Ādaži" },
  2163: { lat: 57.080, lng: 24.290, place: "Ādažu novads" },
  2164: { lat: 57.075, lng: 24.350, place: "Ādažu novads" },
  2166: { lat: 57.085, lng: 24.310, place: "Ādažu novads" },
  2169: { lat: 56.860, lng: 23.890, place: "Babīte" },
  // Zone 3
  2008: { lat: 56.650, lng: 23.713, place: "Jelgava" },
  2010: { lat: 56.658, lng: 23.722, place: "Jelgava" },
  2011: { lat: 56.665, lng: 23.700, place: "Jelgava" },
  2012: { lat: 56.670, lng: 23.728, place: "Jelgava" },
  2015: { lat: 56.652, lng: 23.690, place: "Jelgava" },
  2016: { lat: 56.640, lng: 23.708, place: "Jelgava" },
  2105: { lat: 56.967, lng: 23.153, place: "Tukums" },
  5001: { lat: 56.870, lng: 24.605, place: "Ogre" },
  5015: { lat: 56.880, lng: 24.620, place: "Ogre" },
  5016: { lat: 56.860, lng: 24.595, place: "Ogre" },
  5041: { lat: 57.080, lng: 25.235, place: "Cēsis" },
  5052: { lat: 57.395, lng: 21.575, place: "Ventspils" },
  5060: { lat: 57.539, lng: 25.428, place: "Valmiera" },
  5070: { lat: 55.875, lng: 26.535, place: "Daugavpils" },
  5071: { lat: 55.880, lng: 26.520, place: "Daugavpils" },
};

const ZONE_FALLBACK_COORDS: Record<DeliveryZone, { lat: number; lng: number }> = {
  0: { lat: 56.946, lng: 24.105 }, // Rīgas centrs
  1: { lat: 56.910, lng: 24.230 }, // Rīgas perimeters
  2: { lat: 57.000, lng: 24.300 }, // Pierīga
  3: { lat: 56.650, lng: 23.713 }, // Jelgava (most common Zone 3)
};

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function placeForCode(code: number, zone: DeliveryZone): string {
  return POSTAL_DATA[code]?.place ?? ZONE_PRICING[zone].area;
}

export function nearestLockersForCode(code: number, zone: DeliveryZone, limit = 3): NearestLocker[] {
  const origin = POSTAL_DATA[code] ?? ZONE_FALLBACK_COORDS[zone];
  return Object.entries(LOCKER_COORDS)
    .map(([id, l]) => ({
      id,
      name: l.name,
      city: l.city,
      address: l.address,
      hours: l.hours,
      distanceKm: Math.round(haversineKm(origin.lat, origin.lng, l.lat, l.lng) * 10) / 10,
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}

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
  if (zone === undefined) {
    // Either explicitly known to be outside zones, or unknown code
    if (OUTSIDE_ZONES_SET.has(code)) {
      // Known rural code — show pakomāts options anyway (use Zone 3 fallback for nearest)
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
