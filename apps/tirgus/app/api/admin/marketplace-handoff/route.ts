import { NextResponse } from "next/server";
import { assertSuperAdmin } from "@/lib/admin-auth";
import { marketplaceLifecycleEnabled } from "@/lib/marketplace-lifecycle";
const headers = { "Cache-Control": "private, no-store" };
export async function POST(req: Request) {
  const ctx = await assertSuperAdmin(req);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status, headers });
  if (!marketplaceLifecycleEnabled()) return NextResponse.json({ error: "Lifecycle not enabled" }, { status: 503, headers });
  const body = await req.json().catch(() => null);
  if (!body || typeof body.orderId !== "string" || !/^[a-f0-9-]{36}$/i.test(body.orderId)) {
    return NextResponse.json({ error: "Invalid order identity" }, { status: 400, headers });
  }
  const { data, error } = await ctx.supabase.rpc("marketplace_prepare_handoff_v1", { p_order_id: body.orderId, p_actor_id: ctx.user.id });
  if (error || !data) return NextResponse.json({ error: "Handoff requires review" }, { status: 409, headers });
  return NextResponse.json({ ok: true, ...data, receiverConnected: false }, { headers });
}
