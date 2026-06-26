/**
 * Latvian-aware slugify: strips diacritics, lowercases, hyphenates.
 *   "Oranžās Bumbas"  → "oranzas-bumbas"
 *   "Wild'N'Free"      → "wildnfree"
 *   "K/S Ekoloģisks.lv" → "ks-ekologisks-lv"
 */
const LV_MAP: Record<string, string> = {
  ā: "a", č: "c", ē: "e", ģ: "g", ī: "i", ķ: "k",
  ļ: "l", ņ: "n", š: "s", ū: "u", ž: "z",
  Ā: "a", Č: "c", Ē: "e", Ģ: "g", Ī: "i", Ķ: "k",
  Ļ: "l", Ņ: "n", Š: "s", Ū: "u", Ž: "z",
};

export function slugify(text: string): string {
  return text
    .replace(/[āčēģīķļņšūžĀČĒĢĪĶĻŅŠŪŽ]/g, (ch) => LV_MAP[ch] ?? ch)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")   // strip remaining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")       // non-alphanum → hyphen
    .replace(/^-+|-+$/g, "");          // trim leading/trailing hyphens
}

/** Build the full referral URL for a seller slug. */
export function refLink(slug: string): string {
  return `https://tirgus.izipizi.lv/r/${slug}?utm_source=razotajs&utm_medium=story&utm_campaign=starter`;
}
