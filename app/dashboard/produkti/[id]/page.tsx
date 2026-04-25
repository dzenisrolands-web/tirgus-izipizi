"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ProductForm, type ProductData } from "@/components/product-form";

export default function EditProduktisPage() {
  const { id } = useParams<{ id: string }>();
  const [initial, setInitial] = useState<Partial<ProductData> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("listings").select("*").eq("id", id).single().then(({ data }) => {
      if (data) {
        setInitial({
          title: data.title ?? "",
          description: data.description ?? "",
          price: String(data.price ?? ""),
          unit: data.unit ?? "gab.",
          category: data.category ?? "",
          image_url: data.image_url ?? "",
          locker_id: data.locker_id ?? "",
          quantity: String(data.quantity ?? 1),
          status: data.status ?? "active",
        });
      }
      setLoading(false);
    });
  }, [id]);

  if (loading) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
    </div>
  );

  if (!initial) return (
    <div className="flex min-h-[60vh] items-center justify-center text-sm text-gray-500">
      Produkts nav atrasts
    </div>
  );

  return <ProductForm initial={initial} productId={id} />;
}
