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
  storageType: "frozen" | "chilled";
  variants: Variant[];
};

export function VariantSelector({ listingId, title, image, sellerName, storageType, variants }: Props) {
  const { addItem } = useCart();
  const [selected, setSelected] = useState(variants[0].id);
  const [added, setAdded] = useState(false);

  const variant = variants.find((v) => v.id === selected)!;

  function handle() {
    addItem({
      id: `${listingId}-${variant.id}`,
      title: `${title} — ${variant.title}`,
      price: variant.price,
      unit: "gab.",
      image,
      sellerName,
      storageType,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-2 text-sm font-semibold text-gray-700">Izvēlies apjomu</p>
        <div className="flex flex-wrap gap-2">
          {variants.map((v) => (
            <button
              key={v.id}
              onClick={() => setSelected(v.id)}
              className={`rounded-xl border-2 px-4 py-2 text-sm font-semibold transition ${
                selected === v.id
                  ? "border-[#192635] bg-[#192635] text-white"
                  : "border-gray-200 text-gray-700 hover:border-gray-300"
              }`}
            >
              <span>{v.title}</span>
              <span className={`ml-2 text-xs ${selected === v.id ? "text-gray-300" : "text-gray-400"}`}>
                {formatPrice(v.price)}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-extrabold text-gray-900 sm:text-3xl">{formatPrice(variant.price)}</span>
        <span className="text-sm text-gray-400">/ {variant.title}</span>
      </div>

      <button
        onClick={handle}
        className={`flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-base font-semibold transition-all ${
          added ? "bg-green-500 text-white" : "bg-[#192635] text-white hover:bg-[#243647]"
        }`}
      >
        {added ? <Check size={18} /> : <ShoppingCart size={18} />}
        {added ? "Pievienots grozam!" : "Pievienot grozam"}
      </button>
    </div>
  );
}
