import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildPayseraRedirectUrl, trustedPaymentBaseUrl } from "@/lib/paysera";
import { hasOrderCapability, userOwnsOrder, verifiedOrderUser } from "@/lib/order-access";

const headers = { "Cache-Control": "private, no-store", Vary: "Cookie, Authorization" };

export async function POST(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );

  let body: { orderNumber: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Nederīgs request" }, { status: 400, headers });
  }

  if (!body || typeof body.orderNumber !== "string" || !/^[A-Za-z0-9-]{1,40}$/.test(body.orderNumber)) {
    return NextResponse.json({ error: "Trūkst orderNumber" }, { status: 400, headers });
  }

  const capability = hasOrderCapability(req, body.orderNumber);
  const user = capability ? null : await verifiedOrderUser(req, supabase);
  const denied = () => NextResponse.json({ error: "Piekļuve pasūtījumam nav apstiprināta" }, { status: 403, headers });
  if (!capability && !user) return denied();

  // Fetch the order
  const { data: order, error } = await supabase
    .from("orders")
    .select("order_number, total_cents, buyer_id, buyer_email, buyer_name, buyer_phone, status, payment_status")
    .eq("order_number", body.orderNumber)
    .single();

  if (error && error.code !== "PGRST116") return NextResponse.json({ error: "Neizdevās ielādēt pasūtījumu" }, { status: 503, headers });
  if (!order || (!capability && !userOwnsOrder(user, order))) return denied();

  if (order.status !== "pending" || !["awaiting", "failed"].includes(order.payment_status)) {
    return NextResponse.json({ error: "Pasūtījums nav gaidošas apmaksas stāvoklī" }, { status: 400, headers });
  }

  let paymentUrl: string;
  try {
    paymentUrl = buildPayseraRedirectUrl({
      orderNumber: order.order_number,
      amountCents: order.total_cents,
      buyerEmail: order.buyer_email,
      buyerName: order.buyer_name,
      buyerPhone: order.buyer_phone ?? undefined,
      baseUrl: trustedPaymentBaseUrl(),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Paysera kļūda" },
      { status: 500, headers },
    );
  }

  return NextResponse.json({ paymentUrl }, { headers });
}
