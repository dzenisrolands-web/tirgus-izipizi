"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { availableQuantity } from "@/lib/hot-drops/types";
import type { HotDrop } from "@/lib/hot-drops/types";

export function BuyButton({ drop }: { drop: HotDrop }) {
  const avail = availableQuantity(drop);
  const expired = new Date(drop.expires_at).getTime() < Date.now();
  const gone = avail <= 0;

  if (expired || gone) {
    return (
      <button disabled
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-bold text-gray-400 cursor-not-allowed">
        {gone ? "Izpārdots" : "Beidzies"}
      </button>
    );
  }

  return (
    <Link href={`/keriens/${drop.id}`}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 px-4 py-2.5 text-sm font-bold text-white shadow-md hover:opacity-90 active:scale-95 transition-all">
      <ShoppingBag size={14} />
      PIRKT — €{(drop.price_cents / 100).toFixed(2)}
    </Link>
  );
}
