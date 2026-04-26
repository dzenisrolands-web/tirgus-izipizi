"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Flame, Clock, Thermometer, Euro } from "lucide-react";
import { lockers, categories } from "@/lib/mock-data";
import { ImageUpload } from "@/components/image-upload";
import { createDrop, updateDrop } from "@/lib/hot-drops/queries";
import type { HotDrop, DropFormData, TemperatureZone } from "@/lib/hot-drops/types";

const CATS = categories.filter((c) => c !== "Visi");
const UNITS = ["gab.", "kg", "g", "L", "ml", "100g", "500g", "paka", "komplekts"];

function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 0, 0);
  return d;
}

const QUICK: { label: string; fn?: () => Date; ms?: number }[] = [
  { label: "2h",            ms: 2 * 60 * 60 * 1000 },
  { label: "6h",            ms: 6 * 60 * 60 * 1000 },
  { label: "Līdz pusnaktij",fn: endOfToday },
  { label: "24h",           ms: 24 * 60 * 60 * 1000 },
  { label: "3 dienas",      ms: 3 * 24 * 60 * 60 * 1000 },
];

const EMPTY: DropFormData = {
  title: "", description: "", category: CATS[0], unit: "gab.",
  price_cents: 0, total_quantity: 1,
  pickup_locker_id: lockers[0]?.id ?? "",
  temperature_zone: "ambient",
  expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
  cover_image_url: "",
};

