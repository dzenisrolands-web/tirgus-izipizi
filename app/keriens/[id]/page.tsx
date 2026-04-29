import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, MapPin, Package, Thermometer, Clock } from "lucide-react";
import { fetchDropById } from "@/lib/hot-drops/queries";
import { availableQuantity } from "@/lib/hot-drops/types";
import { relativeTime } from "@/lib/utils";
import { DropBadgeStack } from "@/components/keriens/DropBadgeStack";
import { DropCountdown } from "@/components/keriens/DropCountdown";
import { DropAudioPlayer } from "@/components/keriens/DropAudioPlayer";
import { LockerSubscribeButton } from "@/components/locker-subscribe-button";
import { ReservePanel } from "./ReservePanel";

export const revalidate = 0;

const TEMP_LABELS = {
  chilled:  { icon: "❄️",  label: "Atdzesēts (2–8°C)" },
  frozen:   { icon: "🧊",  label: "Saldēts (−18°C)" },
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const drop = await fetchDropById(id);
  if (!drop) return {};
  const title = `${drop.title} — ${drop.seller.name}`;
  const description = drop.description
    ? drop.description.slice(0, 155)
    : `${drop.title} no ${drop.seller.name}. €${(drop.price_cents / 100).toFixed(2)}/${drop.unit}. Tieši no ražotāja, pieejams pakomātā.`;
  const ogImage = drop.cover_image_url
    ? [{ url: drop.cover_image_url, width: 1200, height: 630, alt: drop.title }]
    : undefined;
  return {
    title,
    description,
    openGraph: {
      title: `🔥 ${title}`,
      description,
      url: `https://tirgus.izipizi.lv/keriens/${id}`,
      images: ogImage,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `🔥 ${title}`,
      description,
      ...(ogImage && { images: [ogImage[0].url] }),
    },
  };
}

export default async function DropDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const drop = await fetchDropById(id);
  if (!drop) notFound();

  const avail = availableQuantity(drop);
  const total = drop.total_quantity;
  const pct = total > 0 ? Math.round((avail / total) * 100) : 0;
  const barColor = pct <= 20 ? "bg-red-500" : pct <= 50 ? "bg-orange-400" : "bg-green-500";
  const temp = TEMP_LABELS[drop.temperature_zone];
  const postedAt = drop.posted_at ?? drop.published_at ?? drop.created_at;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* Back */}
      <Link href="/keriens"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition">
        <ArrowLeft size={15} /> Visi sludinājumi
      </Link>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        {/* ── LEFT — image + audio + info ── */}
        <div className="space-y-5">
          {/* Cover */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 aspect-[16/9]">
            {drop.cover_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={drop.cover_image_url} alt={drop.title}
                className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center">
                <Package size={60} className="text-orange-200" />
              </div>
            )}
            <div className="absolute top-3 left-3">
              <DropBadgeStack drop={drop} />
            </div>
            {/* Temp zone chip */}
            <div className="absolute top-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-sm">
              {temp.icon} {temp.label}
            </div>
          </div>

          {/* Audio player — prominent if available */}
          {drop.audio_url && (
            <DropAudioPlayer src={drop.audio_url} sellerName={drop.seller.farm_name ?? drop.seller.name} />
          )}

          {/* Title + seller + posted */}
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 sm:text-3xl">{drop.title}</h1>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              {/* Seller chip */}
              <Link
                href={`/seller/${drop.seller.id}`}
                className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 hover:border-gray-300 transition"
              >
                {drop.seller.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={drop.seller.avatar_url} alt=""
                    className="h-6 w-6 rounded-full object-cover" />
                ) : (
                  <div className="h-6 w-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500">
                    {drop.seller.name.charAt(0)}
                  </div>
                )}
                <span className="text-sm font-semibold text-gray-800">
                  {drop.seller.farm_name ?? drop.seller.name}
                </span>
              </Link>

              {/* Posted timestamp */}
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Clock size={11} /> {relativeTime(postedAt)}
              </span>
            </div>

            {/* Location text — if seller specified one */}
            {drop.location_text && (
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700 border border-orange-100">
                <MapPin size={12} />
                Pievienots no: {drop.location_text}
              </div>
            )}
          </div>

          {/* Description */}
          {drop.description && (
            <div className="rounded-2xl border border-gray-100 bg-white p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Apraksts</p>
              <p className="text-sm leading-relaxed text-gray-700 whitespace-pre-line">{drop.description}</p>
            </div>
          )}

          {/* Details */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Kategorija</p>
              <p className="mt-0.5 text-sm font-semibold text-gray-800">{drop.category}</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Vienība</p>
              <p className="mt-0.5 text-sm font-semibold text-gray-800">{drop.unit}</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 col-span-2 sm:col-span-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Uzglabāšana</p>
              <p className="mt-0.5 text-sm font-semibold text-gray-800">{temp.icon} {temp.label}</p>
            </div>
          </div>

          {/* Locker + subscribe CTA */}
          {drop.pickup_locker && (
            <div className="rounded-2xl border-2 border-brand-100 bg-brand-50/40 p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100">
                  <MapPin size={18} className="text-brand-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wider text-brand-600">Saņemšanas pakomāts</p>
                  <p className="mt-0.5 font-bold text-gray-900">{drop.pickup_locker.name}</p>
                  <p className="text-sm text-gray-600">{drop.pickup_locker.address}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    <Thermometer size={10} className="inline mr-1" />
                    {drop.pickup_locker.hours}
                  </p>
                </div>
              </div>

              {/* Subscribe CTA */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white px-3 py-3 border border-brand-100">
                <p className="text-xs leading-snug text-gray-600">
                  🔔 <strong className="text-gray-900">Abonē šo pakomātu</strong> — saņem
                  paziņojumu, kad jauns sludinājums šeit
                </p>
                <LockerSubscribeButton lockerId={drop.pickup_locker.id} size="sm" />
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT — sticky reserve panel ── */}
        <div className="lg:sticky lg:top-24 lg:self-start space-y-4">
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-5">
            {/* Countdown */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Beidzas</span>
              <DropCountdown expiresAt={drop.expires_at} />
            </div>

            {/* Availability bar */}
            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs text-gray-500">
                <span>{avail} no {total} pieejami</span>
                <span className="font-semibold">{pct}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
              </div>
            </div>

            <ReservePanel drop={drop} />
          </div>
        </div>
      </div>
    </div>
  );
}
