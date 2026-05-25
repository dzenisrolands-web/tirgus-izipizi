"use client";

import { useState } from "react";
import { ShoppingCart, Check } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { formatPrice } from "@/lib/utils";
import type { Variant } from "@/lib/mock-data";

type Props = {
  listingId: string;
  title: string;
  image: string;
  sellerName: string;
  sellerId?: string;
  storageType: "frozen" | "chilled";
  variants: Variant[];
  express_delivery?: boolean;
};

export function VariantSelector({ listingId, title, image, sellerName, sellerId, storageType, variants, express_delivery }: Props) {
  const { addItem } = useCart();
  const [selected, setSelected] = useState(variants[0].id);
  const [added, setAdded] = useState(false);

  const variant = variants.find((v) => v.id === selected)!;
  const outOfStock = variant.quantity === 0;

  function handle() {
    if (outOfStock) return;
    addItem({
      id: `${listingId}-${variant.id}`,
      title: `${title} — ${variant.title}`,
      price: variant.price,
      unit: "gab.",
      image,
      sellerName,
      sellerId,
      storageType,
      express_delivery: express_delivery ?? false,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-2 text-sm font-semibold text-gray-700">Izvēlies apjomu</p>
        <div className="flex flex-wrap gap-2">
          {variants.map((v) => {
            const oos = v.quantity === 0;
            const lowStock = v.quantity > 0 && v.quantity <= 5;
            return (
              <button
                key={v.id}
                onClick={() => setSelected(v.id)}
                disabled={oos}
                className={`relative rounded-xl border-2 px-4 py-2 text-sm font-semibold transition ${
                  oos
                    ? "border-gray-200 bg-gray-50 text-gray-300 cursor-not-allowed"
                    : selected === v.id
                      ? "border-[#192635] bg-[#192635] text-white"
                      : "border-gray-200 text-gray-700 hover:border-gray-300"
                }`}
              >
                <span>{v.title}</span>
                <span className={`ml-2 text-xs ${
                  oos ? "text-gray-300" : selected === v.id ? "text-gray-300" : "text-gray-400"
                }`}>
                  {oos ? "Beidzies" : formatPrice(v.price)}
                </span>
                {lowStock && !oos && (
                  <span className="absolute -top-1.5 -right-1.5 rounded-full bg-amber-400 px-1 py-0.5 text-[9px] font-bold text-amber-900 leading-none">
                    {v.quantity}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-extrabold text-gray-900 sm:text-3xl">{formatPrice(variant.price)}</span>
        <span className="text-sm text-gray-400">/ {variant.title}</span>
        {variant.quantity > 0 && variant.quantity <= 5 && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
            Atlikumā {variant.quantity} gab.
          </span>
        )}
      </div>

      <button
        onClick={handle}
        disabled={outOfStock}
        className={`flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-base font-semibold transition-all ${
          outOfStock
            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
            : added
              ? "bg-green-500 text-white"
              : "bg-[#192635] text-white hover:bg-[#243647]"
        }`}
      >
        {outOfStock ? <>❌ Izpārdots</> : added ? <><Check size={18} /> Pievienots grozam!</> : <><ShoppingCart size={18} /> Pievienot grozam</>}
      </button>
    </div>
  );
}
