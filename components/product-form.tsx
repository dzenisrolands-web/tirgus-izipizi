"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2, Upload, X, Zap, Percent, Truck, Warehouse, Package, CheckCircle2, Clock, Mail, Phone, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { lockers, categories } from "@/lib/mock-data";
import { COMMISSION_RATE, COMMISSION_SERVICE_VAT, commissionBreakdown, commissionForPrice, netForPrice, vatAmountFromInclusive, exVatPrice, VAT_RATES, type VatRate } from "@/lib/commission";
import { toUniqueSlug } from "@/lib/utils";

const UNITS = ["gab.", "kg", "g", "L", "ml", "100g", "500g", "komplekts", "paka"];
const CATS = categories.filter(c => c !== "Visi");

export type FormVariant = { id: string; title: string; price: string; quantity: string };

export type ProductData = {
  title: string;
  description: string;
  price: string;
  unit: string;
  category: string;
  image_url: string;
  locker_id: string;
  quantity: string;
  status: "active" | "paused";
  express_delivery: boolean;
  courier_delivery: boolean;
  vat_rate: VatRate;
  variants: FormVariant[];
  dispatch_days: string[];
};

const QUICK_SIZES = ["100g", "200g", "250g", "500g", "1kg", "2kg", "5kg", "100ml", "250ml", "500ml", "1L", "3L", "5L"];

function newVariant(title = ""): FormVariant {
  return { id: crypto.randomUUID(), title, price: "", quantity: "" };
}

const EMPTY: ProductData = {
  title: "", description: "", price: "", unit: "gab.",
  category: CATS[0], image_url: "", locker_id: lockers[0]?.id ?? "",
  quantity: "1", status: "active", express_delivery: false, courier_delivery: true,
  vat_rate: 21, variants: [], dispatch_days: [],
};

