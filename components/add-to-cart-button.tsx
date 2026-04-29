"use client";

import { useState } from "react";
import { ShoppingCart, Check } from "lucide-react";
import { useCart } from "@/lib/cart-context";

type Props = {
  id: string;
  title: string;
  price: number;
  unit: string;
  image: string;
  sellerName: string;
  storageType: "frozen" | "chilled";
};

export function AddToCartButton({ id, title, price, unit, image, sellerName, storageType }: Props) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  function handle() {
    addItem({ id, title, price, unit, image, sellerName, storageType });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <button
      onClick={handle}
      className={`flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-base font-semibold transition-all ${
        added
          ? "bg-green-500 text-white"
          : "bg-[#192635] text-white hover:bg-[#243647]"
      }`}
    >
      {added ? <Check size={18} /> : <ShoppingCart size={18} />}
      {added ? "Pievienots grozam!" : "Pievienot grozam"}
    </button>
  );
}
