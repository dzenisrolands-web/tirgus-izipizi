import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Star, CheckCircle, MapPin, Package } from "lucide-react";
import { sellers, listings } from "@/lib/mock-data";
import { sellersMeta } from "@/lib/sellers-meta";
import { SellerProducts } from "@/components/seller-products";

export async function generateStaticParams() {
  return sellers.map((s) => ({ id: s.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const seller = sellers.find((s) => s.id === id);
  if (!seller) return {};
  return {
    title: `${seller.name} — Produkti | tirgus.izipizi.lv`,
    description: sellersMeta[id]?.description || `${seller.name} produkti IziPizi tirgū.`,
  };
}

export default async function SellerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const seller = sellers.find((s) => s.id === id);
  if (!seller) notFound();

  const sellerListings = listings.filter((l) => l.sellerId === id);
  const meta = sellersMeta[id] ?? { cover: "", description: "" };
  const categories = Array.from(new Set(sellerListings.map((l) => l.category))).sort();

  return (
    <div>
      {/* Cover banner */}
      <div
        className="relative h-48 w-full bg-gradient-to-br from-brand-600 to-brand-900 sm:h-64"
        style={meta.cover ? { backgroundImage: `url(${meta.cover})`, backgroundSize: "cover", backgroundPosition: "center" } : {}}
      >
        <div className="absolute inset-0 bg-black/30" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Profile header */}
        <div className="relative -mt-12 flex items-end gap-5 pb-6 border-b border-gray-100">
          <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-4 border-white bg-white shadow-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={seller.avatar}
              alt={seller.name}
              className="h-full w-full object-contain p-1.5"
            />
          </div>
          <div className="pb-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-extrabold text-gray-900">{seller.name}</h1>
              {seller.verified && (
                <span className="flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
                  <CheckCircle size={12} />
                  Verificēts
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Star size={14} fill="currentColor" className="text-amber-400" />
                {seller.rating} · {seller.reviewCount} atsauksmes
              </span>
              <span className="flex items-center gap-1">
                <MapPin size={14} className="text-gray-400" />
                {seller.location}
              </span>
              <span className="flex items-center gap-1">
                <Package size={14} className="text-gray-400" />
                {sellerListings.length} produkti
              </span>
            </div>
          </div>
        </div>

        {/* Description */}
        {meta.description && (
          <p className="mt-5 max-w-2xl text-sm text-gray-600 leading-relaxed">
            {meta.description}
          </p>
        )}

        {/* Products — client component for search/filter */}
        <SellerProducts listings={sellerListings} categories={categories} />
      </div>
    </div>
  );
}
