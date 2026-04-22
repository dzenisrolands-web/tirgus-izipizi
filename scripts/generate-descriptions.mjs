// Run: node scripts/generate-descriptions.mjs
// Needs GEMINI_API_KEY in .env.local

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT = join(ROOT, "lib", "event-descriptions.json");

// Read API key from .env.local
const envPath = join(ROOT, ".env.local");
const envContent = readFileSync(envPath, "utf-8");
const apiKeyMatch = envContent.match(/GEMINI_API_KEY=(.+)/);
if (!apiKeyMatch) {
  console.error("GEMINI_API_KEY not found in .env.local");
  process.exit(1);
}
const API_KEY = apiKeyMatch[1].trim();

// Load existing descriptions to skip already generated ones
const existing = existsSync(OUT)
  ? JSON.parse(readFileSync(OUT, "utf-8"))
  : {};

// All events from mock data (read the compiled JS or duplicate the list)
const events = [
  { id: "e1",  name: "Lauku labumu Zaļais tirdziņš",        city: "Balvi",              type: "Zemnieku tirgus",       dateLabel: "11. aprīlis",        region: "Latgale",   description: "Pašvaldības rīkots lauku ražotāju zaļais tirdziņš." },
  { id: "e2",  name: "Salaspils pavasara gadatirgus",        city: "Salaspils",          type: "Gadatirgus",            dateLabel: "18. aprīlis",        region: "Pierīga",   description: "Pavasara gadatirgus ar zemnieku produktiem." },
  { id: "e3",  name: "Jurģu tirgus Dobelē",                  city: "Dobele",             type: "Gadatirgus",            dateLabel: "18. aprīlis",        region: "Zemgale",   description: "Tradicionālais Jurģu tirgus Dobelē." },
  { id: "e4",  name: "Stādu dienas Dzērvēs",                 city: "Jūrmala",            type: "Stādu tirgus",          dateLabel: "18. aprīlis",        region: "Pierīga",   description: "Pavasara stādu tirgus kokaudzētavā." },
  { id: "e5",  name: "Brīvdienu tirdziņš Pļavnieku tirgū",  city: "Rīga",               type: "Amatniecības tirdziņš", dateLabel: "18. aprīlis",        region: "Rīga",      description: "Amatniecība un mājas pārtika." },
  { id: "e6",  name: "Madonas pavasara stādu gadatirgus",    city: "Madona",             type: "Stādu tirgus",          dateLabel: "25. aprīlis",        region: "Vidzeme",   description: "Stādu tirgus Madonas saieta laukumā." },
  { id: "e7",  name: "Pavasara tirdziņš Valmierā",           city: "Valmiera",           type: "Sezonāls tirgus",       dateLabel: "25. aprīlis",        region: "Vidzeme",   description: "Pavasara tirdziņš Vecpuišu parkā." },
  { id: "e8",  name: "Pavasara dārza svētki Bulduri",        city: "Jūrmala",            type: "Stādu tirgus",          dateLabel: "25. aprīlis",        region: "Pierīga",   description: "Dārza un stādu svētki Bulduri." },
  { id: "e9",  name: "Pavasara tirdziņš Pļavnieku tirgū",   city: "Rīga",               type: "Zemnieku tirgus",       dateLabel: "25. aprīlis",        region: "Rīga",      description: "Zemnieku produkti un amatniecība." },
  { id: "e10", name: "Lido zivis un svētku tirgi Kuldīgā",  city: "Kuldīga",            type: "Pārtikas festivāls",    dateLabel: "25. aprīlis",        region: "Kurzeme",   description: "Zivju tirgus un svētku tirdziņš." },
  { id: "e11", name: "Tirgus Valkā",                         city: "Valka",              type: "Gadatirgus",            dateLabel: "25. aprīlis",        region: "Vidzeme",   description: "Latvijas–Igaunijas robežpilsētas kopīgais tirgus." },
  { id: "e12", name: "Lielais Jurģu tirgus Preiļos",         city: "Preiļi",             type: "Gadatirgus",            dateLabel: "26. aprīlis",        region: "Latgale",   description: "Tradicionālais Jurģu gadatirgus Preiļos." },
  { id: "e13", name: "Lielais aprīļa tirgus Limbažos",       city: "Limbaži",            type: "Gadatirgus",            dateLabel: "26. aprīlis",        region: "Vidzeme",   description: "Lielais pavasara gadatirgus Limbažu tirgū." },
  { id: "e14", name: "Pavasara gadatirgus Lielvārdē",        city: "Lielvārde",          type: "Gadatirgus",            dateLabel: "26. aprīlis",        region: "Pierīga",   description: "Pavasara gadatirgus Lāčplēša laukumā." },
  { id: "e15", name: "SPRING EDITION: Design & Taste",       city: "Rīga",               type: "Amatniecības tirdziņš", dateLabel: "1.–2. maijs",        region: "Rīga",      description: "Dizaina un garšas tirdziņš Esplanādē." },
  { id: "e16", name: "Stādu parāde Siguldā",                 city: "Sigulda",            type: "Stādu tirgus",          dateLabel: "1.–2. maijs",        region: "Vidzeme",   description: "Siguldas ikgadējā stādu parāde." },
  { id: "e17", name: "Šlokenbekas burziņš",                  city: "Tukuma novads",      type: "Gadatirgus",            dateLabel: "2. maijs",           region: "Kurzeme",   description: "Pavasara gadatirgus muižas parkā." },
  { id: "e18", name: "Stādu tirgus Ogrē",                    city: "Ogre",               type: "Stādu tirgus",          dateLabel: "1. maijs",           region: "Pierīga",   description: "Ikgadējais stādu tirgus Ogrē." },
  { id: "e19", name: "Mātes dienas tirdziņš Mežaparkā",      city: "Rīga",               type: "Sezonāls tirgus",       dateLabel: "10. maijs",          region: "Rīga",      description: "Mātes dienai veltīts tirdziņš." },
  { id: "e20", name: "Latvijas Stādu dienas",                city: "Jelgava",            type: "Stādu tirgus",          dateLabel: "9.–10. maijs",       region: "Zemgale",   description: "Latvijas lielākais stādu tirgs Jelgavā." },
  { id: "e21", name: "Lauku labumu Zaļais tirdziņš Balvos",  city: "Balvi",              type: "Zemnieku tirgus",       dateLabel: "9. maijs",           region: "Latgale",   description: "Ikmēneša zaļais tirdziņš ar zemnieku produktiem." },
  { id: "e22", name: "Medusmaizes svētki Jersikā",           city: "Jersika, Līvāni",    type: "Pārtikas festivāls",    dateLabel: "23. maijs",          region: "Latgale",   description: "Medusmaizes svētki ar medum un maizi." },
  { id: "e23", name: "Rēzeknes tirgus",                      city: "Rēzekne",            type: "Gadatirgus",            dateLabel: "24. maijs",          region: "Latgale",   description: "Regulārais gadatirgus Rēzeknē." },
  { id: "e24", name: "Brīvdabas muzeja Gadatirgus",          city: "Berģi, Rīga",        type: "Gadatirgus",            dateLabel: "6.–7. jūnijs",       region: "Rīga",      description: "Lielākais tradicionālais gadatirgus Latvijā." },
  { id: "e25", name: "Ikšķiles svētku tirdziņš",             city: "Ikšķile",            type: "Sezonāls tirgus",       dateLabel: "13. jūnijs",         region: "Pierīga",   description: "Ikšķiles pilsētas svētku tirdziņš." },
  { id: "e26", name: "Lielais Latgales tirgus",              city: "Ludza",              type: "Gadatirgus",            dateLabel: "20. jūnijs",         region: "Latgale",   description: "Lielais Latgales reģionālais tirgus Ludzā." },
  { id: "e27", name: "Jāņu tirdziņi",                        city: "Visa Latvija",       type: "Sezonāls tirgus",       dateLabel: "23.–24. jūnijs",     region: "Visa Latvija", description: "Jāņu svētku tirdziņi visā Latvijā." },
  { id: "e28", name: "Garšo Latgali",                        city: "Rēzeknes novads",    type: "Pārtikas festivāls",    dateLabel: "10.–11. jūlijs",     region: "Latgale",   description: "Latgales gastronomijas festivāls." },
  { id: "e29", name: "Lielvārdes pilsētas svētku tirgus",    city: "Lielvārde",          type: "Sezonāls tirgus",       dateLabel: "25. jūlijs",         region: "Pierīga",   description: "Pilsētas svētku tirdziņš Lielvārdē." },
  { id: "e30", name: "Sabile Vīna svētki",                   city: "Sabile",             type: "Pārtikas festivāls",    dateLabel: "25.–26. jūlijs",     region: "Kurzeme",   description: "Sabiles vīna svētki ar vietējo vīnu." },
  { id: "e31", name: "Nēģu svētki Carnikavā",                city: "Carnikava",          type: "Pārtikas festivāls",    dateLabel: "22. augusts",        region: "Pierīga",   description: "Carnikavas nēģu svētki — zivju festivāls." },
  { id: "e32", name: "Ogres pilsētas svētku tirgus",         city: "Ogre",               type: "Sezonāls tirgus",       dateLabel: "22. augusts",        region: "Pierīga",   description: "Ogres pilsētas svētku gadatirgus." },
  { id: "e33", name: "Piena, Maizes un Medus svētki",        city: "Jelgava",            type: "Pārtikas festivāls",    dateLabel: "29. augusts",        region: "Zemgale",   description: "Jelgavas svētki slavē pienu, maizi un medu." },
  { id: "e34", name: "Lauku svētku tirgus Birzgalē",         city: "Birzgale",           type: "Zemnieku tirgus",       dateLabel: "29. augusts",        region: "Pierīga",   description: "Lauku svētku tirdziņš Birzgalē." },
  { id: "e35", name: "Riga Food 2026",                       city: "Rīga",               type: "Pārtikas festivāls",    dateLabel: "10.–12. septembris", region: "Rīga",      description: "Baltijas lielākā pārtikas rūpniecības izstāde." },
  { id: "e36", name: "Rudens tirdziņš Ikšķilē",              city: "Ikšķile",            type: "Sezonāls tirgus",       dateLabel: "19. septembris",     region: "Pierīga",   description: "Rudens tirdziņš ar ražas produktiem." },
  { id: "e37", name: "Rudens stādu tirgus Ogrē",             city: "Ogre",               type: "Stādu tirgus",          dateLabel: "26. septembris",     region: "Pierīga",   description: "Rudens stādu tirgus Ogrē." },
  { id: "e38", name: "Miķeļdienas gadatirgus",               city: "Rēzekne",            type: "Gadatirgus",            dateLabel: "27. septembris",     region: "Latgale",   description: "Tradicionālais Miķeļdienas ražas gadatirgus." },
  { id: "e39", name: "Rudens tirdziņš Suntažos",             city: "Suntaži",            type: "Sezonāls tirgus",       dateLabel: "3. oktobris",        region: "Pierīga",   description: "Rudens gadatirgus Suntažos." },
  { id: "e40", name: "Miķeļdienas tirgus un Maizes svētki Ķegumos", city: "Ķegums",     type: "Gadatirgus",            dateLabel: "4. oktobris",        region: "Pierīga",   description: "Miķeļdienas tirgus ar Maizes svētkiem." },
  { id: "e41", name: "Rudens tirgus Lielvārdē",              city: "Lielvārde",          type: "Sezonāls tirgus",       dateLabel: "11. oktobris",       region: "Pierīga",   description: "Rudens tirdziņš ar ražas produktiem." },
  { id: "e42", name: "Rīgas Ziemassvētku tirdziņš",          city: "Rīga",               type: "Ziemassvētku tirdziņš", dateLabel: "27. nov. – 4. janv.", region: "Rīga",     description: "Skaistākais Ziemassvētku tirdziņš Eiropā." },
  { id: "e43", name: "Ziemassvētku tirdziņš Ikšķilē",        city: "Ikšķile",            type: "Ziemassvētku tirdziņš", dateLabel: "13. decembris",      region: "Pierīga",   description: "Ikšķiles Ziemassvētku tirdziņš." },
  { id: "e44", name: "Ziemassvētku tirgus Ogrē",             city: "Ogre",               type: "Ziemassvētku tirdziņš", dateLabel: "20. decembris",      region: "Pierīga",   description: "Ogres Ziemassvētku tirdziņš." },
  { id: "e45", name: "Ziemas tirdziņš Valmierā",             city: "Valmiera",           type: "Ziemassvētku tirdziņš", dateLabel: "Decembris",          region: "Vidzeme",   description: "Valmieras Ziemassvētku tirdziņš." },
  { id: "e46", name: "Kalnciema kvartāla zemnieku tirgus",   city: "Rīga",               type: "Zemnieku tirgus",       dateLabel: "Katru sestdienu",    region: "Rīga",      description: "Rīgas populārākais zemnieku tirgus." },
  { id: "e47", name: "Rīgas Centrāltirgus",                  city: "Rīga",               type: "Zemnieku tirgus",       dateLabel: "Katru dienu",        region: "Rīga",      description: "Viens no lielākajiem tirgiem Eiropā." },
];