export function DropForm({
  sellerId, userId, initial,
}: {
  sellerId: string; userId: string; initial?: HotDrop;
}) {
  const router = useRouter();
  const isEdit = !!initial;

  const [form, setForm] = useState<DropFormData>(
    initial ? {
      title: initial.title, description: initial.description ?? "",
      category: initial.category, unit: initial.unit,
      price_cents: initial.price_cents, total_quantity: initial.total_quantity,
      pickup_locker_id: initial.pickup_locker_id,
      temperature_zone: initial.temperature_zone,
      expires_at: initial.expires_at,
      cover_image_url: initial.cover_image_url ?? "",
    } : EMPTY
  );
  const [priceInput, setPriceInput] = useState(
    initial ? String((initial.price_cents / 100).toFixed(2)) : ""
  );
  const [quickIdx, setQuickIdx] = useState<number | "custom">(1);
  const [customExpiry, setCustomExpiry] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set<K extends keyof DropFormData>(k: K, v: DropFormData[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function applyQuick(i: number) {
    setQuickIdx(i);
    const q = QUICK[i];
    const date = q.fn ? q.fn() : new Date(Date.now() + (q.ms ?? 0));
    set("expires_at", date.toISOString());
  }

  function applyCustom(val: string) {
    setCustomExpiry(val);
    setQuickIdx("custom");
    if (val) set("expires_at", new Date(val).toISOString());
  }

  function handlePriceChange(val: string) {
    setPriceInput(val);
    const n = parseFloat(val);
    if (!isNaN(n) && n > 0) set("price_cents", Math.round(n * 100));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.title.trim())              return setError("Nosaukums ir obligāts");
    if (form.price_cents <= 0)           return setError("Ievadi derīgu cenu");
    if (form.total_quantity <= 0)        return setError("Daudzumam jābūt > 0");
    if (!form.pickup_locker_id)          return setError("Izvēlies pakomātu");
    if (new Date(form.expires_at) <= new Date()) return setError("Termiņš nedrīkst būt pagātnē");

    setSaving(true);
    try {
      if (isEdit && initial) {
        const ok = await updateDrop(initial.id, form);
        if (!ok) throw new Error("Kļūda saglabājot");
      } else {
        const drop = await createDrop(sellerId, userId, form);
        if (!drop) throw new Error("Kļūda izveidojot");
      }
      router.push("/dashboard/karstie-piradzini");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Kļūda");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl px-6 py-10 space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-gray-900">
          <Flame size={22} className="text-orange-500" />
          {isEdit ? "Rediģēt pīradziņu" : "Jauns karstais pīradziņš"}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {isEdit ? "Mainīt informāciju par partiju" : "Izmet svaigo partiju — pircēji redzēs uzreiz"}
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Image */}
      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <ImageUpload
          value={form.cover_image_url}
          onChange={(v) => set("cover_image_url", v)}
          path={`drops/${userId}`}
          label="Cover attēls"
          aspectRatio="wide"
          hint="JPG, PNG, WebP · maks. 5MB"
        />
      </section>

      {/* Basic info */}
      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
        <h2 className="text-sm font-extrabold text-gray-700">Pamatinformācija</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700">Nosaukums *</label>
          <input value={form.title} onChange={(e) => set("title", e.target.value)}
            className="input mt-1 w-full" placeholder="Piem.: 3 mājas vistas, šodienas partija" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Apraksts</label>
          <textarea value={form.description} onChange={(e) => set("description", e.target.value)}
            rows={3} className="input mt-1 w-full resize-y"
            placeholder="Audzēšanas veids, svars, papildinformācija..." />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Kategorija</label>
            <select value={form.category} onChange={(e) => set("category", e.target.value)} className="input mt-1 w-full">
              {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Vienība</label>
            <select value={form.unit} onChange={(e) => set("unit", e.target.value)} className="input mt-1 w-full">
              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>
      </section>

      {/* Price + quantity */}
      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
        <h2 className="flex items-center gap-2 text-sm font-extrabold text-gray-700">
          <Euro size={13} /> Cena un daudzums
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Cena par {form.unit} (€) *</label>
            <input type="number" step="0.01" min="0.01" value={priceInput}
              onChange={(e) => handlePriceChange(e.target.value)}
              className="input mt-1 w-full" placeholder="4.99" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Daudzums *</label>
            <input type="number" min="1" step="1" value={form.total_quantity}
              onChange={(e) => set("total_quantity", Number(e.target.value))}
              className="input mt-1 w-full" placeholder="5" required />
          </div>
        </div>
        {form.price_cents > 0 && form.total_quantity > 0 && (
          <p className="text-xs text-gray-400">
            Kopējā vērtība:{" "}
            <strong className="text-gray-700">
              €{((form.price_cents * form.total_quantity) / 100).toFixed(2)}
            </strong>
          </p>
        )}
      </section>

      {/* Duration */}
      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
        <h2 className="flex items-center gap-2 text-sm font-extrabold text-gray-700">
          <Clock size={13} /> Cik ilgi būs aktīvs?
        </h2>
        <div className="flex flex-wrap gap-2">
          {QUICK.map((q, i) => (
            <button key={i} type="button" onClick={() => applyQuick(i)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                quickIdx === i
                  ? "border-orange-400 bg-orange-500 text-white"
                  : "border-gray-200 bg-gray-50 text-gray-600 hover:border-orange-300"
              }`}>
              {q.label}
            </button>
          ))}
          <button type="button" onClick={() => setQuickIdx("custom")}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              quickIdx === "custom"
                ? "border-orange-400 bg-orange-500 text-white"
                : "border-gray-200 bg-gray-50 text-gray-600 hover:border-orange-300"
            }`}>
            Precīzs laiks
          </button>
        </div>
        {quickIdx === "custom" && (
          <input type="datetime-local" value={customExpiry}
            min={new Date().toISOString().slice(0, 16)}
            onChange={(e) => applyCustom(e.target.value)}
            className="input w-full" />
        )}
        {form.expires_at && (
          <p className="text-xs text-gray-400">
            Beigsies:{" "}
            <strong className="text-gray-700">
              {new Date(form.expires_at).toLocaleString("lv-LV", {
                weekday: "short", day: "numeric", month: "short",
                hour: "2-digit", minute: "2-digit",
              })}
            </strong>
          </p>
        )}
      </section>

      {/* Locker + temp zone */}
      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
        <h2 className="flex items-center gap-2 text-sm font-extrabold text-gray-700">
          <Thermometer size={13} /> Piegāde un glabāšana
        </h2>
        <div>
          <label className="block text-sm font-medium text-gray-700">Pakomāts (no kura sūtīsi)</label>
          <select value={form.pickup_locker_id} onChange={(e) => set("pickup_locker_id", e.target.value)} className="input mt-1 w-full">
            {lockers.map((l) => (
              <option key={l.id} value={l.id}>{l.city} — {l.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Temperatūras zona</label>
          <div className="flex flex-wrap gap-2">
            {([
              { v: "ambient", label: "📦 Istabas t°" },
              { v: "chilled", label: "🌡 Dzesēts +2°C–+6°C" },
              { v: "frozen",  label: "❄️ Saldēts -18°C" },
            ] as { v: TemperatureZone; label: string }[]).map(({ v, label }) => (
              <button key={v} type="button" onClick={() => set("temperature_zone", v)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  form.temperature_zone === v
                    ? "border-orange-400 bg-orange-50 text-orange-700"
                    : "border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300"
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="flex items-center gap-3 pb-10">
        <button type="submit" disabled={saving}
          className="btn-primary flex items-center gap-2 disabled:opacity-50">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Flame size={15} />}
          {isEdit ? "Saglabāt izmaiņas" : "Publicēt pīradziņu 🔥"}
        </button>
        <button type="button" onClick={() => router.back()} className="btn-outline">Atcelt</button>
      </div>
    </form>
  );
}
