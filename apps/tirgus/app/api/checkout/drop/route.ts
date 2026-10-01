import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildPayseraRedirectUrl } from "@/lib/paysera";
import { lockers } from "@/lib/mock-data";

/**
 * Reserve a drop and start Paysera checkout in one shot.
 *
 * Body: { dropId, quantity }
 * Auth: required (Authorization: Bearer <user token>)
 *
 * Flow:
 *   1. Verify user
 *   2. Reserve drop atomically via RPC (decrements available qty)
 *   3. Create order with drop reference
 *   4. Build Paysera URL
 *   5. Return { paymentUrl, orderId }
 */
export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { dropId, quantity } = body;
  if (!dropId || !quantity || quantity < 1) {
    return NextResponse.json({ error: "Missing dropId or quantity" }, { status: 400 });
  }

  // Fetch drop
  const { data: drop, error: dropErr } = await supabase
    .from("hot_drops")
    .select("id, title, unit, price_cents, total_quantity, reserved_quantity, sold_quantity, pickup_locker_id, seller_id, status, expires_at")
    .eq("id", dropId)
    .single();

  if (dropErr || !drop) return NextResponse.json({ error: "Drop not found" }, { status: 404 });
  if (drop.status !== "active") return NextResponse.json({ error: "Drop is not active" }, { status: 400 });
  if (new Date(drop.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "Drop expired" }, { status: 400 });
  }

  const avail = Math.max(0, drop.total_quantity - drop.reserved_quantity - drop.sold_quantity);
  if (avail < quantity) {
    return NextResponse.json({ error: `Pieejami tikai ${avail} no ${quantity}` }, { status: 400 });
  }

  // Reserve via RPC (atomic)
  const { data: reservation, error: rpcErr } = await supabase.rpc("reserve_hot_drop", {
    p_drop_id: dropId,
    p_buyer_id: user.id,
    p_quantity: quantity,
    p_delivery_locker_id: drop.pickup_locker_id,
  });
  if (rpcErr || !reservation) {
    return NextResponse.json({ error: rpcErr?.message ?? "Rezervācija neizdevās" }, { status: 500 });
  }

  // Get user profile for contact info
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  const buyerName = profile?.full_name ?? user.email?.split("@")[0] ?? "Pircējs";
  const buyerEmail = user.email ?? "";
  const buyerPhone = (user.phone as string | undefined) ?? "";

  const totalCents = drop.price_cents * quantity;
  const locker = lockers.find((l) => l.id === drop.pickup_locker_id);

  // Generate order number
  const d = new Date();
  const orderNumber = `KER-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${Math.floor(1000 + Math.random() * 9000)}`;

  // Insert order
  const { data: order, error: insertErr } = await supabase
    .from("orders")
    .insert({
      order_number: orderNumber,
      status: "pending",
      payment_status: "awaiting",
      payment_provider: "paysera",
      payment_session_id: orderNumber,
      buyer_id: user.id,
      buyer_name: buyerName,
      buyer_email: buyerEmail,
      buyer_phone: buyerPhone,
      delivery_type: "locker",
      delivery_info: locker
        ? {
            locker_id: locker.id,
            locker_name: locker.name,
            locker_address: locker.address,
            locker_city: locker.city,
          }
        : { locker_id: drop.pickup_locker_id },
      items: [
        {
          id: drop.id,
          drop_id: drop.id,
          reservation_id: (reservation as { id?: string }).id ?? null,
          title: drop.title,
          price: drop.price_cents / 100,
          quantity,
          unit: drop.unit,
          sellerName: "",
          seller_id: drop.seller_id,
        },
      ],
      total_cents: totalCents,
      total_amount: totalCents / 100, // legacy decimal column
      seller_ids: [drop.seller_id],
    })
    .select("id, order_number")
    .single();

  if (insertErr || !order) {
    return NextResponse.json({ error: insertErr?.message ?? "Pasūtījums neizdevās" }, { status: 500 });
  }

  // Build Paysera URL
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("host") ?? "tirgus.izipizi.lv";
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? `${proto}://${host}`;

  let paymentUrl: string;
  try {
    paymentUrl = buildPayseraRedirectUrl({
      orderNumber: order.order_number,
      amountCents: totalCents,
      buyerEmail,
      buyerName,
      buyerPhone,
      baseUrl,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Paysera kļūda" },
      { status: 500 },
    );
  }

  return NextResponse.json({ paymentUrl, orderId: order.order_number });
}
