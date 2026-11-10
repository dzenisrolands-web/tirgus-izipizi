import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { hasOrderCapability, userOwnsOrder, verifiedOrderUser } from "@/lib/order-access";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie, Authorization" };

export async function GET(
  req: Request,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  const { orderNumber } = await params;
  if (!/^[A-Za-z0-9-]{1,40}$/.test(orderNumber)) {
    return NextResponse.json({ error: "Nederīgs pasūtījuma numurs" }, { status: 400, headers });
  }

  const supabase = createServerClient();
  const capability = hasOrderCapability(req, orderNumber);
  const user = capability ? null : await verifiedOrderUser(req, supabase);
  const denied = () => NextResponse.json({ error: "Piekļuve pasūtījumam nav apstiprināta. Ielogojies vai sazinies ar atbalstu." }, { status: 403, headers });
  if (!capability && !user) return denied();

  const { data, error } = await supabase
    .from("orders")
    .select("id, order_number, status, payment_status, buyer_id, buyer_name, buyer_email, delivery_type, delivery_info, items, total_cents")
    .eq("order_number", orderNumber)
    .single();

  if (error && error.code !== "PGRST116") return NextResponse.json({ error: "Neizdevās ielādēt pasūtījumu" }, { status: 503, headers });
  if (!data || (!capability && !userOwnsOrder(user, data))) return denied();

  const visible = { ...data };
  delete visible.buyer_id;
  return NextResponse.json(visible, { headers });
}
