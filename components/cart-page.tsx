"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Minus, Plus, Trash2, ShoppingCart, MapPin, Clock,
  ChevronRight, Loader2, CheckCircle, Tag,
} from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { listings, lockers } from "@/lib/mock-data";
import { formatPrice, getStorageType } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

const DELIVERY_FEE = 1.5;
const FREE_DELIVERY_THRESHOLD = 25;

type Step = "cart" | "delivery" | "confirm";

export function CartPage() {
  const { items, updateQty, removeItem, total, count, clear } = useCart();
  const [step, setStep] = useState<Step>("cart");
  const [lockerId, setLockerId] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");

  const deliveryFee = total >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
  const grandTotal = total + deliveryFee;

  const cartItemIds = new Set(items.map((i) => i.id));
  const sellerIds = new Set(items.map((i) => {
    const l = listings.find((x) => x.id === i.id);
    return l?.sellerId;
  }));

  const upsells = useMemo(() =>
    listings
      .filter((l) => sellerIds.has(l.sellerId) && !cartItemIds.has(l.id))
      .slice(0, 6),
    [items]
  );

  const popularUpsells = useMemo(() =>
    listings
      .filter((l) => !cartItemIds.has(l.id) && !sellerIds.has(l.sellerId))
      .sort((a, b) => b.seller.rating - a.seller.rating)
      .slice(0, 4),
    [items]
  );

  function setField(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function canProceedToDelivery() {
    return items.length > 0;
  }

  function canConfirm() {
    return lockerId && form.name.trim() && form.phone.trim() && form.email.trim();
  }

  async function handlePay() {
    setSubmitting(true);
    try {
      const locker = lockers.find((l) => l.id === lockerId)!;
      const uniqueSellerIds = [...new Set(
        items.map((i) => listings.find((l) => l.id === i.id)?.sellerId).filter(Boolean) as string[]
      )];
      const date = new Date();
      const num = `TRG-${date.getFullYear()}${String(date.getMonth()+1).padStart(2,"0")}${String(date.getDate()).padStart(2,"0")}-${Math.floor(1000+Math.random()*9000)}`;

      const { error } = await supabase.from("orders").insert({
        order_number: num,
        status: "pending",
        buyer_name: form.name,
        buyer_email: form.email,
        buyer_phone: form.phone,
        delivery_type: "locker",
        delivery_info: { locker_id: locker.id, locker_name: locker.name, locker_address: locker.address, locker_city: locker.city },
        items: items.map((i) => ({ id: i.id, title: i.title, price: i.price, quantity: i.quantity, unit: i.unit, sellerName: i.sellerName })),
        total_cents: Math.round(grandTotal * 100),
        seller_ids: uniqueSellerIds,
      });

      if (error) throw error;
      setOrderNumber(num);
      clear();
      setDone(true);
    } catch (err) {
      console.error(err);
      alert("Kļūda saglabājot pasūtījumu. Mēģini vēlreiz.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4">
        <div className="max-w-sm text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle size={32} className="text-green-600" />
          </div>
          <h1 className="mt-4 text-2xl font-extrabold text-gray-900">Pasūtījums saņemts!</h1>
          <p className="mt-2 text-sm text-gray-500">
            Pasūtījuma numurs: <strong className="text-gray-900">{orderNumber}</strong><br />
            Apstiprinājums tiks nosūtīts uz <strong>{form.email}</strong>.
          </p>
          <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
            Apmaksa ar Paysera — drīzumā tiks aktivizēta. Šobrīd pasūtījums reģistrēts kā <strong>neapmaksāts</strong>.
          </div>
          <Link href="/catalog" className="btn-primary mt-6 inline-block">
            Turpināt iepirkties
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Steps */}
      <div className="mb-8 flex flex-wrap items-center gap-2 text-sm">
        {(["cart", "delivery", "confirm"] as Step[]).map((s, i) => {
          const labels = ["Grozs", "Piegāde", "Apmaksa"];
          const active = s === step;
          const done = (step === "delivery" && i === 0) || (step === "confirm" && i < 2);
          return (
            <div key={s} className="flex items-center gap-2">
              <div className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition",
                done ? "bg-[#53F3A4] text-[#192635]" :
                active ? "bg-[#192635] text-white" :
                "bg-gray-100 text-gray-400"
              )}>
                {done ? <CheckCircle size={14} /> : i + 1}
              </div>
              <span className={cn("font-medium", active ? "text-gray-900" : "text-gray-400")}>
                {labels[i]}
              </span>
              {i < 2 && <ChevronRight size={14} className="text-gray-300" />}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* LEFT — main content */}
        <div className="lg:col-span-2 space-y-6">

          {/* ── STEP: CART ── */}
          {step === "cart" && (
            <>
              <h1 className="text-xl font-extrabold text-gray-900">
                Tavs grozs {count > 0 && <span className="text-gray-400 font-normal text-base">({count} preces)</span>}
              </h1>

              {items.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 p-12 text-center">
                  <ShoppingCart size={40} className="mx-auto text-gray-300" />
                  <p className="mt-3 text-sm text-gray-500">Grozs ir tukšs</p>
                  <Link href="/catalog" className="btn-primary mt-4 inline-block text-sm">
                    Iepirkties
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 rounded-2xl border border-gray-100 bg-white shadow-sm">
                  {items.map((item) => (
                    <CartItemRow key={item.id} item={item} updateQty={updateQty} removeItem={removeItem} />
                  ))}
                </div>
              )}

              {/* Free delivery nudge */}
              {total > 0 && total < FREE_DELIVERY_THRESHOLD && (
                <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                  <Tag size={14} className="shrink-0" />
                  Pievieno vēl <strong className="mx-1">{formatPrice(FREE_DELIVERY_THRESHOLD - total)}</strong> un saņem bezmaksas piegādi!
                </div>
              )}
              {total >= FREE_DELIVERY_THRESHOLD && total > 0 && (
                <div className="flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
                  <CheckCircle size={14} className="shrink-0" />
                  Apsveicam — tu esi ieguvis bezmaksas piegādi!
                </div>
              )}

              {/* Upsell — same sellers */}
              {upsells.length > 0 && (
                <UpsellSection
                  title="No tiem pašiem ražotājiem"
                  items={upsells}
                />
              )}

              {/* Upsell — popular */}
              {popularUpsells.length > 0 && (
                <UpsellSection
                  title="Pircēji bieži pievieno arī"
                  items={popularUpsells}
                />
              )}
            </>
          )}

          {/* ── STEP: DELIVERY ── */}
          {step === "delivery" && (
            <>
              <h2 className="text-xl font-extrabold text-gray-900">Izvēlies pakomātu</h2>
              <div className="space-y-3">
                {lockers.map((l) => (
                  <label key={l.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-4 rounded-xl border p-4 transition",
                      lockerId === l.id
                        ? "border-[#192635] bg-gray-50 ring-2 ring-[#192635]/10"
                        : "border-gray-200 hover:border-gray-300"
                    )}
                  >
                    <input type="radio" name="locker" value={l.id}
                      checked={lockerId === l.id}
                      onChange={() => setLockerId(l.id)}
                      className="mt-0.5 accent-[#192635]"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900">{l.city} — {l.name}</p>
                      <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><MapPin size={11} />{l.address}</span>
                        <span className="flex items-center gap-1"><Clock size={11} />{l.hours}</span>
                      </div>
                    </div>
                    {lockerId === l.id && (
                      <CheckCircle size={18} className="shrink-0 text-[#192635]" />
                    )}
                  </label>
                ))}
              </div>

              <h2 className="mt-8 text-xl font-extrabold text-gray-900">Kontaktinformācija</h2>
              <div className="space-y-3 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Vārds, uzvārds *</label>
                  <input value={form.name} onChange={(e) => setField("name", e.target.value)}
                    className="input mt-1 w-full" placeholder="Jānis Bērziņš" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Tālrunis *</label>
                  <input value={form.phone} onChange={(e) => setField("phone", e.target.value)}
                    className="input mt-1 w-full" placeholder="+371 2000 0000" type="tel" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">E-pasts *</label>
                  <input value={form.email} onChange={(e) => setField("email", e.target.value)}
                    className="input mt-1 w-full" placeholder="tavs@epasts.lv" type="email" />
                </div>
              </div>
            </>
          )}

          {/* ── STEP: CONFIRM ── */}
          {step === "confirm" && (
            <>
              <h2 className="text-xl font-extrabold text-gray-900">Pārskats un apmaksa</h2>

              {/* Selected locker */}
              {(() => {
                const l = lockers.find((x) => x.id === lockerId)!;
                return (
                  <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Saņemšanas vieta</p>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                        <MapPin size={18} className="text-gray-500" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{l.city} — {l.name}</p>
                        <p className="text-xs text-gray-500">{l.address} · {l.hours}</p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Contact summary */}
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Pircējs</p>
                <p className="text-sm font-medium text-gray-900">{form.name}</p>
                <p className="text-sm text-gray-500">{form.phone} · {form.email}</p>
              </div>

              {/* Items summary */}
              <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
                <p className="px-4 pt-4 pb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Preces</p>
                {items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                      <Image src={item.image} alt={item.title} fill className="object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">{item.title}</p>
                      <p className="text-xs text-gray-500">{item.sellerName} · {item.quantity}×</p>
                    </div>
                    <p className="text-sm font-semibold text-gray-900">
                      {formatPrice(item.price * item.quantity)}
                    </p>
                  </div>
                ))}
              </div>

              {/* Paysera info */}
              <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800">
                <p className="font-semibold mb-1">Apmaksa ar Paysera</p>
                <p className="text-xs text-blue-600">
                  Nospiežot "Maksāt", tiksi novirzīts uz Paysera drošo maksājumu lapu.
                  Pēc veiksmīgas apmaksas saņemsi apstiprinājumu uz e-pastu.
                </p>
              </div>
            </>
          )}
        </div>

        {/* RIGHT — sticky summary */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-24 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm space-y-4">
            <h3 className="font-extrabold text-gray-900">Pasūtījuma kopsavilkums</h3>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Preces ({count})</span>
                <span>{formatPrice(total)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Piegāde</span>
                {deliveryFee === 0
                  ? <span className="text-green-600 font-medium">Bezmaksas</span>
                  : <span>{formatPrice(deliveryFee)}</span>
                }
              </div>
              <div className="border-t border-gray-100 pt-2 flex justify-between font-extrabold text-gray-900 text-base">
                <span>Kopā</span>
                <span>{formatPrice(grandTotal)}</span>
              </div>
            </div>

            {step === "cart" && (
              <button
                onClick={() => setStep("delivery")}
                disabled={!canProceedToDelivery()}
                className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-40"
              >
                Uz piegādi <ChevronRight size={16} />
              </button>
            )}

            {step === "delivery" && (
              <div className="space-y-2">
                <button
                  onClick={() => setStep("confirm")}
                  disabled={!canConfirm()}
                  className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  Apstiprināt <ChevronRight size={16} />
                </button>
                <button onClick={() => setStep("cart")}
                  className="w-full rounded-xl border border-gray-200 py-2.5 text-sm text-gray-600 hover:bg-gray-50">
                  ← Atpakaļ uz grozu
                </button>
              </div>
            )}

            {step === "confirm" && (
              <div className="space-y-2">
                <button
                  onClick={handlePay}
                  disabled={submitting}
                  className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-60"
                  style={{ backgroundColor: "#192635" }}
                >
                  {submitting
                    ? <><Loader2 size={16} className="animate-spin" /> Apstrādā...</>
                    : <>Maksāt {formatPrice(grandTotal)} →</>
                  }
                </button>
                <button onClick={() => setStep("delivery")}
                  className="w-full rounded-xl border border-gray-200 py-2.5 text-sm text-gray-600 hover:bg-gray-50">
                  ← Mainīt piegādi
                </button>
              </div>
            )}

            <p className="text-center text-xs text-gray-400">
              🔒 Droša apmaksa ar Paysera
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function CartItemRow({
  item,
  updateQty,
  removeItem,
}: {
  item: { id: string; title: string; price: number; unit: string; image: string; sellerName: string; quantity: number };
  updateQty: (id: string, qty: number) => void;
  removeItem: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 p-3 sm:gap-4 sm:p-4">
      <Link href={`/listing/${item.id}`} className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-gray-100 sm:h-16 sm:w-16">
        <Image src={item.image} alt={item.title} fill className="object-cover" />
      </Link>
      <div className="flex-1 min-w-0">
        <Link href={`/listing/${item.id}`}
          className="block truncate text-sm font-semibold text-gray-900 hover:text-brand-600">
          {item.title}
        </Link>
        <p className="text-xs text-gray-500">{item.sellerName}</p>
        <p className="mt-0.5 text-sm font-bold text-gray-900">
          {formatPrice(item.price * item.quantity)}
          <span className="ml-1 text-xs font-normal text-gray-400">
            ({formatPrice(item.price)} / {item.unit})
          </span>
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={() => updateQty(item.id, item.quantity - 1)}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 transition"
        >
          <Minus size={12} />
        </button>
        <span className="w-6 text-center text-sm font-semibold text-gray-900">
          {item.quantity}
        </span>
        <button
          onClick={() => updateQty(item.id, item.quantity + 1)}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 transition"
        >
          <Plus size={12} />
        </button>
        <button
          onClick={() => removeItem(item.id)}
          className="ml-2 flex h-7 w-7 items-center justify-center rounded-full text-gray-300 hover:bg-red-50 hover:text-red-500 transition"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

function UpsellSection({ title, items }: { title: string; items: ReturnType<typeof listings.filter> }) {
  const { addItem } = useCart();
  const [added, setAdded] = useState<Record<string, boolean>>({});

  function handleAdd(item: (typeof items)[0], e: React.MouseEvent) {
    e.preventDefault();
    addItem({
      id: item.id,
      title: item.title,
      price: item.price,
      unit: item.unit,
      image: item.image,
      sellerName: item.seller.farmName,
      storageType: getStorageType(item),
    });
    setAdded((prev) => ({ ...prev, [item.id]: true }));
    setTimeout(() => setAdded((prev) => ({ ...prev, [item.id]: false })), 1500);
  }

  return (
    <div>
      <h3 className="mb-3 text-sm font-extrabold text-gray-700">{title}</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((item) => (
          <Link key={item.id} href={`/listing/${item.id}`}
            className="group relative flex flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition">
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-100">
              <Image src={item.image} alt={item.title} fill className="object-cover group-hover:scale-105 transition-transform duration-300" />
            </div>
            <div className="p-3 flex-1 flex flex-col justify-between gap-1">
              <p className="text-xs font-semibold text-gray-900 line-clamp-2 leading-snug">{item.title}</p>
              <div className="flex items-center justify-between gap-1 mt-1">
                <p className="text-sm font-bold text-gray-900">{formatPrice(item.price)}</p>
                <button
                  onClick={(e) => handleAdd(item, e)}
                  className={cn(
                    "flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold transition-all shrink-0",
                    added[item.id]
                      ? "bg-green-500 text-white"
                      : "bg-[#192635] text-white hover:bg-[#243647]"
                  )}
                >
                  {added[item.id] ? <CheckCircle size={10} /> : "+"}
                  {added[item.id] ? "Piev." : "Grozā"}
                </button>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
