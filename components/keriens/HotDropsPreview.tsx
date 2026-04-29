import Link from "next/link";
import { Flame, ArrowRight, Clock, Package, ShoppingBag } from "lucide-react";
import { fetchActiveDrops } from "@/lib/hot-drops/queries";
import { DropCard } from "./DropCard";

export async function HotDropsPreview() {
  const drops = await fetchActiveDrops();
  const preview = drops.slice(0, 4);

  return (
    <section className="relative overflow-hidden px-4 py-16 sm:px-6 lg:px-8">
      {/* Warm background */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-orange-50 via-white to-red-50" />

      <div className="relative mx-auto max-w-7xl">

        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            {drops.length > 0 ? (
              <div className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-600">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-500" />
                </span>
                Live · {drops.length} aktīv{drops.length === 1 ? "s" : "i"} tagad
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-500">
                <Flame size={11} /> Tieši no ražotāja
              </div>
            )}
            <h2 className="mt-2 flex items-center gap-2 text-2xl font-extrabold text-gray-900">
              <Flame size={24} className="text-orange-500" />
              Sludinājumu dēlis
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Tieši no ražotāja — pievienots šodien, pieejams tavā pakomātā
            </p>
          </div>
          <Link href="/keriens"
            className="flex items-center gap-1.5 rounded-full border border-orange-200 bg-white px-4 py-2 text-sm font-semibold text-orange-600 shadow-sm hover:bg-orange-50 transition">
            Skatīt visu sadaļu <ArrowRight size={14} />
          </Link>
        </div>

        {drops.length > 0 ? (
          <>
            {/* Drop cards */}
            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {preview.map((drop) => (
                <DropCard key={drop.id} drop={drop} />
              ))}
            </div>
            {drops.length > 4 && (
              <div className="mt-6 text-center">
                <Link href="/keriens"
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-red-500 px-6 py-2.5 text-sm font-bold text-white shadow-md hover:opacity-90 transition">
                  <Flame size={14} /> Vēl {drops.length - 4} sludinājumi
                </Link>
              </div>
            )}
          </>
        ) : (
          /* ── Empty state — always visible ── */
          <div className="mt-8 grid gap-6 lg:grid-cols-2">

            {/* Left — what is this */}
            <div className="rounded-2xl border border-orange-100 bg-white p-8 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100">
                <Flame size={24} className="text-orange-500" />
              </div>
              <h3 className="mt-4 text-lg font-extrabold text-gray-900">Kas ir Sludinājumu dēlis?</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">
                Dzīvas ziņas no ražotāja — produkts, ko viņš tikko ievieto pakomātā.
                Tieši no fermas vai tirgus, ar pārdevēja seju un balsi. Abonē savu pakomātu un saņem paziņojumu.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-gray-600">
                {[
                  { icon: <Clock size={14} className="text-orange-400 shrink-0" />, text: "Pievienots tagad — pieejams līdz aizvākšanai" },
                  { icon: <Package size={14} className="text-orange-400 shrink-0" />, text: "Tieši no ražotāja — bez starpniekiem" },
                  { icon: <ShoppingBag size={14} className="text-orange-400 shrink-0" />, text: "Rezervē un saņem pakomātā" },
                ].map((f, i) => (
                  <li key={i} className="flex items-center gap-2">
                    {f.icon} {f.text}
                  </li>
                ))}
              </ul>
              <Link href="/keriens"
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 px-5 py-2.5 text-sm font-bold text-white hover:opacity-90 transition">
                <Flame size={14} /> Atvērt sadaļu
              </Link>
            </div>

            {/* Right — mock card previews */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { title: "Svaigi tomāti 1kg", price: "1.80", unit: "kg", badge: "🔥 HOT", color: "from-red-100 to-orange-50" },
                { title: "Mājas siers 500g", price: "3.50", unit: "gb.", badge: "🆕 NEW", color: "from-green-100 to-emerald-50" },
                { title: "Medus 0.5L", price: "6.00", unit: "burk.", badge: "⚡ ENDING", color: "from-yellow-100 to-amber-50" },
                { title: "Kūpināta gaļa", price: "5.20", unit: "kg", badge: "🟣 MAZ", color: "from-purple-100 to-violet-50" },
              ].map((item) => (
                <div key={item.title}
                  className={`rounded-2xl bg-gradient-to-br ${item.color} border border-white p-3 opacity-60 select-none`}>
                  <div className="mb-2 inline-block rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold text-gray-700">
                    {item.badge}
                  </div>
                  <p className="text-xs font-bold text-gray-800 leading-tight">{item.title}</p>
                  <p className="mt-1 text-sm font-extrabold text-gray-900">€{item.price} <span className="text-xs font-normal text-gray-400">/ {item.unit}</span></p>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-white/60 overflow-hidden">
                    <div className="h-full rounded-full bg-orange-400" style={{ width: `${30 + Math.random() * 50}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Seller CTA strip */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-orange-100 bg-white/80 px-6 py-4 backdrop-blur-sm">
          <p className="text-sm text-gray-600">
            <span className="font-semibold text-gray-900">Esi ražotājs?</span> Izmet savu pirmo partiju — pircēji redzēs uzreiz.
          </p>
          <Link href="/dashboard/keriens/jauns"
            className="flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-600 hover:bg-orange-100 transition">
            <Flame size={14} /> Pievienot drop
          </Link>
        </div>

      </div>
    </section>
  );
}
