import Image from "next/image";
import Link from "next/link";
import { Clock, Users, ChefHat } from "lucide-react";
import { recipes } from "@/lib/recipes-data";
import { listings } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "IziPizi RECEPTE",
  description:
    "Iedvesma virtuvē — receptes ar Latvijas ražotāju produktiem. Iegādājies ingredienti tieši no fermas caur IziPizi pakomātu.",
  openGraph: {
    title: "Receptes — tirgus.izipizi.lv",
    description: "Receptes ar Latvijas ražotāju produktiem. Iegādājies ingredienti tieši no fermas.",
    url: "https://tirgus.izipizi.lv/receptes",
    type: "website" as const,
  },
};

const difficultyColor = {
  Viegla: "bg-green-100 text-green-700",
  Vidēja: "bg-amber-100 text-amber-700",
  Sarežģīta: "bg-red-100 text-red-700",
};

export default function ReceptesPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-extrabold text-gray-900">Receptes</h1>
        <p className="mt-2 text-gray-500 max-w-xl">
          Iedvesmojošas receptes no mūsu ražotāju produktiem — no ātrajām vakariņām līdz svētku galdam.
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {recipes.map((recipe) => {
          const products = recipe.linkedProductIds
            .map((id) => listings.find((l) => l.id === id))
            .filter(Boolean);
          const uniqueSellers = [...new Set(products.map((p) => p!.seller.farmName))];

          return (
            <Link key={recipe.slug} href={`/receptes/${recipe.slug}`}
              className="group flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow">

              {/* Image */}
              <div className="relative h-52 w-full overflow-hidden bg-gray-100">
                <Image
                  src={recipe.image}
                  alt={recipe.title}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
                <span className={cn(
                  "absolute left-3 top-3 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                  difficultyColor[recipe.difficulty]
                )}>
                  {recipe.difficulty}
                </span>
                <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-medium text-gray-700 backdrop-blur-sm">
                  {recipe.category}
                </span>
              </div>

              {/* Content */}
              <div className="flex flex-1 flex-col p-4">
                <h2 className="text-base font-extrabold text-gray-900 group-hover:text-brand-600 transition-colors leading-snug">
                  {recipe.title}
                </h2>
                <p className="mt-1.5 text-sm text-gray-500 line-clamp-2 flex-1">
                  {recipe.shortDesc}
                </p>

                {/* Meta */}
                <div className="mt-3 flex items-center gap-4 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <Clock size={12} /> {recipe.prepTime + recipe.cookTime} min
                  </span>
                  <span className="flex items-center gap-1">
                    <Users size={12} /> {recipe.servings} porcijas
                  </span>
                  <span className="flex items-center gap-1">
                    <ChefHat size={12} /> {recipe.difficulty}
                  </span>
                </div>

                {/* Linked products preview */}
                {products.length > 0 && (
                  <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                    {products.slice(0, 3).map((p) => (
                      <div key={p!.id} className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-gray-200 ring-2 ring-white">
                        <Image src={p!.image} alt={p!.title} fill className="object-cover" />
                      </div>
                    ))}
                    {products.length > 3 && (
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-xs font-semibold text-gray-500">
                        +{products.length - 3}
                      </span>
                    )}
                    <span className="ml-1 text-xs text-gray-400 truncate">
                      {uniqueSellers.join(", ")}
                    </span>
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
