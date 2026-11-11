import crypto from "node:crypto";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CheckoutPromo, CheckoutQuote, CheckoutQuoteResponse, DeliveryMethod } from "./checkout-contract";
import { canonicalCartId } from "./cart-identity";
import { CheckoutError, loadCheckoutListings, normalizeCheckoutItems, parseItemReferences, priceCents, record, safeAdd } from "./checkout-items";
import { calculateDeliveryQuote, DELIVERY_TARIFF_VERSION } from "./delivery-policy";
import { getOpenLocker } from "./locker-policy";
import { validatePromoCode } from "./promo";

export const CHECKOUT_QUOTE_VERSION = "canonical-checkout-v1";
const MAX_BODY_BYTES = 64 * 1024;
const responseHeaders = { "Cache-Control": "private, no-store", Vary: "Authorization, Cookie" };

export async function readCheckoutBody(req: Request): Promise<Record<string, unknown>> {
  if (Number(req.headers.get("content-length")) > MAX_BODY_BYTES) {
    throw new CheckoutError(413, "BODY_TOO_LARGE", "Pieprasījums ir pārāk liels.");
  }
  const reader = req.body?.getReader();
  if (!reader) throw new CheckoutError(400, "INVALID_BODY", "Nederīgs pieprasījums.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new CheckoutError(413, "BODY_TOO_LARGE", "Pieprasījums ir pārāk liels.");
      }
      chunks.push(value);
    }
    const parsed: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
    if (!record(parsed)) throw new Error("Invalid body");
    return parsed;
  } catch (error) {
    if (error instanceof CheckoutError) throw error;
    throw new CheckoutError(400, "INVALID_BODY", "Nederīgs pieprasījums.");
  } finally { reader.releaseLock(); }
}

export async function checkoutBuyerId(req: Request, supabase: SupabaseClient): Promise<string | null> {
  const authorization = req.headers.get("authorization");
  if (authorization === null) return null;
  const match = /^Bearer ([^\s]+)$/i.exec(authorization);
  if (!match) throw new CheckoutError(401, "UNAUTHORIZED", "Nav autorizācijas.");
  const { data, error } = await supabase.auth.getUser(match[1]);
  if (error || !data.user) throw new CheckoutError(401, "UNAUTHORIZED", "Nav autorizācijas.");
  return data.user.id;
}

export function checkoutJson(body: CheckoutQuoteResponse | Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: responseHeaders });
}

export function checkoutFailure(error: unknown) {
  if (error instanceof CheckoutError) {
    return checkoutJson({ ok: false, code: error.code, error: error.message, ...(error.issues ? { issues: error.issues } : {}) }, error.status);
  }
  return checkoutJson({ ok: false, code: "CHECKOUT_UNAVAILABLE", error: "Neizdevās pārbaudīt pasūtījumu. Mēģini vēlreiz." }, 503);
}

function textField(source: Record<string, unknown>, key: string, max: number): string | undefined {
  const value = source[key];
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || value.length > max || [...value].some(char => char.charCodeAt(0) < 32 && char !== "\n")) {
    throw new CheckoutError(400, "INVALID_DELIVERY", "Nederīga piegādes informācija.");
  }
  return value.trim() || undefined;
}

function deliverySelection(body: Record<string, unknown>): { method: DeliveryMethod; info: Record<string, unknown> } {
  const method = body.deliveryType === undefined ? "locker" : body.deliveryType;
  if (method !== "locker" && method !== "courier" && method !== "express") {
    throw new CheckoutError(400, "INVALID_METHOD", "Nederīgs piegādes veids.");
  }
  if (body.deliveryInfo !== undefined && !record(body.deliveryInfo)) {
    throw new CheckoutError(400, "INVALID_DELIVERY", "Nederīga piegādes informācija.");
  }
  if (body.locker !== undefined && !record(body.locker)) {
    throw new CheckoutError(400, "INVALID_DELIVERY", "Nederīga piegādes informācija.");
  }
  const input = record(body.deliveryInfo) ? body.deliveryInfo : {};
  const info: Record<string, unknown> = {};
  if (method === "locker") {
    const legacy = record(body.locker) ? body.locker : {};
    const id = textField(input, "locker_id", 100) ?? textField(legacy, "id", 100);
    const locker = getOpenLocker(id);
    if (locker) Object.assign(info, {
      locker_id: locker.id, locker_name: locker.name, locker_address: locker.address, locker_city: locker.city,
    });
    else if (id) info.locker_id = id;
  } else {
    for (const [key, max] of Object.entries({
      postal_code: 16, address: 300, city: 100, apartment: 40, floor: 40, entry_code: 100,
      delivery_date: 10, time_slot: 50, note: 1000,
    })) {
      const value = textField(input, key, max);
      if (value !== undefined) info[key] = value;
    }
    info.method = method;
  }
  return { method, info };
}

