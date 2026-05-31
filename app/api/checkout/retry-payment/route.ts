import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildPayseraRedirectUrl } from "@/lib/paysera";

export async function POST(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );

  // Verify auth
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Nav autorizācijas" }, { status: 401 });
  }

  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) {
    return NextResponse.json({ error: "Nav autorizācijas" }, { status: 401 });
  }

  let body: { orderNumber: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Nederīgs request" }, { status: 400 });
  }

  if (!body.orderNumber) {
    return NextResponse.json({ error: "Trūkst orderNumber" }, { status: 400 });
  }

  // Fetch the order
  const { data: order } = await supabase
    .from("orders")
    .select("order_number, total_cents, buyer_email, buyer_name, buyer_phone, status")
    .eq("order_number", body.orderNumber)
    .single();

  if (!order) {
    return NextResponse.json({ error: "Pasūtījums nav atrasts" }, { status: 404 });
  }

  // Verify it belongs to this user
  if (order.buyer_email !== user.email) {
    return NextResponse.json({ error: "Nav atļauts" }, { status: 403 });
  }

  if (order.status !== "pending") {
    return NextResponse.json({ error: "Pasūtījums jau apmaksāts" }, { status: 400 });
  }

  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("host") ?? "tirgus.izipizi.lv";
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? `${proto}://${host}`;

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
