"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type HeroProduct = {
  id: string;
  title: string;
  price: number;
  image: string;
  sellerName: string;
  createdAt: string;
};

const GROUP_SIZE = 4;
const ROTATE_MS = 3500;
const FRESH_THRESHOLD_HOURS = 72;

export function HeroProductRotator({ products }: { products: HeroProduct[] }) {
  const [groupIdx, setGroupIdx] = useState(0);
  const groups = Math.max(1, Math.ceil(products.length / GROUP_SIZE));

  useEffect(() => {
    if (groups <= 1) return;
    const tick = setInterval(() => setGroupIdx((i) => (i + 1) % groups), ROTATE_MS);
    return () => clearInterval(tick);
  }, [groups]);

  const start = groupIdx * GROUP_SIZE;
  const slice = products.slice(start, start + GROUP_SIZE);
  const visible =
    slice.length === GROUP_SIZE ? slice : [...slice, ...products.slice(0, GROUP_SIZE - slice.length)];

  return (
    <>
      <style>{`
        @keyframes heroTileReveal {
          0%   { opacity: 0; transform: scale(0.86) translateY(16px); filter: blur(6px); }
          55%  { filter: blur(0); }
          100% { opacity: 1; transform: scale(1)    translateY(0);    filter: blur(0); }
        }
      `}</style>
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {visible.map((p, i) => (
          <Link
            key={`${groupIdx}-${i}`}
            href={`/listing/${p.id}`}
            className="group block overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition hover:border-white/20 hover:shadow-[0_0_20px_rgba(83,243,164,0.15)]"
            style={{
              animation: `heroTileReveal 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${i * 90}ms both`,
              willChange: "transform, opacity, filter",
            }}
          >
            <div className="relative h-28 overflow-hidden bg-gray-800 sm:h-36">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.image}
                alt={p.title}
                className="h-full w-full object-cover opacity-90 transition-transform duration-500 group-hover:scale-110"
              />
              {isFresh(p.createdAt) && (
                <span className="absolute left-2 top-2 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-gray-900 shadow-sm">
                  🔥 Tikko
                </span>
              )}
            </div>
            <div className="p-3">
              <p className="line-clamp-1 text-xs font-bold leading-tight text-white">{p.title}</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <p className="line-clamp-1 text-[11px] text-gray-400">{p.sellerName}</p>
                <p className="shrink-0 text-xs font-bold text-green-400">€{p.price.toFixed(2)}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}

function isFresh(createdAt: string): boolean {
  const ageHours = (Date.now() - new Date(createdAt).getTime()) / 36e5;
  return ageHours >= 0 && ageHours < FRESH_THRESHOLD_HOURS;
}
