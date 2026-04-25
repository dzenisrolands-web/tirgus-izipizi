import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight, Package, Clock,
  Truck, Zap, CheckCircle, ChevronRight,
} from "lucide-react";
import { listings, sellers } from "@/lib/mock-data";
import { sellersMeta } from "@/lib/sellers-meta";
import { ListingCard } from "@/components/listing-card";
import { recipes } from "@/lib/recipes-data";
import { fetchActiveListings } from "@/lib/db-listings";

export default async function HomePage() {
  const dbListings = await fetchActiveListings();
  const allListings = [...dbListings, ...listings];
  const featured = allListings.slice(0, 8);
  const totalListings = allListings.length;

  const coverImages = [
    sellersMeta.s7.cover,
    sellersMeta.s9.cover,
    sellersMeta.s12.cover,
    sellersMeta.s13.cover,
  ].filter(Boolean);

  return (
    <div>
      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#192635] px-4 py-16 text-white sm:px-6 lg:px-8 lg:py-24">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-40 -top-40 h-96 w-96 rounded-full opacity-10"
            style={{ background: "radial-gradient(circle, #53F3A4, transparent 70%)" }} />
          <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full opacity-10"
            style={{ background: "radial-gradient(circle, #AD47FF, transparent 70%)" }} />
        </div>

        <div className="relative mx-auto max-w-7xl">
          <div className="grid items-center gap-12 lg:grid-cols-2">

            {/* Left — copy */}
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-yellow-400/40 bg-yellow-400/10 px-3 py-1.5">
                <Zap size={12} className="text-yellow-400" />
                <span className="text-xs font-semibold text-yellow-300">Tagad arī eksprespiegāde Rīgā — 2–5h</span>
              </div>

              <h1 className="mt-5 text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl">
                No ražotāja —{" "}
                <span
                  className="bg-clip-text text-transparent"
                  style={{ backgroundImage: "linear-gradient(90deg, #53F3A4, #AD47FF)" }}
                >
                  tieši pie tevis
                </span>
              </h1>

              <p className="mt-5 max-w-lg text-lg leading-relaxed text-gray-300">
                Latvijas ražotāji pārdod tieši caur{" "}
                <strong className="text-white">IziPizi infrastruktūru</strong>.
                Mēs nodrošinām pilno ceļu — no ražotāja pakomāta līdz taviem durvīm. Svaigi. Ātri. Vietēji.
              </p>

              {/* Delivery type pills */}
              <div className="mt-6 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-300">
                  <Package size={12} className="text-brand-400" /> Pakomāts 24/7
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-300">
                  <Truck size={12} className="text-cyan-400" /> Piegāde uz adresi
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-300">
                  <Zap size={12} className="text-yellow-400" /> Eksprespiegāde 2–5h
                </span>
              </div>

              {/* CTAs */}
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/catalog"
                  className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-[#192635] transition hover:brightness-110"
                  style={{ background: "linear-gradient(90deg, #53F3A4, #AD47FF)" }}>
                  Skatīt produktus <ArrowRight size={16} />
                </Link>
                <Link href="/eksprespiegade"
                  className="inline-flex items-center gap-2 rounded-full border border-yellow-400/40 px-6 py-3 text-sm font-medium text-yellow-300 transition hover:bg-yellow-400/10">
                  <Zap size={14} /> Eksprespiegāde
                </Link>
              </div>

              {/* Stats */}
              <div className="mt-10 flex flex-wrap gap-8 border-t border-white/10 pt-8">
                <div>
                  <p className="text-2xl font-bold text-brand-400">{sellers.length}</p>
                  <p className="text-sm text-gray-400">Ražotāji</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-brand-400">{totalListings}+</p>
                  <p className="text-sm text-gray-400">Produkti</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-brand-400">6</p>
                  <p className="text-sm text-gray-400">Pakomātu vietas</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-brand-400">2–5h</p>
                  <p className="text-sm text-gray-400">Eksprespiegāde</p>
                </div>
              </div>
            </div>

            {/* Right — cover image mosaic */}
            <div className="hidden grid-cols-2 grid-rows-2 gap-3 lg:grid" style={{ height: 460 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={coverImages[0]} alt="" className="row-span-2 h-full w-full rounded-2xl object-cover" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={coverImages[1]} alt="" className="h-full w-full rounded-2xl object-cover" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={coverImages[2]} alt="" className="h-full w-full rounded-2xl object-cover" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Full journey ─────────────────────────────────── */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-600">Kā tas strādā</span>
            <h2 className="mt-2 text-2xl font-bold text-gray-900">Pilnais ceļš — no ražotāja līdz tev</h2>
            <p className="mt-2 text-sm text-gray-500">
              Ražotājs tirgo patstāvīgi. IziPizi nodrošina visu infrastruktūru.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: "🌾",
                step: "01",
                title: "Ražotājs tirgo",
                desc: "Ražotājs pats nosaka cenu un daudzumu. Ievieto produktus savā mājas pakomātā vai nodod kurjeram.",
                gradient: "from-brand-400/20 to-brand-400/5",
                border: "border-brand-400/30",
                num: "text-brand-400",
              },
              {
                icon: "📦",
                step: "02",
                title: "IziPizi maršrutē",
                desc: "Mūsu sistēma organizē sūtījumu — temperatūras ķēde, pakomātu tīkls, kurjeri un izsekošana reāllaikā.",
                gradient: "from-purple-400/20 to-purple-400/5",
                border: "border-purple-400/30",
                num: "text-purple-400",
              },
              {
                icon: "🚚",
                step: "03",
                title: "Tu izvēlies saņemšanu",
                desc: "Pakomāts 24/7, standarta piegāde 1–2 dienās vai eksprespiegāde 2–5h. Izvēlies, kas tev ērtāk.",
                gradient: "from-cyan-400/20 to-cyan-400/5",
                border: "border-cyan-400/30",
                num: "text-cyan-500",
              },
              {
                icon: "✅",
                step: "04",
                title: "Saņem svaigu!",
                desc: "Saņem kodu un izņem produktus pakomātā jebkurā laikā vai sagaidi kurjeru pie durvīm.",
                gradient: "from-green-400/20 to-green-400/5",
                border: "border-green-400/30",
                num: "text-green-500",
              },
            ].map((item, i) => (
              <div key={item.step} className="relative">
                {i < 3 && (
                  <ChevronRight size={20} className="absolute -right-3 top-10 z-10 hidden text-gray-300 lg:block" />
                )}
                <div className={`h-full rounded-2xl border bg-gradient-to-b p-5 ${item.border} ${item.gradient}`}>
                  <span className="text-3xl">{item.icon}</span>
                  <div className={`mt-3 text-xs font-extrabold ${item.num}`}>{item.step}</div>
                  <h3 className="mt-1 font-bold text-gray-900">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-500">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Delivery options ─────────────────────────────── */}
      <section className="bg-[#192635] px-4 py-16 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-400">Piegādes iespējas</span>
            <h2 className="mt-2 text-2xl font-bold text-white">Saņem tā, kā tev ērti</h2>
            <p className="mt-2 text-gray-400">Trīs veidi, kā produkti nonāk pie tevis</p>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            {/* Pakomāts */}
            <div className="flex flex-col rounded-2xl border border-brand-400/30 bg-brand-400/5 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-400/20">
                <Package size={22} className="text-brand-400" />
              </div>
              <h3 className="mt-4 text-base font-bold text-white">IziPizi pakomāts</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-400">
                Saņem produktus jebkurā no 6+ IziPizi pakomātiem 24/7. Dzesēts un saldēts režīms.
              </p>
              <div className="mt-4">
                <span className="text-2xl font-extrabold text-brand-400">no 1.50€</span>
              </div>
              <ul className="mt-3 space-y-1.5 text-xs text-gray-400">
                <li className="flex items-center gap-1.5"><CheckCircle size={11} className="text-brand-400 shrink-0" /> Pieejams 24/7</li>
                <li className="flex items-center gap-1.5"><CheckCircle size={11} className="text-brand-400 shrink-0" /> Temperatūras kontrole</li>
                <li className="flex items-center gap-1.5"><CheckCircle size={11} className="text-brand-400 shrink-0" /> Uzglabāšana līdz 48h</li>
              </ul>
              <Link href="/piegade" className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-brand-400 hover:underline">
                Uzzināt vairāk <ArrowRight size={13} />
              </Link>
            </div>

            {/* Standarta */}
            <div className="flex flex-col rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10">
                <Truck size={22} className="text-gray-300" />
              </div>
              <h3 className="mt-4 text-base font-bold text-white">Standarta piegāde</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-400">
                Piegāde uz mājām vai biroju 1–2 darba dienu laikā. Temperatūras kontrolēts kurjers pa visu Latviju.
              </p>
              <div className="mt-4">
                <span className="text-2xl font-extrabold text-white">no 4.50€</span>
              </div>
              <ul className="mt-3 space-y-1.5 text-xs text-gray-400">
                <li className="flex items-center gap-1.5"><CheckCircle size={11} className="text-gray-500 shrink-0" /> Pa visu Latviju</li>
                <li className="flex items-center gap-1.5"><CheckCircle size={11} className="text-gray-500 shrink-0" /> 1–2 darba dienas</li>
                <li className="flex items-center gap-1.5"><CheckCircle size={11} className="text-gray-500 shrink-0" /> Saldēts un dzesēts</li>
              </ul>
              <Link href="/piegade" className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-gray-300 hover:underline">
                Uzzināt vairāk <ArrowRight size={13} />
              </Link>
            </div>

            {/* Eksprespiegāde */}
            <div className="relative flex flex-col overflow-hidden rounded-2xl border border-yellow-400/30 bg-yellow-400/5 p-6">
              <div className="absolute right-3 top-3 rounded-full bg-yellow-400/20 px-2 py-0.5 text-[10px] font-bold text-yellow-400">
                JAUNS
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-400/20">
                <Zap size={22} className="text-yellow-400" />
              </div>
              <h3 className="mt-4 text-base font-bold text-white">Eksprespiegāde</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-400">
                Saņem produktus 2–5 stundu laikā. Pieejama Rīgā un tuvākajā apkārtnē — tieši no ražotāja pie tevis.
              </p>
              <div className="mt-4">
                <span className="text-2xl font-extrabold text-yellow-400">no 5.99€</span>
              </div>
              <ul className="mt-3 space-y-1.5 text-xs text-gray-400">
                <li className="flex items-center gap-1.5"><CheckCircle size={11} className="text-yellow-400 shrink-0" /> 2–5h piegāde</li>
                <li className="flex items-center gap-1.5"><CheckCircle size={11} className="text-yellow-400 shrink-0" /> Rīga un apkārtne</li>
                <li className="flex items-center gap-1.5"><CheckCircle size={11} className="text-yellow-400 shrink-0" /> Reāllaika izsekošana</li>
              </ul>
              <Link href="/eksprespiegade" className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-yellow-400 hover:underline">
                Pasūtīt eksprespiegādi <ArrowRight size={13} />
              </Link>
            </div>
          </div>

          <div className="mt-6 text-center">
            <Link href="/piegade"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-white/10">
              Pilna piegādes informācija <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Featured products ────────────────────────────── */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Svaigākie produkti</h2>
              <p className="mt-1 text-sm text-gray-500">Tieši no ražotāja</p>
            </div>
            <Link href="/catalog" className="flex items-center gap-1 text-sm text-brand-600 hover:underline">
              Skatīt visus <ArrowRight size={14} />
            </Link>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {featured.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Why IziPizi ──────────────────────────────────── */}
      <section className="bg-gray-50 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-600">Mūsu priekšrocības</span>
            <h2 className="mt-2 text-2xl font-bold text-gray-900">Kāpēc tirgus.izipizi.lv?</h2>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: "🌱", title: "Tieši no ražotāja", desc: "Bez starpniekiem. Ražotājs nosaka cenu, tu maksā godīgi — lielāka daļa nonāk tieši pie ražotāja." },
              { icon: "❄️", title: "Aukstā ķēde — nesalauzta", desc: "No ražotāja līdz tev produkts atrodas temperatūras kontrolētā vidē. -18°C vai +2°C — nemainīgi." },
              { icon: "⚡", title: "Eksprespiegāde 2–5h", desc: "Pasūti no rīta — saņem pusdienā. Expresss kurjers Rīgā nogādā svaigu produkciju tajā pašā dienā." },
              { icon: "📍", title: "6+ pakomātu vietas", desc: "Izvēlies tuvāko IziPizi pakomātu — saņem 24/7 jebkurā ērtā laikā. Pilsētā vai ārpus tās." },
              { icon: "✅", title: "Verificēti ražotāji", desc: "Katrs ražotājs manuāli apstiprināts. Tu zini, no kā pērki — vārds, foto un atrašanās vieta." },
              { icon: "🤝", title: "Kopienas tirgus", desc: "Latvijas lauki dzīvo. Katrs pirkums atbalsta vietējo ražotāju, nevis lielveikalu ķēdi." },
            ].map((f) => (
              <div key={f.title} className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
                <span className="text-2xl">{f.icon}</span>
                <h3 className="mt-3 font-bold text-gray-900">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-gray-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Recipes promo ───────────────────────────────── */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-brand-600">Iedvesma virtuvē</span>
              <h2 className="mt-1 text-2xl font-bold text-gray-900">Receptes no ražotāju produktiem</h2>
              <p className="mt-1 text-sm text-gray-500">Garšīgas idejas, ko pagatavot no vietējiem produktiem</p>
            </div>
            <Link href="/receptes" className="hidden shrink-0 items-center gap-1 text-sm text-brand-600 hover:underline sm:flex">
              Visas receptes <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            {recipes.slice(0, 3).map((r) => (
              <Link key={r.slug} href={`/receptes/${r.slug}`}
                className="group overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-shadow hover:shadow-md">
                <div className="relative h-44 w-full overflow-hidden bg-gray-100">
                  <Image src={r.image} alt={r.title} fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    sizes="(max-width: 640px) 100vw, 33vw" />
                  <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-medium text-gray-700 backdrop-blur-sm">
                    {r.category}
                  </span>
                </div>
                <div className="p-4">
                  <h3 className="font-bold leading-snug text-gray-900 transition-colors group-hover:text-brand-600">{r.title}</h3>
                  <p className="mt-1 line-clamp-2 text-xs text-gray-500">{r.shortDesc}</p>
                  <div className="mt-3 flex items-center gap-3 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><Clock size={11} /> {r.prepTime + r.cookTime} min</span>
                    <span>{r.difficulty}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <div className="mt-5 text-center sm:hidden">
            <Link href="/receptes" className="btn-outline text-sm">Skatīt visas receptes</Link>
          </div>
        </div>
      </section>

      {/* ── Producers strip ──────────────────────────────── */}
      <section className="bg-gray-50 px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Mūsu ražotāji</h2>
              <p className="mt-1 text-sm text-gray-500">Verificēti Latvijas ražotāji</p>
            </div>
            <Link href="/razotaji" className="flex items-center gap-1 text-sm text-brand-600 hover:underline">
              Visi ražotāji <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sellers.map((seller) => {
              const meta = sellersMeta[seller.id];
              const count = listings.filter((l) => l.sellerId === seller.id).length;
              return (
                <Link key={seller.id} href={`/seller/${seller.id}`}
                  className="group flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:shadow-md">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={seller.avatar} alt={seller.name}
                    className="h-14 w-14 shrink-0 rounded-xl border border-gray-100 object-contain p-1" />
                  <div className="min-w-0">
                    <p className="truncate font-bold text-gray-900 group-hover:text-brand-600">{seller.name}</p>
                    {meta?.description && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-gray-500">{meta.description}</p>
                    )}
                    <p className="mt-1 flex items-center gap-1 text-xs text-gray-400">
                      <Package size={11} /> {count} produkti
                    </p>
                  </div>
                  <ArrowRight size={16} className="ml-auto shrink-0 text-gray-300 transition group-hover:text-brand-400" />
                </Link>
              );
            })}
          </div>
        </div>
      </section>


      {/* ── Seller CTA ───────────────────────────────────── */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl bg-[#192635] px-8 py-14 text-white">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-400/20 px-3 py-1 text-xs font-medium text-brand-400">
                🌱 Pārdod vietēji
              </span>
              <h2 className="mt-4 text-3xl font-extrabold leading-tight">
                Esi ražotājs<br />vai pārdevējs?
              </h2>
              <p className="mt-3 leading-relaxed text-gray-300">
                Tu tirgo, mēs nodrošinām visu pārējo — pakomātu tīklu, temperatūras ķēdi, piegādi un maksājumus.
                Ievieto produktus, un mūsu infrastruktūra to nogādā pie pircēja.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/sell"
                  className="inline-flex items-center gap-2 rounded-full px-8 py-3 text-sm font-bold text-[#192635] transition hover:brightness-110"
                  style={{ background: "linear-gradient(90deg, #53F3A4, #AD47FF)" }}>
                  Sākt pārdot <ArrowRight size={16} />
                </Link>
                <Link href="/how-it-works"
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 px-6 py-3 text-sm font-medium text-white transition hover:bg-white/10">
                  Kā tas strādā
                </Link>
              </div>
            </div>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {[
                { icon: "✅", text: "Bezmaksas reģistrācija" },
                { icon: "⚡", text: "Apstiprināšana 24h laikā" },
                { icon: "💰", text: "Komisija tikai no pārdošanas" },
                { icon: "🚚", text: "Piegāde ar IziPizi infrastruktūru" },
                { icon: "❄️", text: "Temperatūras ķēde no ražotāja" },
              ].map((f) => (
                <li key={f.text}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-300">
                  <span className="text-base">{f.icon}</span>
                  {f.text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
