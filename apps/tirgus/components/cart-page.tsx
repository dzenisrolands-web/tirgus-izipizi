"use client";

import { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Minus, Plus, Trash2, ShoppingCart, MapPin, Clock,
  ChevronRight, Loader2, CheckCircle, Tag, Package, Truck, Zap, AlertCircle, X,
} from "lucide-react";
import { cartIdentity } from "@/lib/cart-identity";
import { cartReferences, type CartItem } from "@/lib/cart-state";
import { useCheckoutQuote, payableQuote, currentQuote } from "@/lib/use-checkout-quote";
import type { CheckoutQuoteRequest, CheckoutQuoteResponse } from "@/lib/checkout-contract";
import { calculateDeliveryQuote } from "@/lib/delivery-policy";
import { useCart } from "@/lib/cart-context";
import { useBuyerAddress } from "@/lib/buyer-address-context";
import { type Listing } from "@/lib/mock-data";
import { publicLockers as lockers, isClosedLockerId, getOpenLocker } from "@/lib/locker-policy";
import { fetchActiveListings, fetchBestSellers } from "@/lib/db-listings";
import { formatPrice, getStorageType } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { lookupPostalCode, nearestLockersForCode } from "@/lib/postal-zones";
import { LvAddressAutocomplete, type ParsedAddress } from "@/components/lv-address-autocomplete";
import { useSavedAddresses, QUICK_LABELS, type SavedAddress } from "@/lib/saved-addresses";
import { publicProductImage } from "@/lib/product-image";

type DeliveryMethod = "locker" | "courier" | "express";
type Step = "cart" | "delivery" | "confirm";

// Checkout state that persists in localStorage
type CheckoutDraft = {
  step: Step;
  deliveryMethod: DeliveryMethod;
  lockerId: string;
  postalCode: string;
  address: string;
  city: string;
  addressSearch: string;
  apartment: string;
  floor: string;
  entryCode: string;
  deliveryDate: string;
  timeSlot: string;
  deliveryNote: string;
  form: { name: string; phone: string; email: string };
  promoCode: string;
  appliedPromoCode: string;
};

const CHECKOUT_KEY = "checkout_draft";

function loadDraft(): Partial<CheckoutDraft> {
  try {
    const raw = localStorage.getItem(CHECKOUT_KEY);
    const value: unknown = raw ? JSON.parse(raw) : {};
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const result: Partial<CheckoutDraft> = {};
    const record = value as Record<string, unknown>;
    for (const key of ["lockerId", "postalCode", "address", "city", "addressSearch", "apartment", "floor", "entryCode", "deliveryDate", "timeSlot", "deliveryNote", "promoCode", "appliedPromoCode"] as const) {
      if (typeof record[key] === "string") result[key] = record[key];
    }
    if (["cart", "delivery", "confirm"].includes(String(record.step))) result.step = record.step as Step;
    if (["locker", "courier", "express"].includes(String(record.deliveryMethod))) result.deliveryMethod = record.deliveryMethod as DeliveryMethod;
    const contact = record.form;
    if (contact && typeof contact === "object" && ["name", "phone", "email"].every(key => typeof (contact as Record<string, unknown>)[key] === "string")) result.form = contact as CheckoutDraft["form"];
    return result;
  } catch { return {}; }
}

function saveDraft(d: CheckoutDraft) {
  try { localStorage.setItem(CHECKOUT_KEY, JSON.stringify(d)); } catch {}
}

