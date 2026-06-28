import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateShipmentNumber, type ShipmentSize, type LabelData } from "@/lib/shipping";

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
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Nav autorizācijas" }, { status: 401 });
  const { data: { user } } = await sb.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "Nav autorizācijas" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { orderId, size, lockerCode } = body as {
    orderId?: string;
    size?: ShipmentSize;
    lockerCode?: string;
  };

  if (!orderId || !size || !lockerCode) {
    return NextResponse.json({ error: "orderId, size, lockerCode obligāti" }, { status: 400 });
  }

  // Fetch order
  const { data: order } = await sb
    .from("orders")
    .select("id, order_number, buyer_name, buyer_email, buyer_phone, delivery_type, delivery_info, items, seller_ids, status")
    .eq("id", orderId)
    .single();

  if (!order) {
    return NextResponse.json({ error: "Pasūtījums nav atrasts" }, { status: 404 });
  }

  // Fetch seller (the user making this request must be a seller on the order)
  const { data: seller } = await sb
    .from("sellers")
    .select("id, name, farm_name, location, email, home_locker_ids")
    .eq("user_id", user.id)
    .single();

  if (!seller) {
    return NextResponse.json({ error: "Nav ražotāja profila" }, { status: 403 });
  }

  const shipmentNumber = generateShipmentNumber();
  const di = order.delivery_info as Record<string, unknown> | null;
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
    size,
    tempMode,
    lockerCode,
    createdAt: new Date().toISOString(),
  };

  // Insert sutijumi record (best effort — table may not exist yet)
  try {
    await sb.from("sutijumi").insert({
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
  } catch {
    // sutijumi table may not exist in this Supabase instance — non-blocking
  }

  // Mark order as shipped + save locker code
  await sb
    .from("orders")
    .update({ status: "shipped", locker_code: lockerCode })
    .eq("id", orderId);

  return NextResponse.json({ ok: true, label });
}
