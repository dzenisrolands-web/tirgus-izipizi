import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  const { orderNumber } = await params;
  if (!orderNumber) {
    return NextResponse.json({ error: "Nav pasūtījuma numura" }, { status: 400 });
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, order_number, status, payment_status, buyer_name, buyer_email, delivery_type, delivery_info, items, total_cents")
    .eq("order_number", orderNumber)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Nav atrasts" }, { status: 404 });
  }

  return NextResponse.json(data);
}
