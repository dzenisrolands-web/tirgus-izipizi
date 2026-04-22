import { notFound } from "next/navigation";
import { Star, CheckCircle, MapPin } from "lucide-react";
import { sellers, listings } from "@/lib/mock-data";
import { ListingCard } from "@/components/listing-card";

export async function generateStaticParams() {
  return sellers.map((s) => ({ id: s.id }));
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

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Profile header */}
      <div className="flex items-start gap-5">
        <img
          src={seller.avatar}
          alt={seller.name}
          className="h-20 w-20 rounded-full object-cover ring-2 ring-brand-100"
        />
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-gray-900">{seller.farmName}</h1>
            {seller.verified && (
              <span className="flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                <CheckCircle size={12} />
                Verificēts
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-gray-500">{seller.name}</p>
          <div className="mt-2 flex items-center gap-3 text-sm text-gray-600">
            <span className="flex items-center gap-1">
              <Star size={14} fill="currentColor" className="text-amber-400" />
              {seller.rating} · {seller.reviewCount} atsauksmes
            </span>
            <span className="text-gray-300">|</span>
            <span className="flex items-center gap-1">
              <MapPin size={14} className="text-gray-400" />
              {seller.location}
            </span>
          </div>
        </div>
      </div>

      {/* Listings */}
      <div className="mt-10">
        <h2 className="text-lg font-bold text-gray-900">
          Aktīvie sludinājumi ({sellerListings.length})
        </h2>
        {sellerListings.length === 0 ? (
          <p className="mt-4 text-sm text-gray-400">Pārdevējam pašlaik nav aktīvu sludinājumu.</p>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {sellerListings.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
