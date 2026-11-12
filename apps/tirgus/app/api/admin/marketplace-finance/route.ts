import { NextResponse } from "next/server";
import { assertSuperAdmin } from "@/lib/admin-auth";
import { marketplaceLifecycleEnabled } from "@/lib/marketplace-lifecycle";
const headers = { "Cache-Control": "private, no-store" };
const uuid = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
export async function POST(req: Request) {
  const ctx = await assertSuperAdmin(req);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status, headers });
  if (!marketplaceLifecycleEnabled()) return NextResponse.json({ error: "Lifecycle not enabled" }, { status: 503, headers });
  if (Number(req.headers.get("content-length")) > 12000) return NextResponse.json({ error: "Body too large" }, { status: 413, headers });
  const body = await req.json().catch(() => null);
  if (!body || !uuid(body.orderId) || body.confirmAlreadyRefunded !== true
    || !Number.isSafeInteger(body.amountCents) || body.amountCents <= 0
    || typeof body.providerReference !== "string" || body.providerReference.trim().length < 3 || body.providerReference.length > 200
    || typeof body.evidence !== "string" || body.evidence.trim().length < 10 || body.evidence.length > 4000
    || typeof body.refundedAt !== "string" || !Number.isFinite(Date.parse(body.refundedAt))) {
    return NextResponse.json({ error: "Exact external refund evidence required" }, { status: 400, headers });
  }
  const { data, error } = await ctx.supabase.rpc("marketplace_record_refund_v1", {
    p_order_id: body.orderId, p_actor_id: ctx.user.id, p_amount_cents: body.amountCents,
    p_reference: body.providerReference.trim(), p_evidence: body.evidence.trim(), p_refunded_at: body.refundedAt,
  });
  if (error || typeof data !== "boolean") return NextResponse.json({ error: "Refund evidence requires reconciliation" }, { status: 409, headers });
  return NextResponse.json({ ok: true, recorded: data, bankTransferInitiated: false }, { headers });
}