export function ProductForm({
  initial,
  productId,
}: {
  initial?: Partial<ProductData>;
  productId?: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState<ProductData>({
    ...EMPTY,
    ...initial,
    express_delivery: initial?.express_delivery ?? false,
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [sellerDelivery, setSellerDelivery] = useState<{
    home_locker_ids: string[];
    courier_pickup_address: string | null;
    delivery_mode: string | null;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load seller's pickup settings from profile
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("sellers")
        .select("home_locker_ids, courier_pickup_address, delivery_mode")
        .eq("user_id", user.id)
        .single();
      if (data) setSellerDelivery(data);
    })();
  }, []);

  const priceNum = Number(form.price) || 0;
  const cb = commissionBreakdown(priceNum, form.vat_rate);
  const vatAmt = vatAmountFromInclusive(priceNum, form.vat_rate);

  // Active (open) lockers — exclude pickup_only and coming_soon
  const activeLockers = lockers.filter(l => !l.pickup_only && !l.coming_soon);
  const comingSoonCount = lockers.filter(l => l.coming_soon && !l.pickup_only).length;

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Lūdzu izvēlies attēla failu"); return; }
    if (file.size > 5 * 1024 * 1024) { setError("Attēls nedrīkst pārsniegt 5 MB"); return; }

    setUploading(true);
    setError("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nav pieslēdzies");
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("product-images").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      set("image_url", data.publicUrl);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Kļūda augšupielādējot attēlu");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function set(k: keyof ProductData, v: string) {
    setForm(f => ({ ...f, [k]: v }));
  }
  function toggle(k: keyof ProductData) {
    setForm(f => ({ ...f, [k]: !f[k] }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!form.title.trim()) return setError("Nosaukums ir obligāts");
    const hasVariants = form.variants.length > 0;
    if (!hasVariants && (!form.price || isNaN(Number(form.price)) || Number(form.price) <= 0))
      return setError("Ievadi derīgu cenu");
    if (hasVariants && form.variants.every(v => !v.title.trim() || !(Number(v.price) > 0)))
      return setError("Ievadi vismaz vienu apjomu ar nosaukumu un cenu");
    if (!form.image_url.trim())
      return setError("Bilde ir obligāta — produktu nevar publicēt bez bildes. Lūdzu augšupielādē attēlu sadaļā 'Bilde'.");

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nav pieslēdzies");

      const { data: seller } = await supabase
        .from("sellers")
        .select("id")
        .eq("user_id", user.id)
        .single();

      // Build validated variants array
      const variantsJson = form.variants.length > 0
        ? form.variants
            .filter(v => v.title.trim() && Number(v.price) > 0)
            .map(v => ({
              id: v.id,
              title: v.title.trim(),
              price: Number(v.price),
              quantity: Number(v.quantity) > 0 ? Number(v.quantity) : 99,
            }))
        : [];

      const base = {
        user_id: user.id,
        seller_id: seller?.id ?? null,
        title: form.title.trim(),
        slug: productId ? undefined : toUniqueSlug(form.title.trim(), crypto.randomUUID()),
        description: form.description.trim(),
        price: variantsJson.length > 0
          ? Math.min(...variantsJson.map(v => v.price))
          : Number(form.price),
        unit: form.unit,
        category: form.category,
        image_url: form.image_url.trim(),
        locker_id: form.locker_id,
        quantity: Number(form.quantity) || 1,
        express_delivery: form.express_delivery,
        commission_rate: COMMISSION_RATE,
        commission_status: "approved",
        vat_rate: form.vat_rate,
        courier_delivery: form.courier_delivery,
        variants: variantsJson,
        dispatch_days: form.dispatch_days,
        updated_at: new Date().toISOString(),
      };

      if (productId) {
        const { error } = await supabase.from("listings").update(base).eq("id", productId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("listings").insert({ ...base, status: "pending_review" });
        if (error) throw error;
      }

      router.push("/dashboard/produkti");
      router.refresh();
    } catch (err: unknown) {
      const e = err as Record<string, unknown>;
      const msg = (typeof e?.message === "string" && e.message)
        ? e.message
        : (typeof e?.details === "string" && e.details)
          ? `${e.code ?? ""}: ${e.details}`
          : JSON.stringify(err);
      setError(msg || "Kļūda saglabājot");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl px-6 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900">
          {productId ? "Rediģēt produktu" : "Jauns produkts"}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {productId ? "Mainīt produkta informāciju" : "Pievieno jaunu produktu savam katalogam"}
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Basic info */}
      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
        <h2 className="text-sm font-extrabold text-gray-700">Pamatinformācija</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700">Nosaukums *</label>
          <input value={form.title} onChange={e => set("title", e.target.value)}
            className="input mt-1 w-full" placeholder="Piemēram: Brieža gaļas pelmeņi 400g" required />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Apraksts</label>
          <textarea value={form.description} onChange={e => set("description", e.target.value)}
            rows={4} className="input mt-1 w-full resize-y"
            placeholder="Sastāvdaļas, ražošanas veids, uzglabāšana..." />
        </div>

        {form.variants.length === 0 && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Cena (€) *</label>
              <input type="number" step="0.01" min="0" value={form.price} onChange={e => set("price", e.target.value)}
                className="input mt-1 w-full" placeholder="4.99" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Vienība</label>
              <select value={form.unit} onChange={e => set("unit", e.target.value)} className="input mt-1 w-full">
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Kategorija</label>
            <select value={form.category} onChange={e => set("category", e.target.value)} className="input mt-1 w-full">
              {CATS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {form.variants.length === 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Daudzums (gab.)</label>
              <input type="number" min="0" value={form.quantity} onChange={e => set("quantity", e.target.value)}
                className="input mt-1 w-full" placeholder="10" />
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">PVN likme *</label>
          <select
            value={form.vat_rate}
            onChange={e => setForm(f => ({ ...f, vat_rate: Number(e.target.value) as VatRate }))}
            className="input mt-1 w-full"
          >
            <option value={21}>21%</option>
            <option value={12}>12%</option>
            <option value={5}>5%</option>
          </select>
        </div>
      </section>

      {/* Variants */}
      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
        <div>
          <h2 className="text-sm font-extrabold text-gray-700">Dažādi apjomi vai izmēri</h2>
          <p className="mt-1 text-xs text-gray-500">Ja produkts ir pieejams vairākos daudzumos (piemēram, 1L, 3L, 5L vai 500g, 1kg), aktivizē šo sadaļu.</p>
        </div>

        <button
          type="button"
          onClick={() => setForm(f => ({ ...f, variants: f.variants.length > 0 ? [] : [newVariant()] }))}
          className={`flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left transition ${
            form.variants.length > 0 ? "border-brand-400 bg-brand-50" : "border-gray-200 bg-gray-50 hover:border-gray-300"
          }`}
        >
          <div className={`h-5 w-9 rounded-full transition-colors flex-shrink-0 ${
            form.variants.length > 0 ? "bg-brand-400" : "bg-gray-300"
          }`}>
            <div className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${
              form.variants.length > 0 ? "translate-x-4" : "translate-x-0"
            }`} />
          </div>
          <span className={`text-sm font-semibold ${form.variants.length > 0 ? "text-brand-800" : "text-gray-700"}`}>
            Pievienot dažādus apjomus / izmērus
          </span>
        </button>

        {form.variants.length > 0 && (
          <div className="space-y-3">
            {/* Quick-add size chips */}
            <div>
              <p className="text-xs text-gray-500 mb-2">Ātrā pievienošana:</p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_SIZES.map(s => {
                  const exists = form.variants.some(v => v.title === s);
                  return (
                    <button
                      key={s} type="button"
                      disabled={exists}
                      onClick={() => setForm(f => ({ ...f, variants: [...f.variants, newVariant(s)] }))}
                      className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                        exists
                          ? "border-brand-300 bg-brand-50 text-brand-600 opacity-50 cursor-default"
                          : "border-gray-200 bg-white text-gray-600 hover:border-brand-400 hover:text-brand-700"
                      }`}
                    >{s}</button>
                  );
                })}
              </div>
            </div>

            {/* Column headers */}
            <div className="grid gap-2" style={{gridTemplateColumns: '1fr 7rem 6rem 2.25rem'}}>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-1">Apjoms / izmērs</p>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-1">Cena €</p>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-1">Atlikums</p>
              <span />
            </div>

            {/* Variant rows */}
            <div className="space-y-2">
              {form.variants.map((v, i) => (
                <div key={v.id} className="grid items-center gap-2" style={{gridTemplateColumns: '1fr 7rem 6rem 2.25rem'}}>
                  <input
                    value={v.title}
                    onChange={e => setForm(f => ({ ...f, variants: f.variants.map((x, j) => j === i ? { ...x, title: e.target.value } : x) }))}
                    placeholder="piem. 500g, 1L, Mazā"
                    className="input text-sm"
                  />
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">€</span>
                    <input
                      type="number" step="0.01" min="0"
                      value={v.price}
                      onChange={e => setForm(f => ({ ...f, variants: f.variants.map((x, j) => j === i ? { ...x, price: e.target.value } : x) }))}
                      placeholder="0.00"
                      className="input w-full pl-6 text-sm"
                    />
                  </div>
                  <input
                    type="number" min="0"
                    value={v.quantity}
                    onChange={e => setForm(f => ({ ...f, variants: f.variants.map((x, j) => j === i ? { ...x, quantity: e.target.value } : x) }))}
                    placeholder="gab."
                    className="input text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, variants: f.variants.filter((_, j) => j !== i) }))}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 text-red-400 hover:bg-red-50 transition"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, variants: [...f.variants, newVariant()] }))}
              className="flex items-center gap-1.5 text-sm text-brand-600 hover:underline"
            >
              <Plus size={13} /> Pievienot vēl apjomu
            </button>

            <p className="text-xs text-gray-400">
              Klientam rādīsies pogas ar katru apjomu un cenu. Produkta pamata cena tiks automātiski iestatīta uz mazāko no variantiem.
            </p>
          </div>
        )}
      </section>

      {/* Commission + VAT breakdown */}
      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
        <h2 className="text-sm font-extrabold text-gray-700 flex items-center gap-2">
          <Percent size={14} className="text-brand-600" />
          Komisija un PVN aprēķins
        </h2>

        <div className="rounded-xl bg-blue-50 border border-blue-200 px-3 py-2.5 text-xs leading-relaxed text-blue-800">
          Komisija ir <strong>{COMMISSION_RATE}%</strong> no cenas <strong>bez produkta PVN</strong> + {COMMISSION_SERVICE_VAT}% PVN par komisijas pakalpojumu (SIA Svaigi ir PVN maksātājs). Produkta PVN ({form.vat_rate}%) noēmsi no saņemtās summas un maksāsi VID paš
        </div>

        {priceNum > 0 && (
          <div className="space-y-2">
            {/* Gross price */}
            <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-2.5">
              <span className="text-sm text-gray-600">Pārdošanas cena (ar PVN {form.vat_rate}%)</span>
              <span className="font-bold text-gray-900">{priceNum.toFixed(2)} €</span>
            </div>
            {/* Product VAT */}
            {form.vat_rate > 0 && (
              <div className="flex items-center justify-between rounded-xl bg-purple-50 border border-purple-200 px-4 py-2.5">
                <div>
                  <span className="text-sm text-purple-800">Produkta PVN {form.vat_rate}% (maxā VID)</span>
                  <p className="text-[10px] text-purple-600">Cena bez PVN: {cb.exVat.toFixed(2)} €</p>
                </div>
                <span className="font-bold text-purple-700">{vatAmt.toFixed(2)} €</span>
              </div>
            )}
            {/* Commission net */}
            <div className="flex items-center justify-between rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5">
              <div>
                <span className="text-sm text-amber-800">Platformas komisija {COMMISSION_RATE}% (no cenas bez PVN)</span>
                <p className="text-[10px] text-amber-600">{cb.exVat.toFixed(2)} € × {COMMISSION_RATE}%</p>
              </div>
              <span className="font-bold text-amber-700">−{cb.commissionNet.toFixed(2)} €</span>
            </div>
            {/* Commission VAT */}
            <div className="flex items-center justify-between rounded-xl bg-orange-50 border border-orange-200 px-4 py-2.5">
              <div>
                <span className="text-sm text-orange-800">PVN par komisijas pakalpojumu ({COMMISSION_SERVICE_VAT}%)</span>
                <p className="text-[10px] text-orange-600">{cb.commissionNet.toFixed(2)} € × {COMMISSION_SERVICE_VAT}%</p>
              </div>
              <span className="font-bold text-orange-700">−{cb.commissionVat.toFixed(2)} €</span>
            </div>
            {/* Net to seller */}
            <div className="flex items-center justify-between rounded-xl bg-green-50 border border-green-300 px-4 py-3">
              <div>
                <span className="text-sm font-bold text-green-900">Tu saņemsi</span>
                <p className="text-[10px] text-green-700">
                  Kopā ieturēts: −{cb.commissionTotal.toFixed(2)} € (komisija + PVN)
                </p>
              </div>
              <span className="text-lg font-extrabold text-green-700">{cb.netToSeller.toFixed(2)} €</span>
            </div>
          </div>
        )}

        {priceNum === 0 && (
          <p className="text-xs text-gray-400 text-center">Ievadi cenu, lai rēdzētu aprēķinu</p>
        )}
      </section>

      {/* Image */}
      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-extrabold text-gray-700">Bilde *</h2>
          {!form.image_url && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
              OBLIGĀTA
            </span>
          )}
        </div>

        {!form.image_url && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs leading-relaxed text-amber-800">
            ⚠ <strong>Produktu nevar publicēt bez bildes.</strong> Augšupielādē attēlu, lai produkts kļūtu redzams pircējiem.
          </div>
        )}

        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

        {form.image_url ? (
          <div className="relative h-56 w-full overflow-hidden rounded-xl bg-gray-100">
            <Image src={form.image_url} alt="Priekšskatījums" fill className="object-cover"
              onError={() => set("image_url", "")} />
            <button type="button" onClick={() => set("image_url", "")}
              className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 shadow hover:bg-white">
              <X size={14} className="text-gray-600" />
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 py-10 text-sm text-gray-500 hover:border-gray-300 hover:bg-gray-100 transition disabled:opacity-60">
            {uploading
              ? <><Loader2 size={24} className="animate-spin text-gray-400" /><span>Augšupielādē...</span></>
              : <><Upload size={24} className="text-gray-300" /><span className="font-medium">Spied šeit, lai augšupielādētu attēlu</span><span className="text-xs text-gray-400">JPG, PNG, WebP · maks. 5 MB</span></>
            }
          </button>
        )}

        {form.image_url && (
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
            className="flex items-center gap-1.5 text-sm text-brand-600 hover:underline disabled:opacity-50">
            <Upload size={13} />
            Nomainīt attēlu
          </button>
        )}
      </section>

      {/* Locker + delivery */}
      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-5">
        <div>
          <h2 className="text-sm font-extrabold text-gray-700">Piegāde un pieejamība</h2>
          <p className="mt-1 text-xs text-gray-500">
            Šis produkts klientiem būs piedāvājams sekojošajā veidā:
          </p>
        </div>

        {/* Seller's pickup location */}
        {sellerDelivery ? (
          <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 space-y-3">
            {/* Where seller drops off */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Nodošanas vieta</p>
              {sellerDelivery.delivery_mode === "courier" && sellerDelivery.courier_pickup_address ? (
                <div className="flex items-center gap-2">
                  <Truck size={15} className="shrink-0 text-brand-600" />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Kurjers paņem no Tevis</p>
                    <p className="text-xs text-gray-500">{sellerDelivery.courier_pickup_address}</p>
                  </div>
                </div>
              ) : sellerDelivery.home_locker_ids?.length > 0 ? (
                <div className="flex items-center gap-2">
                  <Package size={15} className="shrink-0 text-brand-600" />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">pārtikas pakomāts</p>
                    <p className="text-xs text-gray-500">
                      {sellerDelivery.home_locker_ids
                        .map(id => lockers.find(l => l.id === id)?.name ?? id)
                        .join(", ")}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-amber-700">
                  ⚠ Nodošanas vieta nav iestatīta.
                  <a href="/dashboard/profils" className="ml-1 font-semibold underline">Uzstādīt profilā →</a>
                </p>
              )}
            </div>
            {/* Where buyers can pick up */}
            <div className="border-t border-gray-200 pt-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Saņemšana pircējiem</p>
              <p className="text-xs text-gray-600 leading-relaxed">
                Produkts būs pieejams saņemšanai <strong>visos {activeLockers.length} IziPizi pārtikas pakomātos</strong>{" "}
                ({activeLockers.map(l => l.name).join(", ")}), kā arī ar kurjerpiegādi.
              </p>
              <p className="mt-1 text-xs text-amber-700">
                ⚠ <strong>Dundagas pārtikas pakomāts</strong> — prece pieejama saņemšanai Dundagā tikai tad, ja Tu to pats ieliec Dundagas pārtikas pakomātā.
              </p>
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700">Pārtikas pakomāts</label>
            <select value={form.locker_id} onChange={e => set("locker_id", e.target.value)} className="input mt-1 w-full">
              {lockers.map(l => (
                <option key={l.id} value={l.id}>{l.city} — {l.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Delivery toggles */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Piegādes iespējas</p>

          {/* Standard courier */}
          <button
            type="button"
            onClick={() => toggle("courier_delivery")}
            className={`flex w-full items-start gap-3 rounded-xl border-2 p-4 text-left transition ${
              form.courier_delivery
                ? "border-brand-400 bg-brand-50"
                : "border-gray-200 bg-gray-50 hover:border-gray-300"
            }`}
          >
            <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
              form.courier_delivery ? "bg-brand-100" : "bg-gray-200"
            }`}>
              <Truck size={17} className={form.courier_delivery ? "text-brand-600" : "text-gray-400"} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-semibold text-sm ${form.courier_delivery ? "text-brand-800" : "text-gray-700"}`}>
                🚚 Tradicīnā kurjerpiegāde
              </p>
              <p className="text-xs text-gray-500 mt-0.5">Piegāde uz mājām vai biroju mūsu piegādes zonās</p>
              {form.courier_delivery && (
                <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-brand-100/60 px-2.5 py-1.5">
                  <Clock size={11} className="text-brand-600 shrink-0" />
                  <p className="text-[11px] text-brand-800 font-medium">
                    Apkalpojot šo piegādi, Tev jāspēj izsniegt pasūtījumu <strong>1 dienas laikā</strong> pēc apstiprinājuma.
                  </p>
                </div>
              )}
            </div>
            <div className={`mt-0.5 h-5 w-9 rounded-full transition-colors flex-shrink-0 ${
              form.courier_delivery ? "bg-brand-400" : "bg-gray-300"
            }`}>
              <div className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${
                form.courier_delivery ? "translate-x-4" : "translate-x-0"
              }`} />
            </div>
          </button>

          {/* Express delivery */}
          <button
            type="button"
            onClick={() => toggle("express_delivery")}
            className={`flex w-full items-start gap-3 rounded-xl border-2 p-4 text-left transition ${
              form.express_delivery
                ? "border-yellow-400 bg-yellow-50"
                : "border-gray-200 bg-gray-50 hover:border-gray-300"
            }`}
          >
            <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
              form.express_delivery ? "bg-yellow-400/20" : "bg-gray-200"
            }`}>
              <Zap size={17} className={form.express_delivery ? "text-yellow-600" : "text-gray-400"} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-semibold text-sm ${form.express_delivery ? "text-yellow-800" : "text-gray-700"}`}>
                ⚡ Eksprespiegāde (2–5h)
              </p>
              <p className="text-xs text-gray-500 mt-0.5">Tajā pašā dienā Rīgā un Pierīgā — aktivīzē tikai ja vari nodrošināt</p>
              {form.express_delivery && (
                <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-yellow-100/80 px-2.5 py-1.5">
                  <Clock size={11} className="text-yellow-700 shrink-0" />
                  <p className="text-[11px] text-yellow-800 font-medium">
                    Eksprespiegādei jāspēj izsniegt pasūtījumu <strong>2 stundu laikā</strong> pēc pasūtījuma saņemšanas.
                  </p>
                </div>
              )}
            </div>
            <div className={`mt-0.5 h-5 w-9 rounded-full transition-colors flex-shrink-0 ${
              form.express_delivery ? "bg-yellow-400" : "bg-gray-300"
            }`}>
              <div className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${
                form.express_delivery ? "translate-x-4" : "translate-x-0"
              }`} />
            </div>
          </button>
        </div>

        {/* Warehouse / fulfillment service banner */}
        <div className="rounded-xl border border-[#53F3A4]/40 bg-[#192635] px-4 py-4">
          <div className="flex items-start gap-3">
            <Warehouse size={20} className="mt-0.5 shrink-0 text-[#53F3A4]" />
            <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white">Esi ārpus piegāžu zonas?</p>
              <p className="mt-1 text-xs text-gray-300 leading-relaxed">
                Piedāvājam uzglabāt Tavu preci kādā no mūsu <strong className="text-white">{activeLockers.length} pārtikas pakomātiem</strong>{comingSoonCount > 0 ? <span className="text-[#53F3A4]"> (+{comingSoonCount} drīzumā)</span> : null}{" "}
                un nodrošinām komplektēšanu un visus piegādes veidus tieši no pārtikas pakomāta.
              </p>
              <div className="mt-2.5 flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-xs text-gray-300">
                  <Mail size={11} className="shrink-0 text-[#53F3A4]" />
                  <span>birojs@izipizi.lv</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-300">
                  <Phone size={11} className="shrink-0 text-[#53F3A4]" />
                  <span>+371 20031552</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Dispatch days */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Izsniegšanas dienas</p>
          <p className="text-xs text-gray-400 mb-2">Atzīmē dienas, kad vari nodot/izsniegt pasūtījumus. Atstāj tukšu, ja pieejams ikdienā.</p>
          <div className="flex flex-wrap gap-1.5">
            {(["mon","tue","wed","thu","fri","sat","sun"] as const).map((d, i) => {
              const labels = ["P","O","T","C","Pk","S","Sv"];
              const active = form.dispatch_days.includes(d);
              return (
                <button key={d} type="button"
                  onClick={() => setForm(f => ({
                    ...f,
                    dispatch_days: active
                      ? f.dispatch_days.filter(x => x !== d)
                      : [...f.dispatch_days, d]
                  }))}
                  className={`h-9 w-9 rounded-full text-xs font-bold border-2 transition ${
                    active
                      ? i >= 5
                        ? "border-amber-400 bg-amber-50 text-amber-700"
                        : "border-brand-400 bg-brand-50 text-brand-700"
                      : "border-gray-200 bg-white text-gray-400 hover:border-gray-300"
                  }`}
                >{labels[i]}</button>
              );
            })}
          </div>
        </div>

        {!productId && (
          <p className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
            Produkts tiks iesniegts apstiprināšanai. Pēc apstiprināšanas tas parādīsies katalōgā.
          </p>
        )}
      </section>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving}
          className="btn-primary flex items-center gap-2 disabled:opacity-50">
          {saving && <Loader2 size={15} className="animate-spin" />}
          {productId ? "Saglabāt izmaiņas" : "Pievienot produktu"}
        </button>
        <button type="button" onClick={() => router.back()}
          className="btn-outline">
          Atcelt
        </button>
      </div>
    </form>
  );
}
