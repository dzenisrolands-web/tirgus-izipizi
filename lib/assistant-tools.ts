import { createServerClient } from "./supabase";

const BASE_URL = "https://tirgus.izipizi.lv";

// Gemini function declarations — describe what each tool does and its inputs.
// Keep descriptions short but unambiguous; Gemini decides when to call.
export const TOOL_DECLARATIONS = [
  {
    name: "search_products",
    description:
      "Meklē aktīvus produktus pēc atslēgvārda (nosaukumā, aprakstā, kategorijā vai ražotāja vārdā). " +
      "Lieto, kad lietotājs prasa konkrētu produktu vai produkta veidu. " +
      "Piem.: 'siers', 'pelmeņi', 'kartupeļi'.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Meklējamais atslēgvārds" },
        limit: { type: "number", description: "Max rezultātu skaits (default 6, max 12)" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_product",
    description: "Iegūst pilnu produkta informāciju pēc ID. Lieto, kad lietotājs prasa detaļas par konkrētu produktu.",
    parameters: {
      type: "object",
      properties: { id: { type: "string", description: "Produkta ID" } },
      required: ["id"],
    },
  },
  {
    name: "list_categories",
    description: "Atgriež visas pieejamās produktu kategorijas ar produktu skaitu. Lieto, kad lietotājs jautā 'kādas kategorijas ir' vai 'ko jūs pārdodat'.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_help_topic",
    description:
      "Atgriež palīdzības tekstu par konkrētu tēmu. Iespējamās tēmas: " +
      "'delivery' (piegāde, cenas, zonas), " +
      "'payment' (apmaksa, Paysera), " +
      "'lockers' (pakomāti, kā saņemt), " +
      "'returns' (atgriešana), " +
      "'becoming_seller' (kā kļūt par ražotāju), " +
      "'about' (par tirgus.izipizi.lv).",
    parameters: {
      type: "object",
      properties: { topic: { type: "string" } },
      required: ["topic"],
    },
  },
];

type SearchProduct = {
  id: string;
  title: string;
  price: number;
  unit: string;
  category: string;
  image: string;
  url: string;
  sellerName: string;
};

export async function searchProducts({ query, limit = 6 }: { query: string; limit?: number }): Promise<SearchProduct[]> {
  const max = Math.min(Math.max(1, limit ?? 6), 12);
  const supabase = createServerClient();
  // Postgres `ilike` on multiple columns via .or()
  const q = `%${query.replace(/[%_]/g, "")}%`;
  const { data: rows } = await supabase
    .from("listings")
    .select("id, title, price, unit, category, image_url, seller_id")
    .eq("status", "active")
    .or(`title.ilike.${q},description.ilike.${q},category.ilike.${q}`)
    .limit(max);
  if (!rows || rows.length === 0) return [];
  const sellerIds = [...new Set(rows.map((r) => r.seller_id).filter(Boolean))];
  const { data: sellers } = await supabase.from("sellers").select("id, name, farm_name").in("id", sellerIds);
  const sellerMap = Object.fromEntries((sellers ?? []).map((s) => [s.id, s.farm_name || s.name]));
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    price: r.price,
    unit: r.unit,
    category: r.category,
    image: r.image_url,
    url: `${BASE_URL}/listing/${r.id}`,
    sellerName: sellerMap[r.seller_id] ?? "",
  }));
}

export async function getProduct({ id }: { id: string }) {
  const supabase = createServerClient();
  const { data: row } = await supabase
    .from("listings")
    .select("id, title, description, price, unit, category, image_url, seller_id, quantity")
    .eq("id", id)
    .single();
  if (!row) return { error: "Produkts nav atrasts" };
  const { data: seller } = await supabase
    .from("sellers")
    .select("name, farm_name, location")
    .eq("id", row.seller_id)
    .single();
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    price: row.price,
    unit: row.unit,
    category: row.category,
    image: row.image_url,
    quantity: row.quantity,
    sellerName: seller?.farm_name || seller?.name || "",
    sellerLocation: seller?.location || "",
    url: `${BASE_URL}/listing/${row.id}`,
  };
}

export async function listCategories() {
  const supabase = createServerClient();
  const { data: rows } = await supabase.from("listings").select("category").eq("status", "active");
  if (!rows) return [];
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.category] = (counts[r.category] ?? 0) + 1;
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([category, count]) => ({ category, count }));
}

const HELP_TOPICS: Record<string, string> = {
  delivery:
    "Piegāde notiek caur izipizi pakomātiem visā Latvijā. Cena: 3€ par pakomātu (vienreizīga summa, neatkarīgi no produktu skaita no viena ražotāja). " +
    "Kurjera piegāde: 4 zonas (Z0–Z3), no 5€ līdz 12€ atkarībā no attāluma. " +
    "Lapa: /piegade.",
  payment:
    "Apmaksa notiek caur Paysera (Latvijas maksājumu pakalpojums) — atbalsta SEPA pārskaitījumu, Visa, Mastercard. " +
    "Pasūtījums tiek apstiprināts pēc apmaksas. Patlaban Paysera projekts ir pārbaudes posmā, drīz būs pilnībā darbojošs.",
  lockers:
    "Mums ir 6 izipizi pakomātu lokācijas: Brīvības iela 253, Salaspils, Āgenskalna tirgus, un citas. " +
    "Pēc apmaksas saņemsi SMS/email ar pakomāta kodu. Pakomāti darbojas 24/7. " +
    "Pasūtījumu var saņemt 48h laikā pēc kad pārdevējs to ievietojis pakomātā.",
  returns:
    "Pārtikas produktiem atgriešana parasti nav iespējama (svaiga produkcija, atvērta iepakojuma utt.). " +
    "Ja produkts ir bojāts vai neatbilst aprakstam — sazinies ar mums (tirgus@izipizi.lv) 24h laikā un mēs atrisināsim individuāli. " +
    "Detaļas: /atgriesana.",
  becoming_seller:
    "Lai kļūtu par pārdevēju: 1) Reģistrējies (/login) → 2) Aizpildi profilu (uzņēmuma dati, PVN reģ. nr., bankas konts) → 3) Iesniedz apstiprināšanai. " +
    "Admin pārbaudīs un apstiprinās 1–2 dienu laikā. Pēc tam vari pievienot produktus un sākt pārdot. " +
    "Komisija — 5–20% par pārdevumu (atkarībā no kategorijas un produkta).",
  about:
    "tirgus.izipizi.lv ir Latvijas vietējo ražotāju tirgus vieta — savieno fermas ar pircējiem caur izipizi pakomātu tīklu. " +
    "Pērc no tieši ražotāja, saņem ērti pakomātā vai ar piegādi. " +
    "Operators: SIA Svaigi (40103915568, LV-VAT). Lapa: /par-mums.",
};

export async function getHelpTopic({ topic }: { topic: string }) {
  const t = topic.toLowerCase().replace(/[^a-z_]/g, "");
  const text = HELP_TOPICS[t];
  if (!text) return { error: `Nezināma tēma '${topic}'. Pieejamās: ${Object.keys(HELP_TOPICS).join(", ")}` };
  return { topic: t, text };
}

export async function dispatchTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "search_products":
      return searchProducts(args as { query: string; limit?: number });
    case "get_product":
      return getProduct(args as { id: string });
    case "list_categories":
      return listCategories();
    case "get_help_topic":
      return getHelpTopic(args as { topic: string });
    default:
      return { error: `Nezināms tool: ${name}` };
  }
}