async function readPromo(
  supabase: SupabaseClient, raw: unknown, buyerId: string | null, deliveryFeeCents: number,
  method: DeliveryMethod, preTotalCents: number,
): Promise<CheckoutPromo> {
  if (raw === undefined || raw === "") return { valid: false, discountCents: 0 };
  if (typeof raw !== "string" || raw.length > 100) throw new CheckoutError(400, "INVALID_PROMO", "Nederīgs promo kods.");
  const code = raw.trim().toUpperCase();
  if (!code) return { valid: false, discountCents: 0 };
  try {
    const promo = await validatePromoCode(code, buyerId, deliveryFeeCents, method, { supabase, strictReadErrors: true });
    if (!promo.valid) return { valid: false, discountCents: 0, ...(promo.reason ? { reason: promo.reason } : {}) };
    const amount = promo.discountCents ?? 0;
    if (!Number.isSafeInteger(amount) || amount < 0) throw new Error("Invalid discount");
    return { valid: true, code: promo.code ?? code, discountCents: Math.min(amount, preTotalCents) };
  } catch {
    throw new CheckoutError(503, "PROMO_UNAVAILABLE", "Neizdevās pārbaudīt promo kodu.");
  }
}

export async function buildCheckoutQuote(
  supabase: SupabaseClient, body: Record<string, unknown>, buyerId: string | null,
): Promise<CheckoutQuote> {
  const references = parseItemReferences(body.items);
  const { method, info } = deliverySelection(body);
  if (body.promoCode !== undefined && (typeof body.promoCode !== "string" || body.promoCode.length > 100)) {
    throw new CheckoutError(400, "INVALID_PROMO", "Nederīgs promo kods.");
  }
  const listings = await loadCheckoutListings(supabase);
  const items = normalizeCheckoutItems(references, listings);
  const sellerIds = [...new Set(items.map(item => item.sellerId))].sort();
  const { data: sellerRows, error } = await supabase.from("sellers_public")
    .select("id, name, home_locker_ids").in("id", sellerIds);
  if (error) throw new CheckoutError(503, "SELLERS_UNAVAILABLE", "Neizdevās pārbaudīt ražotājus.");
  if (!sellerRows || sellerRows.length !== sellerIds.length || new Set(sellerRows.map(seller => seller.id)).size !== sellerIds.length
    || sellerRows.some(seller => !sellerIds.includes(seller.id) || typeof seller.name !== "string"
      || (seller.home_locker_ids !== null && !Array.isArray(seller.home_locker_ids)))) {
    throw new CheckoutError(409, "SELLER_UNAVAILABLE", "Ražotājs pašlaik nav pieejams.");
  }
  const sellers = sellerRows.map(seller => ({
    id: String(seller.id), name: seller.name as string,
    homeLockerIds: [...new Set<string>(((seller.home_locker_ids ?? []) as unknown[]).filter((id): id is string => typeof id === "string"))].sort(),
  })).sort((a, b) => a.id.localeCompare(b.id));
  for (const item of items) item.sellerName = sellers.find(seller => seller.id === item.sellerId)!.name;
  const subtotalCents = items.reduce((total, item) => safeAdd(total, item.unitCents * item.quantity), 0);
  const delivery = calculateDeliveryQuote({
    method, buyerPostalCode: typeof info.postal_code === "string" ? info.postal_code : null,
    lockerId: typeof info.locker_id === "string" ? info.locker_id : null,
    sellers: sellers.map(seller => ({
      sellerId: seller.id, homeLockerIds: seller.homeLockerIds,
      items: items.filter(item => item.sellerId === seller.id).map(item => ({
        category: item.category, storageType: item.storageType,
        courierDelivery: item.courier_delivery, expressDelivery: item.express_delivery,
      })),
    })),
  });
  if (delivery.ok && (!Number.isSafeInteger(delivery.totalCents) || delivery.totalCents < 0)) {
    throw new CheckoutError(503, "INVALID_DELIVERY_AMOUNT", "Neizdevās aprēķināt piegādi.");
  }
  if (delivery.ok && method !== "locker") {
    info.postal_code = delivery.breakdown[0]?.buyerPostalCode ?? info.postal_code;
    info.zone = delivery.breakdown[0]?.buyerZone ?? null;
  }
  const preDiscountTotalCents = delivery.ok ? safeAdd(subtotalCents, delivery.totalCents) : null;
  const promo = delivery.ok ? await readPromo(supabase, body.promoCode, buyerId, delivery.totalCents, method, preDiscountTotalCents!)
    : { valid: false, discountCents: 0, ...(body.promoCode ? { reason: "Vispirms precizē piegādi." } : {}) };
  const deliveryFeeCents = delivery.ok ? delivery.totalCents : null;
  const totalCents = preDiscountTotalCents === null ? null : preDiscountTotalCents - promo.discountCents;
  const quote = {
    version: `${CHECKOUT_QUOTE_VERSION}:${DELIVERY_TARIFF_VERSION}`,
    available: delivery.ok, items, sellers, sellerIds, deliveryType: method, deliveryInfo: info,
    delivery, subtotalCents, deliveryFeeCents, discountCents: promo.discountCents,
    preDiscountTotalCents, totalCents, promo,
  };
  // Every nested object above has a fixed projection/order; arrays are canonical.
  const fingerprint = crypto.createHash("sha256").update(JSON.stringify([buyerId, quote])).digest("hex");
  return { ...quote, fingerprint };
}