async function generateDescription(event) {
  const prompt = `Tu esi Latvijas tirgus un vietējo produktu eksperts. Uzraksti detalizētu, SEO-optimizētu aprakstu (250–300 vārdos, latviešu valodā) par šo pasākumu:

Nosaukums: ${event.name}
Pilsēta: ${event.city}
Reģions: ${event.region}
Datums: ${event.dateLabel}
Veids: ${event.type}
Īss apraksts: ${event.description}

Aprakstā iekļauj:
1. Ko apmeklētāji var sagaidīt (preces, produkti, amatnieki, zemnieki)
2. Pasākuma tradīcijas un vēsturi Latvijā
3. Praktiskas norādes (kāpēc vērts apmeklēt, kas tur tiek pārdots)
4. SEO atslēgvārdus dabiski iepītus tekstā (gadatirgus, zemnieku tirgus, latvija, vietējie produkti utt.)
5. Aicinājumu atbalstīt vietējos ražotājus

Raksti dabiskā, draudzīgā tonī. Izmanto rindkopas. Nekad neizmanto markdown formatējumu.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 600 },
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Gemini API error ${resp.status}: ${err}`);
  }

  const data = await resp.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? event.description;
}

async function main() {
  const descriptions = { ...existing };
  let generated = 0;

  for (const event of events) {
    if (descriptions[event.id]) {
      console.log(`⏭  Skip ${event.id} (${event.name}) — already exists`);
      continue;
    }

    try {
      console.log(`⚙  Generating: ${event.name}...`);
      const desc = await generateDescription(event);
      descriptions[event.id] = desc;
      generated++;
      // Save after each to avoid losing work on crash
      writeFileSync(OUT, JSON.stringify(descriptions, null, 2), "utf-8");
      console.log(`✓  Done: ${event.name}`);
      // Rate limit: 1 req/s to stay within free tier
      await new Promise((r) => setTimeout(r, 1200));
    } catch (err) {
      console.error(`✗  Failed: ${event.name} —`, err.message);
    }
  }

  console.log(`\nDone. Generated ${generated} new descriptions. Total: ${Object.keys(descriptions).length}`);
}

main();
