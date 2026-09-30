import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildPayseraRedirectUrl } from "@/lib/paysera";
import { COMMISSION_RATE } from "@/lib/commission";
import { validatePromoCode } from "@/lib/promo";

type CheckoutItem = {
  id: string;
  title: string;
  price: number;
  quantity: number;
  unit: string;
  sellerName: string;
  sellerId?: string;
  commission_rate?: number;
};

export async function POST(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );

  let body: {
    items: CheckoutItem[];
    deliveryType?: "locker" | "courier" | "express";
    deliveryInfo?: Record<string, unknown>;
    locker?: { id: string; name: string; address: string; city: string }; // backwards compat
    contact: { name: string; email: string; phone: string };
    sellerIds: string[];
    totalCents: number;
    deliveryFeeCents?: number;
    deliveryFeesBySeller?: { sellerId: string | null; sellerName: string; feeCents: number; method: string }[];
    promoCode?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Nederīgs request body" }, { status: 400 });
  }

  // Default to "locker" for backwards compat with old clients
  const deliveryType = body.deliveryType ?? "locker";

  if (!body.items?.length) return NextResponse.json({ error: "Tukšs grozs" }, { status: 400 });
  if (!body.contact?.email) return NextResponse.json({ error: "Trūkst kontaktinfo" }, { status: 400 });
  if (!body.totalCents || body.totalCents <= 0) return NextResponse.json({ error: "Nederīga summa" }, { status: 400 });

  if (deliveryType === "locker" && !body.locker?.id && !body.deliveryInfo?.locker_id) {
    return NextResponse.json({ error: "Nav izvēlēts pārtikas pakomāts" }, { status: 400 });
  }
  if ((deliveryType === "courier" || deliveryType === "express") &&
      (!body.deliveryInfo?.address || !body.deliveryInfo?.city)) {
    return NextResponse.json({ error: "Nav norādīta piegādes adrese" }, { status: 400 });
  }

  // Optionally identify buyer if logged in (via Authorization header)
  let buyerId: string | null = null;
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace("Bearer ", "");
  if (token) {
    const { data: { user } } = await supabase.auth.getUser(token);
    if (user) buyerId = user.id;
  }

  // Enrich items with commission_rate snapshot from listings
  const listingIds = body.items.map((i) => i.id);
  const { data: listings } = await supabase
    .from("listings")
    .select("id, seller_id, commission_rate")
    .in("id", listingIds);
  const lookup = new Map<string, { seller_id: string; commission_rate: number | null }>();
  for (const l of listings ?? []) lookup.set(l.id, { seller_id: l.seller_id, commission_rate: l.commission_rate });

  const enrichedItems = body.items.map((i) => {
    const ref = lookup.get(i.id);
    return {
      ...i,
      seller_id: ref?.seller_id ?? i.sellerId ?? null,
      commission_rate: COMMISSION_RATE, // fixed platform commission
    };
  });

  // Generate order number
  const d = new Date();
  const orderNumber = `TRG-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${Math.floor(1000 + Math.random() * 9000)}`;

  // Build delivery info — accepts both old (body.locker) and new (body.deliveryInfo) formats
  const finalDeliveryInfo: Record<string, unknown> =
    body.deliveryInfo
    ?? (body.locker
        ? {
            locker_id: body.locker.id,
            locker_name: body.locker.name,
            locker_address: body.locker.address,
            locker_city: body.locker.city,
          }
        : {});

  // Merge delivery fee breakdown into delivery info
  if (body.deliveryFeeCents !== undefined) {
    finalDeliveryInfo.delivery_fee_cents = body.deliveryFeeCents;
  }
  if (body.deliveryFeesBySeller) {
    finalDeliveryInfo.delivery_fees_by_seller = body.deliveryFeesBySeller;
  }

  // Validate and apply promo code
  let promoDiscountCents = 0;
  let promoCodeApplied: string | null = null;
  if (body.promoCode) {
    const promoResult = await validatePromoCode(
      body.promoCode,
      buyerId,
      body.deliveryFeeCents ?? 0,
      deliveryType,
    );
    if (promoResult.valid && promoResult.discountCents) {
      promoDiscountCents = promoResult.discountCents;
      promoCodeApplied = promoResult.code ?? null;
      finalDeliveryInfo.promo_code = promoCodeApplied;
      finalDeliveryInfo.promo_discount_cents = promoDiscountCents;
    }
  }

  // Adjust total with promo discount
  const finalTotalCents = Math.max(0, body.totalCents - promoDiscountCents);

  // Insert order
  const { data: order, error: insertErr } = await supabase
    .from("orders")
    .insert({
      order_number: orderNumber,
      status: "pending",
      payment_status: "awaiting",
      payment_provider: "paysera",
      payment_session_id: orderNumber, // we use order_number as session id
      buyer_id: buyerId,
      buyer_name: body.contact.name,
      buyer_email: body.contact.email,
      buyer_phone: body.contact.phone,
      delivery_type: deliveryType,
      delivery_info: finalDeliveryInfo,
      items: enrichedItems,
      total_cents: finalTotalCents,
      total_amount: finalTotalCents / 100, // legacy decimal column
      promo_code: promoCodeApplied,
      promo_discount_cents: promoDiscountCents,
      seller_ids: body.sellerIds,
    })
    .select("id, order_number")
    .single();

  if (insertErr || !order) {
    return NextResponse.json({ error: insertErr?.message ?? "Kļūda saglabājot pasūtījumu" }, { status: 500 });
  }

  // Compute base URL
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("host") ?? "tirgus.izipizi.lv";
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? `${proto}://${host}`;

  // Build Paysera redirect URL
  let paymentUrl: string;
  try {
    paymentUrl = buildPayseraRedirectUrl({
      orderNumber: order.order_number,
      amountCents: finalTotalCents,
      buyerEmail: body.contact.email,
      buyerName: body.contact.name,
      buyerPhone: body.contact.phone,
      baseUrl,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Paysera konfigurācijas kļūda" },
      { status: 500 },
    );
  }

  // Promo redemption is recorded in the Paysera webhook after successful payment,
  // not here — so if the user abandons payment, the code remains available.

  return NextResponse.json({ paymentUrl, orderId: order.order_number });
}