export function contactForCheckout(body: Record<string, unknown>) {
  const contact = body.contact;
  if (!record(contact) || typeof contact.name !== "string" || !contact.name.trim() || contact.name.length > 200
    || typeof contact.email !== "string" || contact.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim())
    || typeof contact.phone !== "string" || !contact.phone.trim() || contact.phone.length > 40
    || [contact.name, contact.phone].some(value => [...value].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127))) {
    throw new CheckoutError(400, "INVALID_CONTACT", "Norādi derīgu kontaktinformāciju.");
  }
  return { name: contact.name.trim(), email: contact.email.trim().toLowerCase(), phone: contact.phone.trim() };
}

export function checkoutExpectationsMatch(body: Record<string, unknown>, quote: CheckoutQuote): boolean {
  if (body.expectedTotalCents !== undefined || body.quoteFingerprint !== undefined) {
    if (!Number.isSafeInteger(body.expectedTotalCents) || Number(body.expectedTotalCents) <= 0
      || typeof body.quoteFingerprint !== "string" || !/^[a-f0-9]{64}$/.test(body.quoteFingerprint)) {
      throw new CheckoutError(400, "INVALID_EXPECTATIONS", "Apstiprini aktuālo pasūtījuma summu.");
    }
    if (body.expectedTotalCents !== quote.totalCents || body.quoteFingerprint !== quote.fingerprint) return false;
  } else {
    if (!Number.isSafeInteger(body.totalCents) || Number(body.totalCents) <= 0) {
      throw new CheckoutError(400, "INVALID_EXPECTATIONS", "Apstiprini aktuālo pasūtījuma summu.");
    }
    if (body.totalCents !== quote.preDiscountTotalCents) return false;
    // A legacy PRE-discount total cannot confirm any coupon's final charge.
    if (typeof body.promoCode === "string" && body.promoCode.trim()) return false;
  }
  for (const raw of body.items as Record<string, unknown>[]) {
    if (raw.price === undefined) continue;
    let cents: number;
    try { cents = priceCents(raw.price); } catch { return false; }
    const matches = quote.items.filter(item => {
      if (raw.listingId !== undefined && raw.listingId !== item.listingId) return false;
      if (raw.variantId !== undefined) return raw.variantId === item.variantId;
      return [item.id, item.listingId, item.variantId, item.slug,
        item.slug && canonicalCartId(item.slug, item.variantId)].includes(raw.id as string);
    });
    if (matches.length !== 1 || cents !== matches[0].unitCents) return false;
  }
  return true;
}
