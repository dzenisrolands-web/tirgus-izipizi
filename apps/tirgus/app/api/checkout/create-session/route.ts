import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { buildPayseraRedirectUrl } from "@/lib/paysera";
import { validatePromoCode } from "@/lib/promo";
import { checkoutListingIds, normalizeCheckoutItems, type CheckoutListing } from "@/lib/checkout-items";
import { grantOrderAccess } from "@/lib/order-access";
import { getOpenLocker, deliveryLockersForSellers } from "@/lib/locker-policy";
import { lookupPostalCode } from "@/lib/postal-zones";
import { calculateDeliveryQuote, DELIVERY_TARIFF_VERSION } from "@/lib/delivery-policy";
import { createReservedOrder } from "@/lib/stock-reservations";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.items) || !body.items.length || body.items.length > 100 ||
      body.items.some((i: { id?: unknown; quantity?: unknown } | null) => !i || typeof i.id !== "string" ||
        i.id.length > 200 || !Number.isSafeInteger(i.quantity) || Number(i.quantity) < 1 || Number(i.quantity) > 999)) {
    return NextResponse.json({ error: "Nederīgs grozs" }, { status: 400 });
  }
  const deliveryType = body.deliveryType ?? "locker";
  if (!["locker", "courier", "express"].includes(deliveryType)) {
    return NextResponse.json({ error: "Nederīgs piegādes veids" }, { status: 400 });
  }
  const contact = body.contact;
  if (!contact || typeof contact.email !== "string" || contact.email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email) ||
      typeof contact.name !== "string" || !contact.name.trim() || contact.name.length > 200 ||
      typeof contact.phone !== "string" || !contact.phone.trim() || contact.phone.length > 40) {
    return NextResponse.json({ error: "Trūkst kontaktinfo" }, { status: 400 });
  }
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
  let buyerId: string | null = null;
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (token) {
    const { data: { user }, error } = await sb.auth.getUser(token);
    if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    buyerId = user.id;
  }
  const { data: listings, error: listingsError } = await sb.from("listings")
    .select("id, title, price, quantity, unit, seller_id, status, variants, vat_rate, courier_delivery, express_delivery, category, storage_type")
    .in("id", checkoutListingIds(body.items));
  if (listingsError) return NextResponse.json({ error: "Neizdevās pārbaudīt preces" }, { status: 503 });
  let items;
  try { items = normalizeCheckoutItems(body.items, (listings ?? []) as CheckoutListing[], deliveryType); }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Nederīgs grozs" }, { status: 400 }); }
  const sellerIds = [...new Set(items.map(i => i.seller_id))];
  const { data: sellers, error: sellerError } = await sb.from("sellers")
    .select("id, name, status, home_locker_ids, delivery_mode, is_vat_registered").in("id", sellerIds);
  if (sellerError || sellers?.length !== sellerIds.length ||
      sellers.some(s => s.status !== "approved" || !["locker", "courier"].includes(s.delivery_mode) ||
        (s.delivery_mode === "locker" && !(s.home_locker_ids ?? []).some((id: string) => !!getOpenLocker(id))))) {
    return NextResponse.json({ error: "Ražotājs nav pieejams" }, { status: 400 });
  }
  const sellerNames = new Map(sellers.map(s => [s.id, s.name]));
  const sellerModes = new Map(sellers.map(s => [s.id, s.delivery_mode]));
  const sellerVatRegistered = new Map(sellers.map(s => [s.id, s.is_vat_registered]));
  const sellerHomeLockers = new Map(sellers.map(s => [s.id, s.home_locker_ids ?? []]));
  const orderItems = items.map(i => ({
    ...i, sellerName: sellerNames.get(i.seller_id) ?? "",
    vat_rate: sellerVatRegistered.get(i.seller_id) === false ? 0 : i.vat_rate,
    seller_delivery_mode: sellerModes.get(i.seller_id),
    seller_courier_fee_cents: sellerModes.get(i.seller_id) === "courier" ? 350 : 0,
    seller_home_locker_ids: sellerHomeLockers.get(i.seller_id),
  }));
  if (orderItems.some(i => i.vat_rate === null)) {
    return NextResponse.json({ error: "Precei nav norādīta PVN likme" }, { status: 400 });
  }
  const deliveryInfo: Record<string, unknown> = {};
  if (deliveryType === "locker") {
    const locker = getOpenLocker(body.deliveryInfo?.locker_id ?? body.locker?.id);
    if (!locker || !deliveryLockersForSellers(sellers.map(s => s.home_locker_ids ?? [])).some(l => l.id === locker.id)) {
      return NextResponse.json({ error: "Pakomāts nav pieejams" }, { status: 400 });
    }
    Object.assign(deliveryInfo, {
      locker_id: locker.id, locker_name: locker.name, locker_address: locker.address, locker_city: locker.city,
    });
  } else {
    for (const key of ["postal_code", "address", "city", "apartment", "floor", "entry_code", "delivery_date", "time_slot", "note"]) {
      const value = body.deliveryInfo?.[key];
      if (typeof value === "string") deliveryInfo[key] = value.trim().slice(0, 1000);
    }
    const zone = lookupPostalCode(String(deliveryInfo.postal_code ?? ""));
    if (!deliveryInfo.address || !deliveryInfo.city || !zone.found ||
        (deliveryType === "express" && zone.pricing.expressSingle === null)) {
      return NextResponse.json({ error: "Piegāde uz norādīto adresi nav pieejama" }, { status: 400 });
    }
    deliveryInfo.zone = zone.zone;
    deliveryInfo.method = deliveryType;
  }
  const quote = calculateDeliveryQuote({
    method: deliveryType,
    buyerPostalCode: String(deliveryInfo.postal_code ?? ""),
    lockerId: typeof deliveryInfo.locker_id === "string" ? deliveryInfo.locker_id : null,
    sellers: sellers.map(seller => ({
      sellerId: seller.id,
      homeLockerIds: seller.home_locker_ids ?? [],
      items: items.filter(item => item.seller_id === seller.id).map(item => ({
        category: item.category ?? "", storageType: item.storage_type, expressDelivery: item.express_delivery,
        courierDelivery: item.courier_delivery,
      })),
    })),
  });
  if (!quote.ok) return NextResponse.json({
    error: "Izvēlētajam grozam un adresei piegāde nav pieejama. Pārbaudi saņemšanas vietu vai piegādes veidu.",
  }, { status: 400 });
  const deliveryFeeCents = quote.totalCents;
  deliveryInfo.delivery_fee_cents = deliveryFeeCents;
  deliveryInfo.tariff_version = DELIVERY_TARIFF_VERSION;
  deliveryInfo.delivery_fees_by_seller = quote.breakdown.map(fee => ({
    ...fee, sellerName: sellerNames.get(fee.sellerId), feeCents: fee.totalCents,
  }));
  const subtotalCents = items.reduce((sum, i) => sum + Math.round(i.price * 100) * i.quantity, 0);
  let discountCents = 0;
  let promoCode: string | null = null;
  if (typeof body.promoCode === "string" && body.promoCode.length <= 100) {
    const promo = await validatePromoCode(body.promoCode, buyerId, deliveryFeeCents, deliveryType);
    if (promo.valid && Number.isSafeInteger(promo.discountCents) && promo.discountCents! > 0) {
      discountCents = Math.min(deliveryFeeCents, promo.discountCents!);
      promoCode = promo.code ?? null;
      deliveryInfo.promo_code = promoCode;
      deliveryInfo.promo_discount_cents = discountCents;
    }
  }
  const totalCents = subtotalCents + deliveryFeeCents - discountCents;
  if (!Number.isSafeInteger(totalCents) || totalCents <= 0) {
    return NextResponse.json({ error: "Nederīga summa" }, { status: 400 });
  }
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const orderNumber = `TRG-${date}-${randomBytes(12).toString("hex")}`;
  let paymentUrl: string;
  try {
    paymentUrl = buildPayseraRedirectUrl({
      orderNumber, amountCents: totalCents, buyerEmail: contact.email,
      buyerName: contact.name, buyerPhone: contact.phone,
      baseUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "https://tirgus.izipizi.lv",
    });
  } catch {
    return NextResponse.json({ error: "Paysera konfigurācijas kļūda" }, { status: 503 });
  }
  try {
    await createReservedOrder(sb, {
      order_number: orderNumber, status: "pending", payment_status: "awaiting",
      payment_provider: "paysera", payment_session_id: orderNumber, buyer_id: buyerId,
      buyer_name: contact.name.trim(), buyer_email: contact.email.trim().toLowerCase(), buyer_phone: contact.phone.trim(),
      delivery_type: deliveryType, delivery_info: deliveryInfo, items: orderItems,
      total_cents: totalCents, total_amount: totalCents / 100, seller_ids: sellerIds,
      promo_code: promoCode, promo_discount_cents: discountCents,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Rezervācija neizdevās" }, { status: 503 });
  }
  return grantOrderAccess(NextResponse.json({ paymentUrl, orderId: orderNumber, totalCents }), orderNumber);
}
