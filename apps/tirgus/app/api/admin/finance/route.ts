import { NextResponse } from "next/server";
import { assertSuperAdmin } from "@/lib/admin-auth";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text = (v: unknown, min: number) => typeof v === "string" && v.trim().length >= min && v.length <= 4000;

export async function GET(req: Request) {
  const ctx = await assertSuperAdmin(req);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const page = Number(new URL(req.url).searchParams.get("page") ?? 0);
  if (!Number.isSafeInteger(page) || page < 0 || page > 100000) return NextResponse.json({ error: "Invalid page" }, { status: 400 });
  const from = page * 100;
  const [issues, queue, events] = await Promise.all([
    ctx.supabase.rpc("finance_issues", {}, { get: true }).order("entity_type").order("entity_id").order("issue").range(from, from + 99),
    ctx.supabase.from("finance_refund_queue").select("*").order("created_at", { ascending: false }).order("id").range(from, from + 99),
    ctx.supabase.from("finance_review_events").select("*").order("created_at", { ascending: false }).order("id").range(from, from + 99),
  ]);
  if (issues.error || queue.error || events.error) {
    return NextResponse.json({ error: "Finance schema unavailable; apply migration 0045 after 0044" }, { status: 503 });
  }
  return NextResponse.json({ issues: issues.data, queue: queue.data, events: events.data, limit: 100, page,
    notice: "Read-only findings. Recording a review does not repair snapshots or authorize invoicing." });
}

export async function POST(req: Request) {
  const ctx = await assertSuperAdmin(req);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const body = await req.json().catch(() => null);
  if (!body || !UUID.test(body.entityId ?? "") || !text(body.reason, 10) || !text(body.evidence, 10) || !text(body.reference, 3)) {
    return NextResponse.json({ error: "A valid entity ID, reason, evidence and reference are required" }, { status: 400 });
  }
  const base = { p_actor_id: ctx.user.id, p_reason: body.reason.trim(), p_evidence: body.evidence.trim() };
  let result;
  if (body.action === "review" && ["order", "invoice", "refund"].includes(body.entityType)) {
    result = await ctx.supabase.rpc("record_finance_review", {
      ...base, p_entity_type: body.entityType, p_entity_id: body.entityId, p_reference: body.reference.trim(),
    });
  } else if (body.action === "enqueue") {
    result = await ctx.supabase.rpc("enqueue_manual_refund", {
      ...base, p_order_id: body.entityId, p_reference: body.reference.trim(),
    });
  } else if (body.action === "complete") {
    const time = typeof body.externallyRefundedAt === "string" ? Date.parse(body.externallyRefundedAt) : NaN;
    if (body.verifiedExternal !== true || !Number.isSafeInteger(body.amountCents) || body.amountCents <= 0 ||
        !Number.isFinite(time) || time > Date.now()) {
      return NextResponse.json({ error: "Confirm an already executed external refund, exact cents and past timestamp" }, { status: 400 });
    }
    result = await ctx.supabase.rpc("complete_manual_refund", {
      ...base, p_order_id: body.entityId, p_amount_cents: body.amountCents,
      p_provider_reference: body.reference.trim(), p_verified_external: true,
      p_externally_refunded_at: new Date(time).toISOString(),
    });
  } else {
    return NextResponse.json({ error: "Unsupported finance action" }, { status: 400 });
  }
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 409 });
  return NextResponse.json({ ok: true, result: result.data });
}