export function CartPage() {
  const { items, updateQty, removeItem, count, hydrateItems, ready, storageError, clear } = useCart();
  const { address: buyerCtxAddress } = useBuyerAddress();

  const [step, setStep] = useState<Step>("cart");
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("locker");
  const [lockerId, setLockerId] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [addressSearch, setAddressSearch] = useState("");
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
  const [saveLabel, setSaveLabel] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [newsletterConsent, setNewsletterConsent] = useState(false);
  const { addresses: savedAddresses, add: addSavedAddress, remove: removeSavedAddress } = useSavedAddresses();
  const [promoCode, setPromoCode] = useState("");
  const [appliedPromoCode, setAppliedPromoCode] = useState("");

  // Restore checkout draft from localStorage after hydration (SSR-safe)
  const [draftLoaded, setDraftLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      const d = loadDraft();
      if (Object.keys(d).length > 0) {
        if (d.step) setStep(d.step === "confirm" || (!getOpenLocker(d.lockerId) && (d.deliveryMethod ?? "locker") === "locker") ? "delivery" : d.step);
        if (d.deliveryMethod) setDeliveryMethod(d.deliveryMethod);
        if (d.lockerId && getOpenLocker(d.lockerId)) setLockerId(d.lockerId);
        if (d.postalCode) setPostalCode(d.postalCode);
        if (d.address) setAddress(d.address);
        if (d.city) setCity(d.city);
        if (d.addressSearch) setAddressSearch(d.addressSearch);
        if (d.apartment) setApartment(d.apartment);
        if (d.floor) setFloor(d.floor);
        if (d.entryCode) setEntryCode(d.entryCode);
        if (d.deliveryDate) setDeliveryDate(d.deliveryDate);
        if (d.timeSlot) setTimeSlot(d.timeSlot);
        if (d.deliveryNote) setDeliveryNote(d.deliveryNote);
        if (d.form) setForm(d.form);
        if (d.promoCode) setPromoCode(d.promoCode);
        if (d.appliedPromoCode) setAppliedPromoCode(d.appliedPromoCode);
      }
      setDraftLoaded(true);
    });
    return () => { active = false; };
  }, []);

  // Auto-save checkout state to localStorage on every change (skip first render before draft loads)
  useEffect(() => {
    if (!draftLoaded) return;
    saveDraft({
      step, deliveryMethod, lockerId, postalCode, address, city,
      addressSearch, apartment, floor, entryCode, deliveryDate,
      timeSlot, deliveryNote, form, promoCode, appliedPromoCode,
    });
  }, [draftLoaded, step, deliveryMethod, lockerId, postalCode, address, city,
      addressSearch, apartment, floor, entryCode, deliveryDate,
      timeSlot, deliveryNote, form, promoCode, appliedPromoCode]);

  // Sync address fields from context when it loads from localStorage (delayed hydration)
  useEffect(() => {
    if (buyerCtxAddress && !postalCode) {
      void Promise.resolve().then(() => {
        setPostalCode(buyerCtxAddress.postalCode);
        setCity(buyerCtxAddress.city);
        setAddressSearch(buyerCtxAddress.fullText);
      });
    }
  }, [buyerCtxAddress, postalCode]);

  function applyAddress(parsed: ParsedAddress) {
    if (parsed.street) setAddress(parsed.street);
    if (parsed.city) setCity(parsed.city);
    if (parsed.postalCode) setPostalCode(parsed.postalCode);
    setShowSaveForm(true);
  }

  function applySavedAddress(a: SavedAddress) {
    setAddress(a.street);
    setCity(a.city);
    setPostalCode(a.postalCode);
    setAddressSearch(a.fullText);
  }

  function handleSaveAddress() {
    const label = saveLabel === "custom" ? customLabel.trim() : saveLabel;
    if (!label || !address || !postalCode) return;
    addSavedAddress({ label, fullText: addressSearch || `${address}, ${city}`, street: address, city, postalCode });
    setShowSaveForm(false);
    setSaveLabel("");
    setCustomLabel("");
  }

  // Time slot options based on zone + delivery method
  function getTimeSlots(zone: number | null): string[] {
    if (zone === null) return [];
    if (zone === 0 || zone === 1) {
      return ["09:00–12:00", "12:00–18:00", "18:00–22:00"];
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

  const deliveryInfo = useMemo(() => deliveryMethod === "locker"
    ? { locker_id: lockerId, postal_code: postalCode, address, city, address_search: addressSearch }
    : { postal_code: postalCode, address, city, apartment, floor, entry_code: entryCode,
        address_search: addressSearch, method: deliveryMethod, delivery_date: deliveryDate, time_slot: timeSlot, note: deliveryNote },
    [deliveryMethod, lockerId, postalCode, address, addressSearch, city, apartment, floor, entryCode, deliveryDate, timeSlot, deliveryNote]);
  const quoteRequest: CheckoutQuoteRequest = { items: cartReferences(items), deliveryType: deliveryMethod, deliveryInfo, promoCode: appliedPromoCode.trim() };
  const promoDirty = promoCode.trim() !== appliedPromoCode.trim();
  const checkout = useCheckoutQuote(quoteRequest, ready && draftLoaded && !storageError && !promoDirty, promoCode);
  const { quote, signature, state: quoteState, activeSignature } = checkout;
  const [reviewedSignature, setReviewedSignature] = useState("");
  const [reviewedFingerprint, setReviewedFingerprint] = useState("");
  useEffect(() => { if (quote) hydrateItems(quote.items); }, [quote, hydrateItems]);
  const total = quote ? quote.subtotalCents / 100 : null;
  const displayItems = quote?.items ?? items;
  const zoneResult = useMemo(() => lookupPostalCode(postalCode), [postalCode]);
  const zonePricing = zoneResult.found ? zoneResult.pricing : null;
  // Preview only canonical server metadata; local seller/temperature flags are not authority.
  const canonicalSellers = (quote?.sellers ?? []).map(seller => ({
    sellerId: seller.id, homeLockerIds: seller.homeLockerIds,
    items: (quote?.items ?? []).filter(item => item.sellerId === seller.id).map(item => ({
      category: item.category, storageType: item.storageType,
      courierDelivery: item.courier_delivery, expressDelivery: item.express_delivery,
    })),
  }));
  function methodPreview(method: DeliveryMethod, destination = lockerId) {
    if (!quote || !canonicalSellers.length) return null;
    const result = calculateDeliveryQuote({ method, lockerId: destination, buyerPostalCode: postalCode, sellers: canonicalSellers });
    return result.ok ? result.totalCents / 100 : null;
  }
  const lockerFee = methodPreview("locker");
  const courierFee = methodPreview("courier");
  const expressFee = methodPreview("express");
  const anyItemAllowsExpress = !!quote?.items.length && quote.items.every(item => item.express_delivery === true);
  const expressAvailable = anyItemAllowsExpress && expressFee !== null;
  const isDualTemp = new Set(quote?.items.map(item => item.storageType)).size > 1;
  const deliveryFee = quote?.deliveryFeeCents == null ? null : quote.deliveryFeeCents / 100;
  const availableTimeSlots = getTimeSlots(zonePricing?.zone ?? null);
  const grandTotal = quote?.totalCents == null ? null : quote.totalCents / 100;
  const promoValid = quote?.promo.valid === true;
  const promoDiscount = quote?.discountCents ?? 0;
  const promoChecking = !promoDirty && !quote && !quoteState.error;
  const promoMsg = quote?.promo.reason ?? (promoValid ? "Kods pielietots aprēķinā" : "");
  function checkPromo() { setAppliedPromoCode(promoCode.trim()); checkout.refresh(); }
  const sellerGroups = quote?.sellers ?? [];

  // Real product data for upsell sections (replaces hardcoded mock-data catalog,
  // which showed unrelated demo products like caviar regardless of cart contents).
  const [dbListings, setDbListings] = useState<Listing[]>([]);
  const [bestSellerListings, setBestSellerListings] = useState<Listing[]>([]);
  useEffect(() => {
    (async () => {
      const [active, best] = await Promise.all([
        fetchActiveListings(),
        fetchBestSellers(20),
      ]);
      setDbListings(active);
      setBestSellerListings(best);
    })();
  }, []);

  const cartItemIds = useMemo(() => new Set(items.map(i => i.listingId ?? i.id)), [items]);
  const sellerIds = useMemo(() => new Set(items.map(i => i.sellerId).filter(Boolean) as string[]), [items]);

  // "No tiem pašiem ražotājiem" — other real products from sellers already in the cart.
  const upsells = useMemo(() =>
    dbListings
      .filter((l) => sellerIds.has(l.sellerId) && !cartItemIds.has(l.id))
      .slice(0, 6),
    [dbListings, cartItemIds, sellerIds]
  );

  // "Pircēji bieži pievieno arī" — real best-sellers (based on actual paid orders
  // in the last 7 days), from OTHER sellers for diversity. Falls back to filling
  // remaining slots with newest real listings if there isn't enough order data yet.
  const popularUpsells = useMemo(() => {
    const fromOrders = bestSellerListings.filter(
      (l) => !cartItemIds.has(l.id) && !sellerIds.has(l.sellerId)
    );
    if (fromOrders.length >= 4) return fromOrders.slice(0, 4);
    const seen = new Set(fromOrders.map((l) => l.id));
    const fallback = dbListings.filter(
      (l) => !cartItemIds.has(l.id) && !sellerIds.has(l.sellerId) && !seen.has(l.id)
    );
    return [...fromOrders, ...fallback].slice(0, 4);
  }, [bestSellerListings, dbListings, cartItemIds, sellerIds]);

  function setField(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function canProceedToDelivery() {
    return ready && !storageError && items.length > 0;
  }

  function canConfirm() {
    return missingFields().length === 0 && payableQuote(quote) && !storageError;
  }

  function missingFields(): string[] {
    const missing: string[] = [];
    if (!form.name.trim()) missing.push("Vārds, uzvārds");
    if (!form.phone.trim()) missing.push("Tālrunis");
    if (!form.email.trim()) missing.push("E-pasts");
    if (deliveryMethod === "locker" && (!getOpenLocker(lockerId))) missing.push("pārtikas pakomāts");
    if (deliveryMethod === "courier" || deliveryMethod === "express") {
      if (!zoneResult.found) missing.push("Pasta indekss (derīgā zonā)");
      if (!address.trim()) missing.push("Iela un mājas nr.");
      if (!city.trim()) missing.push("Pilsēta");
      if (!deliveryDate) missing.push("Datums");
      if (!availableTimeSlots.includes(timeSlot)) missing.push("Laika logs");
      if (deliveryMethod === "express" && !expressAvailable) missing.push("Eksprespiegāde nav pieejama šajā zonā");
    }
    return missing;
  }

  async function handlePay() {
    if (deliveryMethod === "locker" && isClosedLockerId(lockerId)) {
      setPayError("Tukuma pakomāts ir slēgts. Izvēlies citu saņemšanas vietu.");
      setStep("delivery");
      return;
    }
    const current = currentQuote(checkout.state, signature);
    if (!canConfirm() || !payableQuote(current) || reviewedSignature !== signature || reviewedFingerprint !== current.fingerprint) {
      setPayError("Groza aprēķins ir mainījies. Pārskati un apstiprini to atkārtoti.");
      setStep("delivery");
      return;
    }
    const paymentSignature = signature;
    const paymentGeneration = checkout.generation.current;
    setSubmitting(true);
    setPayError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (activeSignature.current !== paymentSignature || checkout.generation.current !== paymentGeneration || !currentQuote(checkout.state, paymentSignature)) {
        throw new Error("Grozs ir mainījies. Pārskati aprēķinu atkārtoti.");
      }
      const res = await fetch("/api/checkout/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({ ...quoteRequest,
          contact: { name: form.name, email: form.email, phone: form.phone },
          expectedTotalCents: current.totalCents,
          quoteFingerprint: current.fingerprint,
        }),
      });
      if (res.status === 409) {
        const replacement: CheckoutQuoteResponse = await res.json();
        if (activeSignature.current === paymentSignature && checkout.generation.current === paymentGeneration) {
          if (replacement.ok || !replacement.quote || !checkout.replace(replacement.quote, paymentSignature)) checkout.invalidate();
          setReviewedSignature("");
          setStep("delivery");
        }
        setPayError("Cena vai piegādes nosacījumi mainījās. Pārskati un apstiprini jauno aprēķinu. Maksājums netika atkārtots.");
        setSubmitting(false);
        return;
      }
      if (activeSignature.current !== paymentSignature || checkout.generation.current !== paymentGeneration) throw new Error("Grozs ir mainījies. Maksājuma saite netiks atvērta.");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Kļūda izveidojot maksājumu");
      }

      const { paymentUrl } = await res.json();
      if (typeof paymentUrl !== "string" || !paymentUrl) throw new Error("Maksājuma saite nav pieejama.");
      // Subscribe to newsletter if consent given (fire-and-forget)
      if (newsletterConsent && form.email.trim()) {
        fetch("/api/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: form.email.trim(), name: form.name.trim() || undefined, source: "checkout" }),
        }).catch(() => {});
      }

      // Clear checkout draft on successful submit
      try { localStorage.removeItem(CHECKOUT_KEY); } catch {}

      // Navigate via /pay which does a server-side 302 redirect to Paysera.
      // The 302 preserves Referer in the HTTP redirect chain, fixing Paysera
      // 0x13 error in PWA standalone mode.
      window.location.assign(new URL(`/pay?url=${encodeURIComponent(paymentUrl)}`, window.location.origin).href);
    } catch (err) {
      console.error(err);
      setPayError(err instanceof Error ? err.message : "Kļūda izveidojot maksājumu. Mēģini vēlreiz.");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {storageError && <div role="alert" className="mb-4 rounded-xl bg-amber-50 p-4">{storageError} <button onClick={clear} className="underline">Atiestatīt grozu</button></div>}
      {items.length > 0 && <div aria-live="polite" className="mb-4 rounded-xl bg-gray-50 p-4 text-sm">
        {promoDirty ? "Pielieto vai noņem ievadīto promo kodu, lai pārbaudītu aprēķinu." : quoteState.signature === signature && quoteState.error ? <><p role="alert">{quoteState.error}</p><button onClick={checkout.refresh} className="underline">Pārbaudīt vēlreiz</button></> : !quote ? "Pārbaudām grozu un piegādi…" : !quote.available ? "Piegāde vēl nav pieejama. Izvēlies derīgu galamērķi un piegādes veidu." : "Groza cenas un piegāde pārbaudītas."}
        {quoteState.signature === signature && quoteState.issues?.map(issue => <p key={issue.id + issue.code}>{issue.message} <Link href={items.find(item => item.id === issue.id)?.listingId ? `/listing/${items.find(item => item.id === issue.id)!.listingId}` : "/catalog"} className="underline">Izvēlēties preci atkārtoti</Link> <button onClick={() => removeItem(issue.id)} className="underline">Noņemt</button></p>)}
        {!quote && items.some(item => !item.listingId) && <p>Saglabātās preces tiek pārbaudītas. Neatpazītu variantu noņem un <Link href="/catalog" className="underline">izvēlies atkārtoti katalogā</Link>.</p>}
      </div>}
      {payError && <p role="alert" className="mb-4 text-red-700">{payError}</p>}
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
                      { label: "🥩 Gaļa", slug: "Gaļa & medījumi" },
                      { label: "🥟 Saldēta", slug: "Saldēta pārtika" },
                      { label: "🐟 Jūras veltes", slug: "Zivis & jūras veltes" },
                      { label: "🥬 Dārzeņi", slug: "Dārzeņi, augļi & ogas" },
                      { label: "🍰 Konditoreja", slug: "Maize & konditoreja" },
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
                  {displayItems.map((item) => (
                    <CartItemRow key={item.id} item={item} verified={!!quote} updateQty={updateQty} removeItem={removeItem} />
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
                  label="pārtikas pakomāts"
                  price={lockerFee === null ? "Izvēlies pakomātu" : formatPrice(lockerFee)}
                  hint="Piekļuve izvēlētās vietas darba laikā"
                  highlight
                />
                <DeliveryMethodCard
                  method="courier"
                  selected={deliveryMethod === "courier"}
                  onSelect={() => setDeliveryMethod("courier")}
                  icon={<Truck size={18} />}
                  label="Kurjers"
                  price={courierFee === null ? "Nav pieejams / norādi indeksu" : formatPrice(courierFee)}
                  hint="Mājas durvīs"
                />
                {anyItemAllowsExpress && (
                  <DeliveryMethodCard
                    method="express"
                    selected={deliveryMethod === "express"}
                    onSelect={() => setDeliveryMethod("express")}
                    icon={<Zap size={18} />}
                    label="Eksprespiegāde"
                    price={expressFee === null ? "Nav pieejams" : formatPrice(expressFee)}
                    hint="5h pēc operatora rezervācijas"
                  />
                )}
              </div>

              {/* Multi-temp note */}
              {isDualTemp && (
                <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  <p>Tavs grozs satur <strong>dzesētus un saldētus</strong> produktus —
                    temperatūras režīmi ir iekļauti aprēķinā. Pakomāta maksa ir viena katram ražotājam, arī diviem temperatūras režīmiem.</p>
                </div>
              )}

              {/* Method-specific details */}
              {deliveryMethod === "locker" && (() => {
                // Dynamic locker filtering:
                // All non-coming_soon lockers are shown by default (logistics distributes to all).
                // Local-only destinations require permission from every canonical seller.
                const availableLockers = lockers.filter(l => !l.coming_soon && !isClosedLockerId(l.id))
                  .filter(l => !l.pickup_only || (sellerGroups.length > 0 && sellerGroups.every(seller => seller.homeLockerIds.includes(l.id))));
                // Compute distances from buyer to each locker (if postal code is set)
                const distanceMap = new Map<string, number>();
                const pc = postalCode.replace(/\D/g, "");
                if (pc.length === 4 && zoneResult.found) {
                  const code = parseInt(pc, 10);
                  const zone = zoneResult.zone;
                  const nearest = nearestLockersForCode(code, zone, 20);
                  for (const nl of nearest) distanceMap.set(nl.id, nl.distanceKm);
                }
                // Sort: by distance if available, otherwise Rīga first
                const sorted = [...availableLockers].sort((a, b) => {
                  const dA = distanceMap.get(a.id);
                  const dB = distanceMap.get(b.id);
                  if (dA !== undefined && dB !== undefined) return dA - dB;
                  if (dA !== undefined) return -1;
                  if (dB !== undefined) return 1;
                  const aRiga = a.city === "Rīga" ? 0 : 1;
                  const bRiga = b.city === "Rīga" ? 0 : 1;
                  if (aRiga !== bRiga) return aRiga - bRiga;
                  return a.city.localeCompare(b.city, "lv");
                });
                return (
                <div className="space-y-3">
                <h3 className="text-sm font-bold text-gray-900">Izvēlies pārtikas pakomātu</h3>
                  {sorted.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">Nav pieejamu pakomātu šim grozam.</p>
                  ) : sorted.map((l) => (
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
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-900">{l.city} — {l.name}</p>
                          {l.pickup_only && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                              Tikai vietējā saņemšana
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-500">
                          <span className="flex items-center gap-1"><MapPin size={11} />{l.address}</span>
                          <span className="flex items-center gap-1"><Clock size={11} />{l.hours}</span>
                          {distanceMap.has(l.id) && (
                            <span className="flex items-center gap-1 font-semibold text-brand-700">
                              ~{distanceMap.get(l.id)!.toFixed(1)} km
                            </span>
                          )}
                        </div>
                        {l.pickup_only && (
                          <p className="mt-1 text-[11px] text-amber-700">
                            ⚠ Šis pārtikas pakomāts apkalpo tikai vietējo ražotāju produktus. Kurjerpiegāde uz šo pārtikas pakomātu nav pieejama.
                          </p>
                        )}
                      </div>
                      {lockerId === l.id && (
                        <CheckCircle size={18} className="shrink-0 text-[#192635]" />
                      )}
                    </label>
                  ))}
                </div>
                );
              })()}

              {(deliveryMethod === "courier" || deliveryMethod === "express") && (
                <div className="space-y-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Piegādes adrese</h3>
                    <p className="mt-0.5 text-xs text-gray-500">
                      Sāc rakstīt — sistēma piedāvās adreses no Latvijas
                    </p>
                  </div>

                  {/* Saved addresses quick-pick */}
                  {savedAddresses.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold text-gray-500">Saglabātās adreses</p>
                      <div className="flex flex-wrap gap-1.5">
                        {savedAddresses.map((a) => (
                          <div key={a.id} className="flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 pl-3 pr-1 py-1 text-xs font-semibold text-brand-800">
                            <button type="button" onClick={() => applySavedAddress(a)} className="hover:underline">
                              {a.label}
                            </button>
                            <button type="button" onClick={() => removeSavedAddress(a.id)}
                              className="ml-0.5 rounded-full p-0.5 text-brand-400 hover:bg-brand-100 hover:text-brand-700">
                              <X size={10} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

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

                  {/* Save address prompt */}
                  {showSaveForm && address && postalCode && (
                    <div className="rounded-xl border border-brand-100 bg-brand-50/50 p-3 space-y-2">
                      <p className="text-xs font-semibold text-brand-800">Saglabāt šo adresi?</p>
                      <div className="flex flex-wrap gap-1.5">
                        {QUICK_LABELS.map((l) => (
                          <button key={l} type="button"
                            onClick={() => setSaveLabel(l)}
                            className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                              saveLabel === l
                                ? "border-brand-400 bg-brand-100 text-brand-800"
                                : "border-gray-200 bg-white text-gray-600 hover:border-brand-300"
                            }`}>{l}</button>
                        ))}
                        <button type="button"
                          onClick={() => setSaveLabel("custom")}
                          className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                            saveLabel === "custom"
                              ? "border-brand-400 bg-brand-100 text-brand-800"
                              : "border-gray-200 bg-white text-gray-600 hover:border-brand-300"
                          }`}>+ Cits</button>
                      </div>
                      {saveLabel === "custom" && (
                        <input
                          value={customLabel}
                          onChange={(e) => setCustomLabel(e.target.value)}
                          placeholder="Piemēram: Draugi, Dārzs..."
                          className="input w-full text-sm"
                        />
                      )}
                      <div className="flex gap-2">
                        <button type="button" onClick={handleSaveAddress}
                          disabled={!saveLabel || (saveLabel === "custom" && !customLabel.trim())}
                          className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-700 disabled:opacity-40 transition">
                          Saglabāt
                        </button>
                        <button type="button" onClick={() => setShowSaveForm(false)}
                          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50">
                          Izlaist
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Zone feedback */}
                  {postalCode && !zoneResult.found && (
                    <p className="text-xs text-amber-700">
                      {zoneResult.reason === "invalid_format"
                        ? "Ievadi 4-ciparu Latvijas pasta indeksu"
                        : `Indekss LV-${zoneResult.code} nav mūsu apkalpotajās zonās — sazinies ar mums vai izvēlies pārtikas pakomātu`}
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
                          {deliveryMethod === "express" ? "Vēlamais laiks — apstiprina operators" : "Izvēlies laika logu"}
                        </h4>
                        <p className="mt-0.5 text-xs text-gray-500">
                          {deliveryMethod === "express" ? "Eksprespiegāde 5h laikā pēc operatora rezervācijas." : "Pasūtījuma rezervēšana iepriekšējā dienā līdz 20:00"}
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
                          placeholder="Piem., ieeja no pagalma, durvju kods 4567#"
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
                <label className="flex items-start gap-2.5 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={newsletterConsent}
                    onChange={(e) => setNewsletterConsent(e.target.checked)}
                    className="mt-0.5 accent-brand-600 h-4 w-4"
                  />
                  <span className="text-xs text-gray-500 leading-snug">
                    Vēlos saņemt jaunumus par jauniem produktiem, ražotājiem un piedāvājumiem e-pastā.
                    Vari atrakstīties jebkurā brīdī.
                  </span>
                </label>
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
                  const l = lockers.find((x) => x.id === lockerId);
                  if (!l) return <p className="text-sm text-red-600">Saņemšanas vieta nav pieejama. Izvēlies citu pakomātu piegādes solī.</p>;
                  return (
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50">
                        <Package size={18} className="text-brand-700" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">pārtikas pakomāts — {l.city} — {l.name}</p>
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
                        {deliveryMethod === "courier" ? "Kurjers" : "Eksprespiegāde — 5h pēc operatora rezervācijas"}
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
                {displayItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                      <Image src={publicProductImage(item.image)} alt={item.title} fill className="object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">{item.title}</p>
                      <p className="text-xs text-gray-500">{item.sellerName} · {item.quantity}×</p>
                    </div>
                    <p className="text-sm font-semibold text-gray-900">
                      {quote ? formatPrice(item.price * item.quantity) : "Cena tiek pārbaudīta"}
                    </p>
                  </div>
                ))}
              </div>

              {/* Paysera info */}
              <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800">
                <p className="font-semibold mb-1">Apmaksa ar Paysera</p>
                <p className="text-xs text-blue-600">
                  Nospiežot &quot;Maksāt&quot;, tiksi novirzīts uz Paysera drošo maksājumu lapu.
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
                <span>{total === null ? "Tiek pārbaudīts" : formatPrice(total)}</span>
              </div>

              {/* On step "cart", piegāde nav vēl izvēlēts — neuzrādām maksu */}
              {step === "cart" ? (
                <div className="flex justify-between text-gray-400 text-xs italic">
                  <span>Piegādes maksu redzēsi nākamajā solī</span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between text-gray-600">
                    <span>Piegāde</span>
                    <span>{deliveryFee === null ? "Nav pieejams — izvēlies piegādi" : formatPrice(deliveryFee)}</span>
                  </div>
                  {quote?.delivery.ok && quote.delivery.breakdown.map(fee => (
                    <div key={fee.sellerId} className="flex justify-between text-xs text-gray-500">
                      <span>{quote.sellers.find(seller => seller.id === fee.sellerId)?.name}</span>
                      <span>{formatPrice(fee.totalCents / 100)}</span>
                    </div>
                  ))}
                </>
              )}

              {/* Promo discount */}
              {promoValid && promoDiscount > 0 && step !== "cart" && (
                <div className="flex justify-between text-green-700 text-xs">
                  <span className="flex items-center gap-1">
                    <Tag size={11} /> Promo: {promoCode.toUpperCase()}
                  </span>
                  <span>−{formatPrice(promoDiscount / 100)}</span>
                </div>
              )}

              <div className="border-t border-gray-100 pt-2 flex justify-between font-extrabold text-gray-900 text-base">
                <span>Kopā</span>
                <span>{step === "cart" ? total === null ? "Tiek pārbaudīts" : formatPrice(total) : grandTotal === null ? "Nav aprēķināts" : formatPrice(grandTotal)}</span>
              </div>
            </div>

            {step === "cart" && (
              <button
                onClick={() => { setStep("delivery"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                disabled={!canProceedToDelivery()}
                className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-40"
              >
                Uz piegādi <ChevronRight size={16} />
              </button>
            )}

            {/* Promo code input — visible on delivery + confirm steps */}
            {step !== "cart" && (
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-2">
                <p className="text-xs font-semibold text-gray-500">Promo kods</p>
                <div className="flex gap-2">
                  <input
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    placeholder="Ievadi promo kodu"
                    className="input flex-1 text-sm font-mono uppercase"
                    disabled={promoValid}
                  />
                  {promoValid ? (
                    <button onClick={() => { setPromoCode(""); setAppliedPromoCode(""); }}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100">
                      Noņemt
                    </button>
                  ) : (
                    <><button onClick={checkPromo} disabled={promoChecking || !promoCode.trim()}
                      className="rounded-lg bg-[#192635] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#243647] disabled:opacity-40">
                      {promoChecking ? <Loader2 size={12} className="animate-spin" /> : "Pielietot"}
                    </button>
                    {(promoCode || appliedPromoCode) && <button onClick={() => { setPromoCode(""); setAppliedPromoCode(""); }} className="text-xs underline">Notīrīt</button>}</>
                  )}
                </div>
                {promoMsg && (
                  <p className={`text-xs ${promoValid ? "text-green-700" : "text-red-600"}`}>
                    {promoMsg}
                  </p>
                )}
              </div>
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
                  onClick={() => { if (!canConfirm()) return; setReviewedSignature(signature); setReviewedFingerprint(quote!.fingerprint); setStep("confirm"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  disabled={!canConfirm()}
                  className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  Apstiprināt <ChevronRight size={16} />
                </button>
                <button onClick={() => { setStep("cart"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
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
                  disabled={submitting || !canConfirm() || reviewedSignature !== signature || reviewedFingerprint !== quote?.fingerprint}
                  className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-60"
                  style={{ backgroundColor: "#192635" }}
                >
                  {submitting
                    ? <><Loader2 size={16} className="animate-spin" /> Apstrādā...</>
                    : <>Maksāt {grandTotal === null ? "—" : formatPrice(grandTotal)} →</>
                  }
                </button>
                <button onClick={() => { setStep("delivery"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
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
  verified,
  updateQty,
  removeItem,
}: {
  item: CartItem;
  verified: boolean;
  updateQty: (id: string, qty: number) => void;
  removeItem: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 p-3 sm:gap-4 sm:p-4">
      <Link href={item.listingId ? `/listing/${item.listingId}` : "/catalog"} className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-gray-100 sm:h-16 sm:w-16">
        <Image src={publicProductImage(item.image)} alt={item.title} fill className="object-cover" />
      </Link>
      <div className="flex-1 min-w-0">
        <Link href={item.listingId ? `/listing/${item.listingId}` : "/catalog"}
          className="block truncate text-sm font-semibold text-gray-900 hover:text-brand-600">
          {item.title}
        </Link>
        <p className="text-xs text-gray-500">{item.sellerName}</p>
        <p className="mt-0.5 text-sm font-bold text-gray-900">
          {verified ? formatPrice(item.price * item.quantity) : "Cena tiek pārbaudīta"}
          {verified && <span className="ml-1 text-xs font-normal text-gray-400">
            ({formatPrice(item.price)} / {item.unit})
          </span>}
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

function UpsellSection({ title, items }: { title: string; items: Listing[] }) {
  const { addItem, ready, storageError } = useCart();
  const [added, setAdded] = useState<Record<string, boolean>>({});

  function handleAdd(item: (typeof items)[0], e: React.MouseEvent) {
    if (item.variants?.length) return;
    e.preventDefault();
    if (!ready || storageError) return;
    addItem({
      ...cartIdentity(item.id),
      title: item.title,
      price: item.price,
      unit: item.unit,
      image: item.image,
      sellerName: item.seller.farmName,
      sellerId: item.sellerId,
      storageType: getStorageType(item),
      express_delivery: item.express_delivery ?? false,
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
              <Image src={publicProductImage(item.image)} alt={item.title} fill className="object-cover group-hover:scale-105 transition-transform duration-300" />
            </div>
            <div className="p-3 flex-1 flex flex-col justify-between gap-1">
              <p className="text-xs font-semibold text-gray-900 line-clamp-2 leading-snug">{item.title}</p>
              <div className="flex items-center justify-between gap-1 mt-1">
                <p className="text-sm font-bold text-gray-900">{formatPrice(item.price)}</p>
                <button
                  onClick={(e) => handleAdd(item, e)}
                  disabled={!ready || !!storageError}
                  className={cn(
                    "flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold transition-all shrink-0",
                    added[item.id]
                      ? "bg-green-500 text-white"
                      : "bg-[#192635] text-white hover:bg-[#243647]"
                  )}
                >
                  {added[item.id] ? <CheckCircle size={10} /> : "+"}
                  {item.variants?.length ? "Izvēlies variantu" : added[item.id] ? "Piev." : "Grozā"}
                </button>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
