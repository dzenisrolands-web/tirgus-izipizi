"use client";

import { useState } from "react";
import { ShoppingCart, Check } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { getStorageType } from "@/lib/utils";
import type { Listing } from "@/lib/mock-data";

export function RecipeAddToCart({ product, compact = false }: { product: Listing; compact?: boolean }) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  function handle() {
    addItem({
      id: product.id,
      title: product.title,
      price: product.price,
      unit: product.unit,
      image: product.image,
      sellerName: product.seller.farmName,
      storageType: getStorageType(product),
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  if (compact) {
    return (
      <button
        onClick={handle}
        title={added ? "Pievienots!" : "Ielikt grozā"}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all ${
          added ? "bg-green-500 text-white" : "bg-[#192635] text-white hover:bg-[#243647]"
        }`}
      >
        {added ? <Check size={13} /> : <ShoppingCart size={13} />}
      </button>
    );
  }

  return (
    <button
      onClick={handle}
      className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all ${
        added ? "bg-green-500 text-white" : "bg-[#192635] text-white hover:bg-[#243647]"
      }`}
    >
      {added ? <Check size={16} /> : <ShoppingCart size={16} />}
      {added ? "Pievienots!" : "Ielikt grozā"}
    </button>
  );
}
