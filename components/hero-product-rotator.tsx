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
const ROTATE_MS = 5000;
const FADE_MS = 300;
const FRESH_THRESHOLD_HOURS = 72;

export function HeroProductRotator({ products }: { products: HeroProduct[] }) {
  const [groupIdx, setGroupIdx] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);
  const groups = Math.max(1, Math.ceil(products.length / GROUP_SIZE));

  useEffect(() => {
    if (groups <= 1) return;
    const tick = setInterval(() => {
      setFadeOut(true);
      setTimeout(() => {
        setGroupIdx((i) => (i + 1) % groups);
        setFadeOut(false);
      }, FADE_MS);
    }, ROTATE_MS);
    return () => clearInterval(tick);
  }, [groups]);

  const start = groupIdx * GROUP_SIZE;
  const slice = products.slice(start, start + GROUP_SIZE);
  const visible =
    slice.length === GROUP_SIZE ? slice : [...slice, ...products.slice(0, GROUP_SIZE - slice.length)];

  return (
    <div
      className={`hidden grid-cols-2 gap-3 transition-opacity duration-300 lg:grid ${
        fadeOut ? "opacity-0" : "opacity-100"
      }`}
    >
      {visible.map((p) => (
        <Link
          key={`${groupIdx}-${p.id}`}
          href={`/listing/${p.id}`}
          className="group block overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition hover:border-white/20"
        >
          <div className="relative h-36 overflow-hidden bg-gray-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.image}
              alt={p.title}
              className="h-full w-full object-cover opacity-90 transition-transform duration-300 group-hover:scale-105"
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
  );
}

function isFresh(createdAt: string): boolean {
  const ageHours = (Date.now() - new Date(createdAt).getTime()) / 36e5;
  return ageHours >= 0 && ageHours < FRESH_THRESHOLD_HOURS;
}
