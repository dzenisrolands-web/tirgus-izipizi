import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildPayseraRedirectUrl } from "@/lib/paysera";
import { canReadOrder, hasGuestOrderAccess } from "@/lib/order-access";

export async function POST(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );

  let body: { orderNumber: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Nederīgs request" }, { status: 400 });
  }

  if (!body.orderNumber) {
    return NextResponse.json({ error: "Trūkst orderNumber" }, { status: 400 });
  }
  if (!hasGuestOrderAccess(req, body.orderNumber) && !req.headers.get("authorization")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch the order
  const { data: order } = await supabase
    .from("orders")
    .select("order_number, buyer_id, total_cents, buyer_email, buyer_name, buyer_phone, status, payment_status")
    .eq("order_number", body.orderNumber)
    .single();

  if (!order) {
    return NextResponse.json({ error: "Pasūtījums nav atrasts" }, { status: 404 });
  }

  // Verify it belongs to this user
  if (!await canReadOrder(req, supabase, order)) {
    return NextResponse.json({ error: "Nav atļauts" }, { status: 403 });
  }

  if (order.status !== "pending" || order.payment_status !== "awaiting") {
    return NextResponse.json({ error: "Pasūtījums jau apmaksāts" }, { status: 400 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tirgus.izipizi.lv";

  let paymentUrl: string;
  try {
    paymentUrl = buildPayseraRedirectUrl({
      orderNumber: order.order_number,
      amountCents: order.total_cents,
      buyerEmail: order.buyer_email,
      buyerName: order.buyer_name,
      buyerPhone: order.buyer_phone ?? undefined,
      baseUrl,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Paysera kļūda" },
      { status: 500 },
    );
  }

  return NextResponse.json({ paymentUrl });
}
