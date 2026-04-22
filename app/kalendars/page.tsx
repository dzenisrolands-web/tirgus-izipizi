import type { Metadata } from "next";
import { MapPin, Calendar, ExternalLink } from "lucide-react";
import {
  events,
  months,
  typeColors,
  typeEmoji,
  type EventType,
} from "@/lib/events-data";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Tirgu Kalendārs 2026 — Gadatirgi, Tirdziņi un Pārtikas Svētki Latvijā",
  description:
    "Visi zemnieku tirgi, gadatirgi, tirdziņi un pārtikas festivāli Latvijā 2026. gadā — datumi, vietas un apraksti. Atrod tuvāko tirgus savā reģionā.",
  keywords: [
    "gadatirgus latvija 2026",
    "tirdziņš latvija",
    "zemnieku tirgus",
    "pārtikas festivāls latvija",
    "tirgus kalendārs 2026",
    "vietējie produkti",
    "stādu tirgus",
    "amatniecības tirdziņš",
  ],
};

const allTypes = Array.from(new Set(events.map((e) => e.type))) as EventType[];
const allRegions = Array.from(
  new Set(events.filter((e) => e.region !== "Visa Latvija").map((e) => e.region))
).sort();

const recurring = events.filter((e) => e.month === 0);
const byMonth = Object.entries(months)
  .filter(([m]) => Number(m) > 0)
  .map(([m, label]) => ({
    month: Number(m),
    label,
    items: events.filter((e) => e.month === Number(m)),
  }))
  .filter((g) => g.items.length > 0);

function EventCard({ event }: { event: (typeof events)[number] }) {
  const colorClass = typeColors[event.type];
  const emoji = typeEmoji[event.type];
  return (
    <div className="group rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:shadow-md hover:border-brand-200">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", colorClass)}>
              {emoji} {event.type}
            </span>
            {event.recurring && (
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">
                Regulārs
              </span>
            )}
          </div>
          <h3 className="text-base font-bold text-gray-900 leading-snug group-hover:text-brand-700">
            {event.name}
          </h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Calendar size={12} />
              {event.dateLabel}
            </span>
            <span className="flex items-center gap-1">
              <MapPin size={12} />
              {event.address
                ? `${event.city} · ${event.address}`
                : event.city}
            </span>
          </div>
          <p className="mt-2.5 text-sm text-gray-600 leading-relaxed">
            {event.description}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function KalendarsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Page header */}
      <div className="max-w-2xl">
        <div className="flex items-center gap-2 text-sm text-brand-600 font-medium">
          <Calendar size={16} />
          <span>Latvija · 2026</span>
        </div>
        <h1 className="mt-2 text-3xl font-extrabold text-gray-900 sm:text-4xl">
          Tirgu Kalendārs 2026
        </h1>
        <p className="mt-3 text-gray-500">
          Zemnieku tirgi, gadatirgi, tirdziņi un pārtikas festivāli visā Latvijā
          2026. gadā. Atrod tuvāko tirgus un atbalsti vietējos ražotājus.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {allTypes.map((t) => (
            <span
              key={t}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
                typeColors[t]
              )}
            >
              {typeEmoji[t]} {t}
            </span>
          ))}
        </div>
      </div>

      {/* Stats bar */}
      <div className="mt-8 grid grid-cols-3 gap-4 rounded-2xl bg-gray-50 p-5 sm:grid-cols-4">
        {[
          { value: events.filter((e) => e.month > 0).length, label: "Pasākumi 2026" },
          { value: Array.from(new Set(events.map((e) => e.city))).length, label: "Pilsētas" },
          { value: byMonth.length, label: "Mēneši" },
          { value: allRegions.length, label: "Reģioni" },
        ].map((s) => (
          <div key={s.label} className="text-center">
            <p className="text-2xl font-extrabold text-brand-600">{s.value}</p>
            <p className="text-xs text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Regular markets */}
      <section className="mt-12">
        <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900">
          <span className="text-2xl">🔄</span> Regulārie tirgi
        </h2>
        <p className="mt-1 text-sm text-gray-500">Notiek neatkarīgi no sezonas</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {recurring.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      </section>

      {/* Monthly sections */}
      {byMonth.map(({ month, label, items }) => (
        <section key={month} className="mt-14" id={`month-${month}`}>
          <div className="flex items-baseline justify-between border-b border-gray-100 pb-3">
            <h2 className="text-xl font-bold text-gray-900">{label}</h2>
            <span className="text-sm text-gray-400">{items.length} pasākumi</span>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        </section>
      ))}

      {/* Jump-to-month nav */}
      <nav className="mt-16 rounded-2xl bg-gray-50 p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
          Pārlec uz mēnesi
        </p>
        <div className="flex flex-wrap gap-2">
          {byMonth.map(({ month, label }) => (
            <a
              key={month}
              href={`#month-${month}`}
              className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:border-brand-400 hover:text-brand-700 transition"
            >
              {label}
            </a>
          ))}
        </div>
      </nav>

      {/* SEO footer note */}
      <div className="mt-10 rounded-xl border border-gray-100 bg-gray-50 p-5 text-sm text-gray-500">
        <p>
          <strong className="text-gray-700">Vai esi organizators?</strong> Ja tavam
          pasākumam vajadzētu būt šeit, raksti mums uz{" "}
          <a href="mailto:tirgus@izipizi.lv" className="text-brand-600 underline">
            tirgus@izipizi.lv
          </a>
          . Dati apkopoti no{" "}
          <a href="https://gadatirgi.lv" target="_blank" rel="noopener" className="text-brand-600 underline inline-flex items-center gap-1">
            gadatirgi.lv <ExternalLink size={11} />
          </a>
          ,{" "}
          <a href="https://www.eventpartner.lv/lv/kalendars" target="_blank" rel="noopener" className="text-brand-600 underline inline-flex items-center gap-1">
            eventpartner.lv <ExternalLink size={11} />
          </a>{" "}
          un pašvaldību mājaslapām.
        </p>
      </div>
    </div>
  );
}
