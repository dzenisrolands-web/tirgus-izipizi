"use client";

import { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Minus, Plus, Trash2, ShoppingCart, MapPin, Clock,
  ChevronRight, Loader2, CheckCircle, Tag, Package, Truck, Zap, AlertCircle,
} from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { useBuyerAddress } from "@/lib/buyer-address-context";
import { listings, lockers } from "@/lib/mock-data";
import { formatPrice, getStorageType, LOCKER_FEE } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { lookupPostalCode, effectiveCourierZone, pricingForZone } from "@/lib/postal-zones";
import { LvAddressAutocomplete, type ParsedAddress } from "@/components/lv-address-autocomplete";

type SellerInfo = {
  id: string;
  name: string;
  home_locker_ids: string[];
  courier_pickup_address: string | null;
};

type DeliveryMethod = "locker" | "courier" | "express";
type Step = "cart" | "delivery" | "confirm";

export function CartPage() {
  const { items, updateQty, removeItem, total, count } = useCart();
  const { address: buyerCtxAddress } = useBuyerAddress();
  const [step, setStep] = useState<Step>("cart");
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("locker");
  const [lockerId, setLockerId] = useState("");
  const [postalCode, setPostalCode] = useState(buyerCtxAddress?.postalCode ?? "");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState(buyerCtxAddress?.city ?? "");
  const [addressSearch, setAddressSearch] = useState(buyerCtxAddress?.fullText ?? ""); // autocomplete input
  const [apartment, setApartment] = useState("");
  const [floor, setFloor] = useState("");
  const [entryCode, setEntryCode] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [timeSlot, setTimeSlot] = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", email: "" });

  function applyAddress(parsed: ParsedAddress) {
    if (parsed.street) setAddress(parsed.street);
    if (parsed.city) setCity(parsed.city);
    if (parsed.postalCode) setPostalCode(parsed.postalCode);
  }

  // Time slot options based on zone + delivery method
  function getTimeSlots(zone: number | null, method: DeliveryMethod): string[] {
    if (zone === null) return [];
    if (zone === 0) {
      return ["09:00–12:00", "12:00–18:00", "18:00–22:00"];
    }
    if (zone === 1) {
      // 5h windows
      return method === "express"
        ? ["08:00–13:00", "13:00–18:00"]
        : ["09:00–14:00", "14:00–19:00"];
    }
    // Zones 2-3: single all-day window
    return ["08:00–18:00"];
  }

  // Default delivery date — tomorrow (or day after if it's late)
  function tomorrowISO(): string {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }
  function maxDateISO(): string {
    const d = new Date();
    d.setDate(d.getDate() + 14); // up to 2 weeks ahead
    return d.toISOString().slice(0, 10);
  }
  const [submitting, setSubmitting] = useState(false);
  const [payError, setPayError] = useState("");

  // Fetch seller info (drop-off lockers, courier pickup address) for items in cart
  const [sellersById, setSellersById] = useState<Map<string, SellerInfo>>(new Map());
  useEffect(() => {
    const ids = [...new Set(items.map((i) => i.sellerId).filter(Boolean) as string[])];
    if (ids.length === 0) { setSellersById(new Map()); return; }
    (async () => {
      const { data } = await supabase
        .from("sellers")
        .select("id, name, home_locker_ids, courier_pickup_address")
        .in("id", ids);
      const m = new Map<string, SellerInfo>();
      for (const s of data ?? []) {
        m.set(s.id, {
          id: s.id,
          name: s.name,
          home_locker_ids: s.home_locker_ids ?? [],
          courier_pickup_address: s.courier_pickup_address ?? null,
        });
      }
      setSellersById(m);
    })();
  }, [items]);

  // Postal code → zone lookup (for courier and express)
  const zoneResult = useMemo(() => lookupPostalCode(postalCode), [postalCode]);
  const zonePricing = zoneResult.found ? zoneResult.pricing : null;
  const expressAvailable = !!zonePricing && zonePricing.expressSingle !== null;

  // Group items by seller and compute per-seller delivery fees
  const sellerGroups = useMemo(() => {
    const groups = new Map<string, typeof items>();
    for (const item of items) {
      const key = item.sellerId ?? `name:${item.sellerName}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }
    return Array.from(groups.entries()).map(([key, sellerItems]) => {
      const sellerId = sellerItems[0].sellerId;
      const sellerName = sellerItems[0].sellerName;
      const tempZones = new Set(
        sellerItems.map((i) => (i.storageType === "frozen" ? "frozen" : "chilled"))
      );
      const cabinetCount = Math.max(1, tempZones.size);
      const isDualTemp = cabinetCount === 2;
      const sellerInfo = sellerId ? sellersById.get(sellerId) : undefined;
      // Compute effective zone for THIS seller: MAX(seller drop-off zone, buyer zone)
      const sellerLockerId = sellerInfo?.home_locker_ids?.[0];
      const effZone = effectiveCourierZone(sellerLockerId, zonePricing?.zone);
      const effPricing = pricingForZone(effZone);
      const lockerFee = LOCKER_FEE * cabinetCount;
      const courierFee = effPricing
        ? (isDualTemp ? effPricing.dualTemp : effPricing.singleTemp)
        : 0;
      const expressFee = effPricing && effPricing.expressSingle !== null && effPricing.expressDual !== null
        ? (isDualTemp ? effPricing.expressDual! : effPricing.expressSingle!)
        : 0;
      let activeFee = 0;
      if (deliveryMethod === "locker") activeFee = lockerFee;
      else if (deliveryMethod === "courier") activeFee = courierFee;
      else if (deliveryMethod === "express") activeFee = expressFee;
      const subtotal = sellerItems.reduce((s, i) => s + i.price * i.quantity, 0);
      return {
        key, sellerId, sellerName,
        items: sellerItems, cabinetCount, isDualTemp,
        lockerFee, courierFee, expressFee, activeFee, subtotal,
        sellerInfo, effZone,
      };
    });
  }, [items, deliveryMethod, zonePricing, sellersById]);

  // Aggregate cabinet count (max across sellers — for displaying delivery options)
  const cabinetCount = useMemo(() => {
    if (items.length === 0) return 1;
    const zones = new Set(
      items.map((i) => (i.storageType === "frozen" ? "frozen" : "chilled"))
    );
    return Math.max(1, zones.size);
  }, [items]);
  const isDualTemp = cabinetCount === 2;

  // Total delivery fee = sum of all sellers' active fees
  const deliveryFee = sellerGroups.reduce((s, g) => s + g.activeFee, 0);

  // Per-method totals (for displaying option pills)
  const lockerFee = sellerGroups.reduce((s, g) => s + g.lockerFee, 0);
  const courierFee = sellerGroups.reduce((s, g) => s + g.courierFee, 0);
  const expressFee = sellerGroups.reduce((s, g) => s + g.expressFee, 0);

  // Now that zonePricing is defined, compute available time slots
  const availableTimeSlots = getTimeSlots(zonePricing?.zone ?? null, deliveryMethod);

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
    return missingFields().length === 0;
  }

  function missingFields(): string[] {
    const missing: string[] = [];
    if (!form.name.trim()) missing.push("Vārds, uzvārds");
    if (!form.phone.trim()) missing.push("Tālrunis");
    if (!form.email.trim()) missing.push("E-pasts");
    if (deliveryMethod === "locker" && !lockerId) missing.push("Pakomāts");
    if (deliveryMethod === "courier" || deliveryMethod === "express") {
      if (!zoneResult.found) missing.push("Pasta indekss (derīgā zonā)");
      if (!address.trim()) missing.push("Iela un mājas nr.");
      if (!city.trim()) missing.push("Pilsēta");
      if (!deliveryDate) missing.push("Datums");
      if (!timeSlot) missing.push("Laika logs");
      if (deliveryMethod === "express" && !expressAvailable) missing.push("Eksprespiegāde nav pieejama šajā zonā");
    }
    return missing;
  }

  async function handlePay() {
    setSubmitting(true);
    setPayError("");
    try {
      // Prefer sellerId from cart item; fall back to mock data lookup for legacy items
      const uniqueSellerIds = [...new Set(
        items
          .map((i) => i.sellerId ?? listings.find((l) => l.id === i.id)?.sellerId)
          .filter(Boolean) as string[]
      )];

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      // Build delivery info based on chosen method
      let deliveryInfo: Record<string, unknown>;
      if (deliveryMethod === "locker") {
        const locker = lockers.find((l) => l.id === lockerId)!;
        deliveryInfo = {
          locker_id: locker.id,
          locker_name: locker.name,
          locker_address: locker.address,
          locker_city: locker.city,
        };
      } else {
        deliveryInfo = {
          postal_code: postalCode,
          address,
          city,
          apartment: apartment || undefined,
          floor: floor || undefined,
          entry_code: entryCode || undefined,
          zone: zoneResult.found ? zoneResult.zone : null,
          method: deliveryMethod,
          delivery_date: deliveryDate || tomorrowISO(),
          time_slot: timeSlot,
          note: deliveryNote || undefined,
        };
      }

      const res = await fetch("/api/checkout/create-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          items: items.map((i) => ({
            id: i.id, title: i.title, price: i.price, quantity: i.quantity,
            unit: i.unit, sellerName: i.sellerName, sellerId: i.sellerId ?? null,
          })),
          deliveryType: deliveryMethod,
          deliveryInfo,
          // Backwards compat: also send locker if locker method
          ...(deliveryMethod === "locker" && {
            locker: deliveryInfo,
          }),
          contact: { name: form.name, email: form.email, phone: form.phone },
          sellerIds: uniqueSellerIds,
          totalCents: Math.round(grandTotal * 100),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Kļūda izveidojot maksājumu");
      }

      const { paymentUrl } = await res.json();
      // Note: cart will be cleared on /cart/success page; if user cancels Paysera,
      // they return to /cart/cancel and the cart is still intact for retry.
      window.location.href = paymentUrl;
    } catch (err) {
      console.error(err);
      setPayError(err instanceof Error ? err.message : "Kļūda izveidojot maksājumu. Mēģini vēlreiz.");
      setSubmitting(false);
    }
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

      {submitting && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#192635]/95 backdrop-blur-sm">
          <div className="relative">
            <div className="h-16 w-16 rounded-full border-4 border-white/10 border-t-[#53F3A4] animate-spin" />
          </div>
          <p className="mt-6 text-lg font-bold text-white">Notiek pāradresācija uz Paysera...</p>
          <p className="mt-1 text-sm text-white/60">Lūdzu, neaizver pārlūku</p>
          <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
            🔒 Drošs maksājums caur Paysera
          </p>
        </div>
      )}

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
                <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-50">
                    <ShoppingCart size={28} className="text-gray-300" />
                  </div>
                  <h2 className="mt-4 text-lg font-bold text-gray-900">Grozs vēl tukšs</h2>
                  <p className="mt-1 text-sm text-gray-500 max-w-xs mx-auto">
                    Sāc no kategorijām vai apskaties, ko šonedēļ piedāvā mūsu ražotāji.
                  </p>
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    {[
                      { label: "🥩 Gaļa", slug: "Gaļa" },
                      { label: "🥟 Saldēta", slug: "Saldēta pārtika" },
                      { label: "🥚 Olas", slug: "Olas" },
                      { label: "🥦 Dārzeņi", slug: "Dārzeņi" },
                      { label: "🍰 Konditorija", slug: "Konditorija" },
                    ].map((c) => (
                      <Link key={c.slug}
                        href={`/catalog?category=${encodeURIComponent(c.slug)}`}
                        className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-700 hover:border-gray-400 hover:bg-gray-50">
                        {c.label}
                      </Link>
                    ))}
                  </div>
                  <Link href="/catalog" className="btn-primary mt-6 inline-block text-sm">
                    Pārlūkot visu katalogu
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 rounded-2xl border border-gray-100 bg-white shadow-sm">
                  {items.map((item) => (
                    <CartItemRow key={item.id} item={item} updateQty={updateQty} removeItem={removeItem} />
                  ))}
                </div>
              )}

              {/* Free delivery banners removed — no free shipping promotion */}

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
              <h2 className="text-xl font-extrabold text-gray-900">Piegādes veids</h2>

              {/* Method picker — 3 cards */}
              <div className="grid gap-3 sm:grid-cols-3">
                <DeliveryMethodCard
                  method="locker"
                  selected={deliveryMethod === "locker"}
                  onSelect={() => setDeliveryMethod("locker")}
                  icon={<Package size={18} />}
                  label="Pakomāts"
                  price={sellerGroups.length > 0
                    ? `${lockerFee.toFixed(2)} €${sellerGroups.length > 1 ? ` (${sellerGroups.length} ražotāji)` : ""}`
                    : `${LOCKER_FEE.toFixed(2)} €/skapītis`}
                  hint="24/7 piekļuve · Lētākais"
                  highlight
                />
                <DeliveryMethodCard
                  method="courier"
                  selected={deliveryMethod === "courier"}
                  onSelect={() => setDeliveryMethod("courier")}
                  icon={<Truck size={18} />}
                  label="Kurjers"
                  price={zonePricing
                    ? `${courierFee.toFixed(2)} €${sellerGroups.length > 1 ? ` (${sellerGroups.length} ražotāji)` : ""}`
                    : "no 5.45 €"}
                  hint="Mājas durvīs"
                />
                <DeliveryMethodCard
                  method="express"
                  selected={deliveryMethod === "express"}
                  onSelect={() => setDeliveryMethod("express")}
                  icon={<Zap size={18} />}
                  label="Eksprespiegāde"
                  price={zonePricing && expressAvailable
                    ? `${expressFee.toFixed(2)} €${sellerGroups.length > 1 ? ` (${sellerGroups.length} ražotāji)` : ""}`
                    : "no 6.66 €"}
                  hint="2–5h Rīgā"
                />
              </div>

              {/* Multi-temp note */}
              {isDualTemp && (
                <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  <p>Tavs grozs satur <strong>dzesētus un saldētus</strong> produktus —
                    vajag <strong>2 skapīšus</strong>, tāpēc cena divkāršojas.</p>
                </div>
              )}

              {/* Method-specific details */}
              {deliveryMethod === "locker" && (
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-gray-900">Izvēlies pakomātu</h3>
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
                        className="mt-0.5 accent-[#192635]" />
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
              )}

              {(deliveryMethod === "courier" || deliveryMethod === "express") && (
                <div className="space-y-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Piegādes adrese</h3>
                    <p className="mt-0.5 text-xs text-gray-500">
                      Sāc rakstīt — sistēma piedāvās adreses no Latvijas
                    </p>
                  </div>

                  {/* Autocomplete — main entry */}
                  <LvAddressAutocomplete
                    value={addressSearch}
                    onChange={setAddressSearch}
                    onSelect={(parsed) => {
                      applyAddress(parsed);
                      setAddressSearch(parsed.fullText);
                    }}
                  />

                  {/* Auto-filled fields (editable) */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-gray-500">Iela un mājas nr.</label>
                      <input value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Brīvības iela 100"
                        className="input mt-1 w-full" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500">Pilsēta / novads</label>
                      <input value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="Rīga"
                        className="input mt-1 w-full" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500">Pasta indekss *</label>
                      <input value={postalCode}
                        onChange={(e) => setPostalCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        placeholder="1050"
                        maxLength={4}
                        inputMode="numeric"
                        className="input mt-1 w-full font-mono" />
                    </div>
                  </div>

                  {/* Apartment / floor / entry code (optional) */}
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500">Dzīvoklis</label>
                      <input value={apartment}
                        onChange={(e) => setApartment(e.target.value)}
                        placeholder="dz. 5 / 12A"
                        className="input mt-1 w-full" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500">Stāvs</label>
                      <input value={floor}
                        onChange={(e) => setFloor(e.target.value)}
                        placeholder="3"
                        inputMode="numeric"
                        className="input mt-1 w-full" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500">Ieejas kods</label>
                      <input value={entryCode}
                        onChange={(e) => setEntryCode(e.target.value)}
                        placeholder="1234"
                        className="input mt-1 w-full font-mono" />
                    </div>
                  </div>

                  {/* Zone feedback */}
                  {postalCode && !zoneResult.found && (
                    <p className="text-xs text-amber-700">
                      {zoneResult.reason === "invalid_format"
                        ? "Ievadi 4-ciparu Latvijas pasta indeksu"
                        : `Indekss LV-${zoneResult.code} nav mūsu apkalpotajās zonās — sazinies ar mums vai izvēlies pakomātu`}
                    </p>
                  )}
                  {zonePricing && (
                    <div className="flex items-center gap-1.5 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-700">
                      ✓ <strong>Zona {zonePricing.zone}</strong> · {zonePricing.area}
                    </div>
                  )}
                  {deliveryMethod === "express" && zonePricing && !expressAvailable && (
                    <div className="flex items-center gap-1.5 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                      ⚠ Eksprespiegāde nav pieejama Zonā {zonePricing.zone}. Izvēlies kurjeru.
                    </div>
                  )}

                  {/* Time slot picker — appears once we have a valid zone */}
                  {zonePricing && (deliveryMethod === "courier" || (deliveryMethod === "express" && expressAvailable)) && (
                    <div className="space-y-3 rounded-xl border border-brand-100 bg-brand-50/40 p-4">
                      <div>
                        <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                          <Clock size={13} className="text-brand-600" />
                          Izvēlies laika logu
                        </h4>
                        <p className="mt-0.5 text-xs text-gray-500">
                          Pasūtījuma rezervēšana iepriekšējā dienā līdz 20:00
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700">Datums *</label>
                        <input type="date"
                          value={deliveryDate}
                          min={tomorrowISO()}
                          max={maxDateISO()}
                          onChange={(e) => setDeliveryDate(e.target.value)}
                          className="input mt-1 w-full" />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1.5">Laika logs *</label>
                        <div className="flex flex-wrap gap-2">
                          {availableTimeSlots.map((slot) => (
                            <button key={slot} type="button"
                              onClick={() => setTimeSlot(slot)}
                              className={cn(
                                "rounded-full border-2 px-3 py-1.5 text-xs font-semibold transition",
                                timeSlot === slot
                                  ? "border-brand-500 bg-brand-100 text-brand-800"
                                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                              )}>
                              {slot}
                            </button>
                          ))}
                        </div>
                        {availableTimeSlots.length === 1 && (
                          <p className="mt-1.5 text-xs text-gray-500 italic">
                            Šajā zonā tiek piedāvāts viens visas dienas logs
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700">Piezīme kurjeram (neobligāti)</label>
                        <textarea value={deliveryNote}
                          onChange={(e) => setDeliveryNote(e.target.value)}
                          placeholder="Piem., zvanīt pirms ierašanās"
                          rows={2}
                          className="input mt-1 w-full resize-y" />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Contact info */}
              <h2 className="mt-8 text-xl font-extrabold text-gray-900">Kontaktinformācija</h2>
              <form className="space-y-3 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
                autoComplete="on">
                <div>
                  <label htmlFor="cart-name" className="block text-sm font-medium text-gray-700">Vārds, uzvārds *</label>
                  <input
                    id="cart-name"
                    name="name"
                    autoComplete="name"
                    value={form.name}
                    onChange={(e) => setField("name", e.target.value)}
                    onBlur={(e) => setField("name", e.target.value)}
                    className="input mt-1 w-full"
                    placeholder="Jānis Bērziņš"
                  />
                </div>
                <div>
                  <label htmlFor="cart-phone" className="block text-sm font-medium text-gray-700">Tālrunis *</label>
                  <input
                    id="cart-phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    value={form.phone}
                    onChange={(e) => setField("phone", e.target.value)}
                    onBlur={(e) => setField("phone", e.target.value)}
                    className="input mt-1 w-full"
                    placeholder="+371 2000 0000"
                  />
                </div>
                <div>
                  <label htmlFor="cart-email" className="block text-sm font-medium text-gray-700">E-pasts *</label>
                  <input
                    id="cart-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={(e) => setField("email", e.target.value)}
                    onBlur={(e) => setField("email", e.target.value)}
                    className="input mt-1 w-full"
                    placeholder="tavs@epasts.lv"
                  />
                </div>
              </form>
            </>
          )}

          {/* ── STEP: CONFIRM ── */}
          {step === "confirm" && (
            <>
              <h2 className="text-xl font-extrabold text-gray-900">Pārskats un apmaksa</h2>

              {/* Selected delivery */}
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Saņemšanas veids</p>
                {deliveryMethod === "locker" && (() => {
                  const l = lockers.find((x) => x.id === lockerId)!;
                  return (
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50">
                        <Package size={18} className="text-brand-700" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">Pakomāts — {l.city} — {l.name}</p>
                        <p className="text-xs text-gray-500">{l.address} · {l.hours}</p>
                      </div>
                    </div>
                  );
                })()}
                {(deliveryMethod === "courier" || deliveryMethod === "express") && (
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50">
                      {deliveryMethod === "courier"
                        ? <Truck size={18} className="text-gray-600" />
                        : <Zap size={18} className="text-yellow-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900">
                        {deliveryMethod === "courier" ? "Kurjers" : "Eksprespiegāde 2–5h"}
                        {zonePricing && <span className="text-gray-400 font-normal"> · Zona {zonePricing.zone}</span>}
                      </p>
                      <p className="text-xs text-gray-500">
                        {address}
                        {apartment && `, ${apartment}`}
                        {floor && `, ${floor}. stāvs`}
                        , {city}, LV-{postalCode}
                      </p>
                      {entryCode && (
                        <p className="text-xs text-gray-400">Ieejas kods: <span className="font-mono">{entryCode}</span></p>
                      )}
                      <p className="mt-1 text-xs text-brand-700">
                        🕐 {deliveryDate || tomorrowISO()} · {timeSlot}
                      </p>
                      {deliveryNote && (
                        <p className="mt-0.5 text-xs text-gray-500 italic">&ldquo;{deliveryNote}&rdquo;</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

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

              {/* On step "cart", piegāde nav vēl izvēlēts — neuzrādām maksu */}
              {step === "cart" ? (
                <div className="flex justify-between text-gray-400 text-xs italic">
                  <span>Piegādes maksu redzēsi nākamajā solī</span>
                </div>
              ) : (
                <>
                  {/* Per-seller breakdown when multiple sellers OR locker delivery */}
                  {sellerGroups.length > 0 && deliveryFee > 0 ? (
                    <>
                      {sellerGroups.length > 1 && (
                        <div className="text-xs text-gray-400 italic">
                          Piegāde tiek aprēķināta atsevišķi katram ražotājam:
                        </div>
                      )}
                      {sellerGroups.map((g) => {
                        const tempLabels = Array.from(new Set(
                          g.items.map((i) => i.storageType === "frozen" ? "saldēts" : "dzesēts")
                        )).join(" + ");
                        return (
                          <div key={g.key} className="space-y-0.5 pl-1">
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="truncate font-semibold text-gray-700">
                                {g.sellerName}
                              </span>
                              <span className="font-mono text-gray-700">{formatPrice(g.activeFee)}</span>
                            </div>
                            {deliveryMethod === "locker" && (
                              <p className="text-[10px] text-gray-400 leading-tight">
                                {g.cabinetCount} {g.cabinetCount === 1 ? "skapītis" : "skapīši"}
                                {" · "}{tempLabels}
                                {g.cabinetCount > 1 && (
                                  <span> ({LOCKER_FEE.toFixed(2)} € × {g.cabinetCount})</span>
                                )}
                              </p>
                            )}
                            {(deliveryMethod === "courier" || deliveryMethod === "express") && (
                              <p className="text-[10px] text-gray-400 leading-tight">
                                {g.cabinetCount === 1 ? "1 temp." : "2 temp."}
                                {" · "}{tempLabels}
                                {typeof g.effZone === "number" && (
                                  <span> · Zona {g.effZone}</span>
                                )}
                              </p>
                            )}
                          </div>
                        );
                      })}
                      <div className="flex justify-between text-gray-700 font-semibold border-t border-gray-50 pt-1.5">
                        <span>Piegāde kopā</span>
                        <span>{formatPrice(deliveryFee)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between text-gray-600">
                      <span>
                        Piegāde
                        {deliveryMethod === "locker" && cabinetCount > 1 && (
                          <span className="ml-1 text-xs text-gray-400">
                            ({cabinetCount} skapīši × {LOCKER_FEE}€)
                          </span>
                        )}
                        {deliveryMethod === "courier" && zonePricing && (
                          <span className="ml-1 text-xs text-gray-400">(Kurjers · Z{zonePricing.zone})</span>
                        )}
                        {deliveryMethod === "express" && zonePricing && (
                          <span className="ml-1 text-xs text-gray-400">(Ekspres · Z{zonePricing.zone})</span>
                        )}
                      </span>
                      {deliveryFee === 0
                        ? <span className="text-gray-400 text-xs">norādīt zemāk</span>
                        : <span>{formatPrice(deliveryFee)}</span>
                      }
                    </div>
                  )}
                </>
              )}

              <div className="border-t border-gray-100 pt-2 flex justify-between font-extrabold text-gray-900 text-base">
                <span>Kopā</span>
                <span>{formatPrice(step === "cart" ? total : grandTotal)}</span>
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
                {!canConfirm() && missingFields().length > 0 && (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                    <p className="font-semibold mb-1">Lai turpinātu, jāaizpilda:</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      {missingFields().map((m) => (
                        <li key={m}>{m}</li>
                      ))}
                    </ul>
                  </div>
                )}
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
                {payError && (
                  <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{payError}</div>
                )}
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

function DeliveryMethodCard({
  method,
  selected,
  onSelect,
  icon,
  label,
  price,
  hint,
  highlight,
}: {
  method: DeliveryMethod;
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  label: string;
  price: string;
  hint: string;
  highlight?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex flex-col items-start gap-1 rounded-2xl border-2 p-4 text-left transition",
        selected
          ? method === "express"
            ? "border-yellow-400 bg-yellow-50"
            : method === "courier"
            ? "border-gray-700 bg-gray-50"
            : "border-brand-500 bg-brand-50"
          : "border-gray-200 bg-white hover:border-gray-300"
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cn(
          "flex h-9 w-9 items-center justify-center rounded-lg",
          selected
            ? method === "express" ? "bg-yellow-200/60 text-yellow-700"
            : method === "courier" ? "bg-gray-200 text-gray-700"
            : "bg-brand-200/60 text-brand-700"
            : "bg-gray-100 text-gray-500"
        )}>
          {icon}
        </span>
        {highlight && (
          <span className="rounded-full bg-gradient-to-r from-brand-400 to-purple-500 px-2 py-0.5 text-[9px] font-bold text-white">
            LĒTĀKAIS
          </span>
        )}
      </div>
      <p className="mt-1 text-sm font-extrabold text-gray-900">{label}</p>
      <p className="text-xs text-gray-500">{hint}</p>
      <p className="mt-auto pt-2 text-sm font-bold text-gray-900">{price}</p>
    </button>
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
