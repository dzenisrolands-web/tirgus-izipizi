import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Clock, Users, ChefHat, ArrowLeft, CheckCircle, Lightbulb } from "lucide-react";
import { recipes } from "@/lib/recipes-data";
import { listings } from "@/lib/mock-data";
import { formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { RecipeAddToCart } from "@/components/recipe-add-to-cart";

export function generateStaticParams() {
  return recipes.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const recipe = recipes.find((r) => r.slug === slug);
  if (!recipe) return {};
  return { title: `${recipe.title} — receptes | tirgus.izipizi.lv` };
}

const difficultyColor = {
  Viegla: "bg-green-100 text-green-700",
  Vidēja: "bg-amber-100 text-amber-700",
  Sarežģīta: "bg-red-100 text-red-700",
};

export default async function RecipePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const recipe = recipes.find((r) => r.slug === slug);
  if (!recipe) notFound();

  const linkedProducts = recipe.linkedProductIds
    .map((id) => listings.find((l) => l.id === id))
    .filter(Boolean) as typeof listings;
  const relatedRecipes = recipes.filter((r) => r.slug !== recipe.slug).slice(0, 3);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">

      {/* Back */}
      <Link href="/receptes" className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900">
        <ArrowLeft size={14} /> Atpakaļ uz receptēm
      </Link>

      {/* Hero */}
      <div className="relative h-72 sm:h-96 w-full overflow-hidden rounded-2xl bg-gray-100">
        <Image
          src={recipe.image}
          alt={recipe.title}
          fill
          className="object-cover"
          priority
          sizes="(max-width: 896px) 100vw, 896px"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <div className="flex flex-wrap gap-2 mb-2">
            <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", difficultyColor[recipe.difficulty])}>
              {recipe.difficulty}
            </span>
            <span className="rounded-full bg-white/20 backdrop-blur-sm px-2.5 py-0.5 text-xs font-medium text-white">
              {recipe.category}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">{recipe.title}</h1>
          <p className="mt-1 text-sm text-white/80 max-w-xl">{recipe.shortDesc}</p>
        </div>
      </div>

      {/* Meta bar */}
      <div className="mt-6 grid grid-cols-3 divide-x divide-gray-100 rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-col items-center py-4 gap-1">
          <Clock size={18} className="text-brand-600" />
          <p className="text-lg font-extrabold text-gray-900">{recipe.prepTime + recipe.cookTime}</p>
          <p className="text-xs text-gray-400">minūtes</p>
        </div>
        <div className="flex flex-col items-center py-4 gap-1">
          <Users size={18} className="text-brand-600" />
          <p className="text-lg font-extrabold text-gray-900">{recipe.servings}</p>
          <p className="text-xs text-gray-400">porcijas</p>
        </div>
        <div className="flex flex-col items-center py-4 gap-1">
          <ChefHat size={18} className="text-brand-600" />
          <p className="text-lg font-extrabold text-gray-900">{recipe.difficulty}</p>
          <p className="text-xs text-gray-400">sarežģītība</p>
        </div>
      </div>

      {/* Main content — two column */}
      <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-3">

        {/* Ingredients */}
        <div className="md:col-span-1">
          <div className="sticky top-24 space-y-4">
            <h2 className="text-lg font-extrabold text-gray-900">Sastāvdaļas</h2>
            {recipe.ingredients.map((group, gi) => (
              <div key={gi} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                {group.group && (
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">{group.group}</p>
                )}
                <ul className="space-y-2">
                  {group.items.map((item, ii) => (
                    <li key={ii} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" style={{ backgroundColor: "#53F3A4" }} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {/* Tip */}
            {recipe.tip && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <Lightbulb size={14} className="text-amber-600" />
                  <p className="text-xs font-semibold text-amber-700">Padoms</p>
                </div>
                <p className="text-sm text-amber-800">{recipe.tip}</p>
              </div>
            )}
          </div>
        </div>

        {/* Steps */}
        <div className="md:col-span-2 space-y-4">
          <h2 className="text-lg font-extrabold text-gray-900">Gatavošanas process</h2>
          <ol className="space-y-4">
            {recipe.steps.map((step, i) => (
              <li key={i} className="flex gap-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-white"
                  style={{ backgroundColor: "#192635" }}>
                  {i + 1}
                </div>
                <p className="text-sm text-gray-700 leading-relaxed pt-1">{step}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Linked products */}
      {linkedProducts.length > 0 && (
        <div className="mt-12">
          <div className="mb-3 flex items-center gap-2">
            <CheckCircle size={15} style={{ color: "#53F3A4" }} />
            <p className="text-sm font-extrabold text-gray-900">Receptē izmantojamie produkti</p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {linkedProducts.map((product) => (
              <div key={product.id} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-3 py-2.5 shadow-sm">
                <Link href={`/listing/${product.id}`} className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-gray-100 hover:opacity-80 transition">
                  <Image src={product.image} alt={product.title} fill className="object-cover" />
                </Link>
                <div className="flex-1 min-w-0">
                  <Link href={`/listing/${product.id}`} className="block truncate text-xs font-semibold text-gray-900 hover:text-brand-600">
                    {product.title}
                  </Link>
                  <p className="text-[11px] text-gray-400">{product.seller.farmName} · {formatPrice(product.price)}/{product.unit}</p>
                </div>
                <RecipeAddToCart product={product} compact />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Related recipes */}
      {relatedRecipes.length > 0 && (
        <div className="mt-12">
          <h2 className="mb-5 text-lg font-extrabold text-gray-900">Citas receptes</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {relatedRecipes.map((r) => (
              <Link key={r.slug} href={`/receptes/${r.slug}`}
                className="group flex gap-3 rounded-xl border border-gray-100 bg-white p-3 shadow-sm hover:shadow-md transition">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                  <Image src={r.image} alt={r.title} fill className="object-cover group-hover:scale-105 transition-transform duration-300" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2 group-hover:text-brand-600">
                    {r.title}
                  </p>
                  <p className="mt-1 text-xs text-gray-400 flex items-center gap-1">
                    <Clock size={10} /> {r.prepTime + r.cookTime} min
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
