import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { canReadOrder, hasGuestOrderAccess } from "@/lib/order-access";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  const { orderNumber } = await params;
  if (!orderNumber) {
    return NextResponse.json({ error: "Nav pasūtījuma numura" }, { status: 400 });
  }

  if (!hasGuestOrderAccess(req, orderNumber) && !req.headers.get("authorization")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, buyer_id, order_number, status, payment_status, buyer_name, buyer_email, delivery_type, delivery_info, items, total_cents")
    .eq("order_number", orderNumber)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Nav atrasts" }, { status: 404 });
  }

  if (!await canReadOrder(req, supabase, data)) return NextResponse.json({ error: "Nav atrasts" }, { status: 404 });
  return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
}
