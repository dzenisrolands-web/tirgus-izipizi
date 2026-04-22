import type { Metadata } from "next";
import { Calendar } from "lucide-react";
import { typeColors, typeEmoji, type EventType } from "@/lib/events-data";
import { KalendarsClient } from "@/components/kalendars-client";
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

const types: EventType[] = [
  "Zemnieku tirgus",
  "Stādu tirgus",
  "Gadatirgus",
  "Pārtikas festivāls",
  "Amatniecības tirdziņš",
  "Ziemassvētku tirdziņš",
  "Sezonāls tirgus",
];

export default function KalendarsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="max-w-2xl">
        <div className="flex items-center gap-2 text-sm font-medium text-brand-600">
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
          {types.map((t) => (
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

      {/* Client-side filtered listing */}
      <KalendarsClient />
    </div>
  );
}
