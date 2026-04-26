"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2, ImageIcon, Upload, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { lockers, categories } from "@/lib/mock-data";

const UNITS = ["gab.", "kg", "g", "L", "ml", "100g", "500g", "komplekts", "paka"];
const CATS = categories.filter(c => c !== "Visi");

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
};

const EMPTY: ProductData = {
  title: "", description: "", price: "", unit: "gab.",
  category: CATS[0], image_url: "", locker_id: lockers[0]?.id ?? "",
  quantity: "1", status: "active",
};

export function ProductForm({
  initial,
  productId,
}: {
  initial?: Partial<ProductData>;
  productId?: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState<ProductData>({ ...EMPTY, ...initial });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!form.title.trim()) return setError("Nosaukums ir obligāts");
    if (!form.price || isNaN(Number(form.price)) || Number(form.price) <= 0)
      return setError("Ievadi derīgu cenu");

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nav pieslēdzies");

      const { data: seller } = await supabase
        .from("sellers")
        .select("id")
        .eq("user_id", user.id)
        .single();

      const base = {
        user_id: user.id,
        seller_id: seller?.id ?? null,
        title: form.title.trim(),
        description: form.description.trim(),
        price: Number(form.price),
        unit: form.unit,
        category: form.category,
        image_url: form.image_url.trim(),
        locker_id: form.locker_id,
        quantity: Number(form.quantity) || 1,
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
      setError(err instanceof Error ? err.message : "Kļūda saglabājot");
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

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Cena (€) *</label>
            <input type="number" step="0.01" min="0" value={form.price} onChange={e => set("price", e.target.value)}
              className="input mt-1 w-full" placeholder="4.99" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Vienība</label>
            <select value={form.unit} onChange={e => set("unit", e.target.value)} className="input mt-1 w-full">
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Kategorija</label>
            <select value={form.category} onChange={e => set("category", e.target.value)} className="input mt-1 w-full">
              {CATS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Daudzums (gab.)</label>
            <input type="number" min="0" value={form.quantity} onChange={e => set("quantity", e.target.value)}
              className="input mt-1 w-full" placeholder="10" />
          </div>
        </div>
      </section>

      {/* Image */}
      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
        <h2 className="text-sm font-extrabold text-gray-700">Bilde</h2>

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

      {/* Locker */}
      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
        <h2 className="text-sm font-extrabold text-gray-700">Pakomāts</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700">Pakomāts</label>
          <select value={form.locker_id} onChange={e => set("locker_id", e.target.value)} className="input mt-1 w-full">
            {lockers.map(l => (
              <option key={l.id} value={l.id}>{l.city} — {l.name}</option>
            ))}
          </select>
        </div>
        {!productId && (
          <p className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
            Produkts tiks iesniegts apstiprināšanai. Pēc apstiprināšanas tas parādīsies katalogā.
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
