import { createClient } from "@supabase/supabase-js";
import { buildPayseraRedirectUrl, trustedPaymentBaseUrl } from "@/lib/paysera";
import { attachOrderCookie, newOrderNumber } from "@/lib/order-access";
import { CheckoutError, orderItemSnapshot, record } from "@/lib/checkout-items";
import { isClosedLockerId } from "@/lib/locker-policy";
import { acceptingMarketplaceReservations, reserveMarketplaceOrder } from "@/lib/marketplace-lifecycle";
import {
  buildCheckoutQuote, checkoutBuyerId, checkoutExpectationsMatch, checkoutFailure,
  checkoutJson, contactForCheckout, readCheckoutBody,
} from "@/lib/checkout-quote";

export async function POST(req: Request) {
  try {
    const body = await readCheckoutBody(req);
    if ((body.deliveryType ?? "locker") === "locker") {
      const info = record(body.deliveryInfo) ? body.deliveryInfo : {};
      const legacy = record(body.locker) ? body.locker : {};
      if (isClosedLockerId(info.locker_id ?? legacy.id)) {
        throw new CheckoutError(400, "CLOSED_LOCKER", "Tukuma pakomāts ir slēgts. Izvēlies citu saņemšanas vietu.");
      }
    }
    const contact = contactForCheckout(body);
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
    const buyerId = await checkoutBuyerId(req, supabase);
    const quote = await buildCheckoutQuote(supabase, body, buyerId);
    if (!quote.available || !quote.delivery.ok) {
      return checkoutJson({ ok: false, code: "DELIVERY_UNAVAILABLE", error: "Precizē saņemšanas vietu vai piegādes veidu.", quote }, 409);
    }
    if (quote.deliveryType !== "locker" && (!quote.deliveryInfo.address || !quote.deliveryInfo.city)) {
      throw new CheckoutError(400, "INVALID_ADDRESS", "Norādi piegādes adresi un pilsētu.");
    }
    if (body.expectedTotalCents === undefined && body.quoteFingerprint === undefined
      && typeof body.promoCode === "string" && body.promoCode.trim()) {
      return checkoutJson({
        ok: false, code: "quote_confirmation_required",
        error: "Atjauno lapu, pārskati promo atlaidi un apstiprini aktuālo pasūtījuma summu.", quote,
      }, 409);
    }
    if (!Number.isSafeInteger(quote.totalCents) || quote.totalCents! <= 0) {
      throw new CheckoutError(400, "INVALID_TOTAL", "Pasūtījuma summai jābūt lielākai par nulli.");
    }
    if (!checkoutExpectationsMatch(body, quote)) {
      return checkoutJson({ ok: false, code: "QUOTE_CHANGED", error: "Grozs vai piegādes summa ir mainījusies. Atjauno aprēķinu vai lapu, pārskati un apstiprini vēlreiz.", quote }, 409);
    }
    const orderNumber = newOrderNumber("TRG");
    let paymentUrl: string;
    try {
      // Validate configuration before inserting; never derive a return URL from Host.
      paymentUrl = buildPayseraRedirectUrl({
        orderNumber, amountCents: quote.totalCents!, buyerEmail: contact.email,
        buyerName: contact.name, buyerPhone: contact.phone, baseUrl: trustedPaymentBaseUrl(),
      });
    } catch {
      throw new CheckoutError(503, "PAYMENT_UNAVAILABLE", "Maksājuma pakalpojums pašlaik nav pieejams.");
    }
    const promoCode = quote.promo.valid && quote.discountCents > 0 ? quote.promo.code ?? null : null;
    const deliveryInfo = {
      ...quote.deliveryInfo,
      delivery_fee_cents: quote.deliveryFeeCents,
      delivery_fees_by_seller: quote.delivery.breakdown.map(fee => ({
        ...fee, sellerName: quote.sellers.find(seller => seller.id === fee.sellerId)!.name, feeCents: fee.totalCents,
      })),
      tariff_version: quote.delivery.breakdown[0]?.tariffVersion,
      zone_policy: quote.delivery.breakdown[0]?.zonePolicy,
      ...(promoCode ? { promo_code: promoCode, promo_discount_cents: quote.discountCents } : {}),
    };
    const payload = {
      order_number: orderNumber, status: "pending", payment_status: "awaiting",
      payment_provider: "paysera", payment_session_id: orderNumber, buyer_id: buyerId,
      buyer_name: contact.name, buyer_email: contact.email, buyer_phone: contact.phone,
      delivery_type: quote.deliveryType, delivery_info: deliveryInfo,
      items: quote.items.map(orderItemSnapshot), total_cents: quote.totalCents,
      total_amount: quote.totalCents! / 100, seller_ids: quote.sellerIds,
      promo_code: promoCode, promo_discount_cents: quote.discountCents,
    };
    if (acceptingMarketplaceReservations()) {
      const reserved = await reserveMarketplaceOrder(supabase, payload);
      return attachOrderCookie(checkoutJson({
        ok: true, paymentUrl, orderId: reserved.order_number, totalCents: quote.totalCents,
        quoteFingerprint: quote.fingerprint, reservationExpiresAt: reserved.reserved_until,
      }), reserved.order_number);
    }
    const { data: order, error } = await supabase.from("orders").insert(payload).select("id, order_number").single();
    if (error || !order || order.order_number !== orderNumber) {
      throw new CheckoutError(503, "ORDER_UNAVAILABLE", "Neizdevās saglabāt pasūtījumu.");
    }
    return attachOrderCookie(checkoutJson({
      ok: true, paymentUrl, orderId: orderNumber, totalCents: quote.totalCents, quoteFingerprint: quote.fingerprint,
    }), orderNumber);
  } catch (error) { return checkoutFailure(error); }
}
