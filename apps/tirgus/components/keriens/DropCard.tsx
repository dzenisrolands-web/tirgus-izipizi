"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Package, MapPin, Volume2, Pause } from "lucide-react";
import { availableQuantity } from "@/lib/hot-drops/types";
import { DropBadgeStack } from "./DropBadgeStack";
import { DropCountdown } from "./DropCountdown";
import { BuyButton } from "./BuyButton";
import type { HotDropWithSeller } from "@/lib/hot-drops/types";

export function DropCard({ drop }: { drop: HotDropWithSeller }) {
  const avail = availableQuantity(drop);
  const total = drop.total_quantity;
  const pct = total > 0 ? Math.round((avail / total) * 100) : 0;

  const barColor =
    pct <= 20 ? "bg-red-500" :
    pct <= 50 ? "bg-orange-400" :
    "bg-green-500";

  const [audioPlaying, setAudioPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function toggleAudio(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!audioRef.current) return;
    if (audioPlaying) audioRef.current.pause();
    else audioRef.current.play();
  }

  return (
    <div className="group flex flex-col rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      {/* Cover image */}
      <Link href={`/keriens/${drop.id}`} className="relative block aspect-[4/3] bg-gradient-to-br from-orange-50 to-amber-50 overflow-hidden">
        {drop.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={drop.cover_image_url} alt={drop.title}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Package size={40} className="text-orange-200" />
          </div>
        )}
        {/* Badges overlay */}
        <div className="absolute top-2 left-2">
          <DropBadgeStack drop={drop} />
        </div>
        {/* Temp zone chip */}
        <div className="absolute top-2 right-2 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
          {drop.temperature_zone === "chilled" ? "❄️ Atdzesēts" : "🧊 Saldēts"}
        </div>
        {/* Audio play button overlay */}
        {drop.audio_url && (
          <button
            onClick={toggleAudio}
            className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-orange-500 text-white shadow-lg ring-2 ring-white hover:bg-orange-600 transition"
            title="Dzirdēt pārdevēja balsi"
          >
            {audioPlaying ? <Pause size={14} fill="white" /> : <Volume2 size={14} />}
            <audio
              ref={audioRef}
              src={drop.audio_url}
              onPlay={() => setAudioPlaying(true)}
              onPause={() => setAudioPlaying(false)}
              onEnded={() => setAudioPlaying(false)}
              preload="none"
              className="hidden"
            />
          </button>
        )}
      </Link>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div>
          <Link href={`/keriens/${drop.id}`}
            className="line-clamp-2 text-sm font-bold text-gray-900 hover:text-orange-600 transition-colors leading-snug">
            {drop.title}
          </Link>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500 truncate">
            <span className="truncate">{drop.seller.name}</span>
            {drop.location_text && (
              <>
                <span className="text-gray-300">·</span>
                <span className="flex items-center gap-0.5 truncate text-orange-600">
                  <MapPin size={9} className="shrink-0" />
                  <span className="truncate">{drop.location_text}</span>
                </span>
              </>
            )}
          </div>
        </div>

        {/* Quantity bar */}
        <div>
          <div className="mb-1 flex items-center justify-between text-[10px] text-gray-400">
            <span>{avail} no {total} pieejami</span>
            <span>{pct}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
            <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Locker + countdown */}
        <div className="flex items-center justify-between text-[11px] text-gray-400">
          <span className="flex items-center gap-1 truncate">
            <MapPin size={10} className="shrink-0" />
            <span className="truncate">{drop.pickup_locker?.name ?? drop.pickup_locker_id}</span>
          </span>
          <DropCountdown expiresAt={drop.expires_at} />
        </div>

        {/* Buy button */}
        <BuyButton drop={drop} />
      </div>
    </div>
  );
}
