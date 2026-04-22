import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, MapPin, Calendar, Tag, ExternalLink } from "lucide-react";
import { events, typeColors, typeEmoji, months } from "@/lib/events-data";
import { getEventDescription } from "@/lib/event-descriptions";
import { cn } from "@/lib/utils";

export async function generateStaticParams() {
  return events.map((e) => ({ id: e.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const event = events.find((e) => e.id === id);
  if (!event) return {};
  return {
    title: `${event.name} ${event.dateLabel} — ${event.city} | tirgus.izipizi.lv`,
    description: event.description,
    keywords: [
      event.name,
      event.city,
      event.region,
      event.type,
      "tirgus latvija 2026",
      "gadatirgus",
      "zemnieku tirgus",
    ],
  };
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = events.find((e) => e.id === id);
  if (!event) notFound();

  const longDescription = await getEventDescription(event.id);

  const related = events
    .filter(
      (e) =>
        e.id !== event.id &&
        (e.type === event.type || e.region === event.region) &&
        e.month > 0
    )
    .slice(0, 3);

  const monthLabel = event.month > 0 ? months[event.month] : null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Back */}
      <Link
        href="/kalendars"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-8"
      >
        <ArrowLeft size={15} />
        Atpakaļ uz kalendāru
      </Link>

      <div className="grid gap-10 lg:grid-cols-[1fr_280px]">
        {/* Main */}
        <article>
          {/* Type badge */}
          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold", typeColors[event.type])}>
            {typeEmoji[event.type]} {event.type}
          </span>

          <h1 className="mt-3 text-3xl font-extrabold text-gray-900 leading-tight">
            {event.name}
          </h1>

          {/* Meta row */}
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-500">
            <span className="flex items-center gap-1.5">
              <Calendar size={14} className="text-brand-500" />
              {event.dateLabel}
              {monthLabel && ` · ${monthLabel} 2026`}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin size={14} className="text-brand-500" />
              {event.city}
              {event.address && ` · ${event.address}`}
            </span>
            <span className="flex items-center gap-1.5">
              <Tag size={14} className="text-brand-500" />
              {event.region}
            </span>
          </div>

          {/* Long description */}
          <div className="mt-8 prose prose-gray max-w-none">
            {longDescription.split("\n\n").map((para, i) => (
              <p key={i} className="mt-4 text-gray-700 leading-relaxed">
                {para}
              </p>
            ))}
          </div>

          {/* CTA */}
          <div className="mt-10 rounded-2xl bg-brand-50 border border-brand-100 p-5">
            <p className="font-semibold text-brand-900">Pārdod savus produktus šajā tirgū?</p>
            <p className="mt-1 text-sm text-brand-700">
              Reģistrējies tirgus.izipizi.lv kā pārdevējs un sasniedz vairāk klientu —
              arī caur izipizi pakomātiem starp tirgus dienām.
            </p>
            <Link href="/sell" className="btn-primary mt-4 inline-flex text-sm">
              Kļūt par pārdevēju →
            </Link>
          </div>
        </article>

        {/* Sidebar */}
        <aside className="space-y-5">
          {/* Event details card */}
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
              Pasākuma dati
            </p>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-gray-400">Datums</dt>
                <dd className="font-semibold text-gray-900 mt-0.5">{event.dateLabel}</dd>
              </div>
              <div>
                <dt className="text-gray-400">Pilsēta</dt>
                <dd className="font-semibold text-gray-900 mt-0.5">{event.city}</dd>
              </div>
              {event.address && (
                <div>
                  <dt className="text-gray-400">Adrese</dt>
                  <dd className="font-semibold text-gray-900 mt-0.5">{event.address}</dd>
                </div>
              )}
              <div>
                <dt className="text-gray-400">Reģions</dt>
                <dd className="font-semibold text-gray-900 mt-0.5">{event.region}</dd>
              </div>
              <div>
                <dt className="text-gray-400">Veids</dt>
                <dd className="mt-0.5">
                  <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", typeColors[event.type])}>
                    {typeEmoji[event.type]} {event.type}
                  </span>
                </dd>
              </div>
              {event.source && (
                <div>
                  <dt className="text-gray-400">Avots</dt>
                  <dd className="mt-0.5">
                    <a href={`https://${event.source}`} target="_blank" rel="noopener" className="text-brand-600 hover:underline inline-flex items-center gap-1 text-xs">
                      {event.source} <ExternalLink size={10} />
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Related events */}
          {related.length > 0 && (
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
                Līdzīgi pasākumi
              </p>
              <ul className="space-y-3">
                {related.map((r) => (
                  <li key={r.id}>
                    <Link href={`/kalendars/${r.id}`} className="group block">
                      <p className="text-sm font-semibold text-gray-900 group-hover:text-brand-600 leading-snug">
                        {r.name}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {r.dateLabel} · {r.city}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
