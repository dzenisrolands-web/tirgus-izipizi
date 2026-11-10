import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateShipmentNumber, type ShipmentSize, type LabelData } from "@/lib/shipping";
import { isClosedLockerId } from "@/lib/locker-policy";
import { bearerToken, orderSellerIds } from "@/lib/security-api";

/**
 * POST /api/shipments/create-from-order
 * Body: { orderId: string, size: "M"|"L"|"XL", lockerCode: string }
 *
 * Creates a sutijumi record from a marketplace order and returns label data.
 * Also marks the order as "shipped".
 */
export async function POST(req: Request) {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );

  // Auth
  const token = bearerToken(req);
  if (!token) return NextResponse.json({ error: "Nav autorizācijas" }, { status: 401 });
  const { data: { user }, error: authError } = await sb.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Nav autorizācijas" }, { status: 401 });

  const body = (await req.json().catch(() => null)) ?? {};
  const { orderId, size, lockerCode, sellerId } = body as {
    orderId?: string;
    size?: ShipmentSize;
    lockerCode?: string;
    sellerId?: string;
  };

  if (typeof orderId !== "string" || !orderId.trim() || !["M", "L", "XL"].includes(size ?? "") ||
      typeof lockerCode !== "string" || !/^[A-Za-z0-9-]{4,32}$/.test(lockerCode)) {
    return NextResponse.json({ error: "orderId, size, lockerCode obligāti" }, { status: 400 });
  }
  // Fetch order
  const { data: order, error: orderError } = await sb
    .from("orders")
    .select("id, order_number, buyer_name, buyer_email, buyer_phone, delivery_type, delivery_info, items, seller_ids, status, payment_status")
    .eq("id", orderId)
    .single();

  if (orderError) return NextResponse.json({ error: "Order query failed" }, { status: 500 });
  if (!order) {
    return NextResponse.json({ error: "Pasūtījums nav atrasts" }, { status: 404 });
  }

  // Fetch seller (the user making this request must be a seller on the order)
  const isAdmin = user.app_metadata?.is_super_admin === true;
  const sellerIds = orderSellerIds(order);
  if (isAdmin && (typeof sellerId !== "string" || !sellerIds.includes(sellerId))) {
    return NextResponse.json({ error: "Admin must select a seller on the order" }, { status: 400 });
  }
  let sellerQuery = sb
    .from("sellers")
    .select("id, name, farm_name, location, email, home_locker_ids");
  sellerQuery = isAdmin ? sellerQuery.eq("id", sellerId!) : sellerQuery.eq("user_id", user.id);
  const { data: seller, error: sellerError } = await sellerQuery.single();

  if (sellerError) return NextResponse.json({ error: "Seller query failed" }, { status: 500 });
  if (!seller || !sellerIds.includes(seller.id)) {
    return NextResponse.json({ error: "Nav ražotāja profila" }, { status: 403 });
  }
  if (!isAdmin && sellerIds.length !== 1) {
    return NextResponse.json({ error: "Multi-seller fulfillment requires admin coordination" }, { status: 409 });
  }
  if (order.payment_status !== "paid" || order.status !== "processing") {
    return NextResponse.json({ error: "Order must be paid and processing" }, { status: 409 });
  }

  const shipmentNumber = generateShipmentNumber();
  const di = order.delivery_info as Record<string, unknown> | null;
  if (isClosedLockerId(di?.locker_id) || isClosedLockerId((seller.home_locker_ids as string[] | null)?.[0])) {
    return NextResponse.json({ error: "Tukuma pakomāts ir slēgts. Sazinies ar administratoru par citu nodošanas/saņemšanas vietu." }, { status: 409 });
  }
  const isLocker = order.delivery_type === "locker" || !!di?.locker_id;

  // Determine temp mode from size
  const tempMode = size === "L" ? "−18 °C" : "+2…+6 °C";

  // Resolve seller's home locker (FROM locker)
  const LOCKERS: Record<string, { name: string; address: string; city: string }> = {
    brivibas:   { name: "Brīvības 253",       address: "Brīvības iela 253 / NESTE", city: "Rīga" },
    agenskalna: { name: "Āgenskalna tirgus",  address: "Nometņu iela 64 / Tirgus",  city: "Rīga" },
    salaspils:  { name: "Salaspils",          address: "Zviedru iela 1C / NESTE",   city: "Salaspils" },
    ikskile:    { name: "Ikšķile",            address: "Daugavas iela 63",          city: "Ikšķile" },
    tukums:     { name: "Tukuma tirgus",      address: "J. Raiņa iela 30",         city: "Tukums" },
    dundaga:    { name: "Dundagas tirgus",    address: "Pils 3B",                   city: "Dundaga" },
    iukstes:    { name: "Ilūkstes iela 40A",  address: "Ilūkstes iela 40A",         city: "Rīga" },
    sigulda:    { name: "Sigulda",            address: "Rūdolfa Blaumaņa iela 2",   city: "Sigulda" },
  };
  const fromLockerId = (seller.home_locker_ids as string[] | null)?.[0];
  const fromLocker = fromLockerId ? LOCKERS[fromLockerId] : null;

  // Build label data
  const label: LabelData = {
    shipmentNumber,
    orderNumber: order.order_number,
    senderName: seller.farm_name ?? seller.name,
    senderPhone: seller.email ?? "",
    senderAddress: seller.location ?? "",
    recipientName: order.buyer_name ?? "",
    recipientPhone: order.buyer_phone ?? "",
    deliveryType: isLocker ? "locker" : "courier",
    fromLockerName: fromLocker?.name,
    fromLockerAddress: fromLocker?.address,
    fromLockerCity: fromLocker?.city,
    toLockerName: di?.locker_name as string | undefined,
    toLockerAddress: di?.locker_address as string | undefined,
    toLockerCity: di?.locker_city as string | undefined,
    courierAddress: di?.address as string | undefined,
    courierCity: di?.city as string | undefined,
    size: size!,
    tempMode,
    lockerCode,
    createdAt: new Date().toISOString(),
  };

  // Confirm the guarded order write before returning a label or recording logistics.
  const { data: updated, error: updateError } = await sb.from("orders")
    .update({ status: "shipped", locker_code: lockerCode })
    .eq("id", orderId).eq("status", "processing").eq("payment_status", "paid")
    .select("id").maybeSingle();
  if (updateError) return NextResponse.json({ error: "Order update failed" }, { status: 500 });
  if (!updated) return NextResponse.json({ error: "Order changed; reload before retrying" }, { status: 409 });

  // Optional existing logistics table: its absence must not block legacy labels.
  let logisticsRecorded = false;
  try {
    const { error } = await sb.from("sutijumi").insert({
      delivery_type: label.deliveryType,
      from_locker: null,
      from_locker_name: label.senderAddress,
      to_locker: di?.locker_id as string | null,
      to_locker_name: label.toLockerName ?? label.courierAddress ?? "",
      same_locker: false,
      courier_address: label.courierAddress ?? null,
      courier_zip: null,
      size,
      temp_mode: tempMode,
      sender_name: label.senderName,
      sender_phone: label.senderPhone,
      sender_email: seller.email,
      recipient_name: label.recipientName,
      recipient_phone: label.recipientPhone,
      note: `${order.order_number} - ${label.senderName}`,
      status: "confirmed",
    });
    logisticsRecorded = !error;
  } catch {
    // sutijumi table may not exist in this Supabase instance — non-blocking
  }
  if (!logisticsRecorded) console.warn("[shipments] Optional logistics record unavailable");
  return NextResponse.json({ ok: true, label, logisticsRecorded });
}
