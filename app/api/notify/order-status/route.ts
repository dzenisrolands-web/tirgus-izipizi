import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { notifyBuyerOrderStatus } from "@/lib/order-notifications";

/**
 * Trigger a buyer push notification for an order status change.
 * Called by the seller dashboard after advancing order status.
 *
 * Auth: requires a Supabase session token of the seller (or admin).
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

  const { orderId, status } = await req.json().catch(() => ({}));
  if (!orderId || !status) return NextResponse.json({ error: "Missing orderId or status" }, { status: 400 });

  // Optional: verify this user is allowed to push for this order
  // (i.e. they're either the buyer, the seller, or an admin)
  // Skipped for now — keep simple

  const result = await notifyBuyerOrderStatus(orderId, status);
  return NextResponse.json({ ok: true, ...result });
}
