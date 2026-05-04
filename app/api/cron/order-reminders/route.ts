import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { notifySellerReminder, notifyOrderAutoCancelled } from "@/lib/order-notifications";

// Vercel Cron — runs every 15 minutes.
// Goal: keep sellers from sleeping on a paid order. Three escalating reminder
// pushes (30 min, 2 h, 6 h after paid_at), then auto-cancel at 24 h.
//
// We don't issue a Paysera refund here — the platform marks status=cancelled
// and an admin handles the refund manually for now (Paysera integration is
// still pending live credentials).

const REMINDER_SLOTS_MIN = [30, 120, 360]; // 30 min, 2 h, 6 h
const AUTO_CANCEL_HOURS = 24;

type PendingOrder = {
  id: string;
  paid_at: string;
  seller_reminded_count: number;
};

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );

  const nowMs = Date.now();
  const cancelCutoffISO = new Date(nowMs - AUTO_CANCEL_HOURS * 3_600_000).toISOString();

  // 1) AUTO-CANCEL: paid orders older than 24 h that the seller never confirmed.
  const { data: stale } = await supabase
    .from("orders")
    .select("id")
    .eq("status", "paid")
    .lte("paid_at", cancelCutoffISO);

  let cancelled = 0;
  for (const o of stale ?? []) {
    const { error } = await supabase
      .from("orders")
      .update({ status: "cancelled", auto_cancelled_at: new Date().toISOString() })
      .eq("id", o.id)
      .eq("status", "paid"); // optimistic guard against races
    if (!error) {
      cancelled++;
      notifyOrderAutoCancelled(o.id).catch((e) =>
        console.error("[cron/reminders] notifyOrderAutoCancelled:", e),
      );
    }
  }

  // 2) ESCALATE: paid orders past their next reminder slot.
  // Pull all candidates (status=paid, paid within last 24 h, fewer than 3 reminders)
  // and decide per-row whether the slot has been crossed.
  const { data: pending } = await supabase
    .from("orders")
    .select("id, paid_at, seller_reminded_count")
    .eq("status", "paid")
    .gt("paid_at", cancelCutoffISO)
    .lt("seller_reminded_count", REMINDER_SLOTS_MIN.length)
    .returns<PendingOrder[]>();

  let reminded = 0;
  for (const o of pending ?? []) {
    if (!o.paid_at) continue;
    const elapsedMin = (nowMs - new Date(o.paid_at).getTime()) / 60_000;
    const nextSlot = REMINDER_SLOTS_MIN[o.seller_reminded_count];
    if (elapsedMin < nextSlot) continue;

    const newCount = o.seller_reminded_count + 1;
    const { error } = await supabase
      .from("orders")
      .update({
        seller_reminded_count: newCount,
        seller_reminded_at: new Date().toISOString(),
      })
      .eq("id", o.id)
      .eq("seller_reminded_count", o.seller_reminded_count); // race-safe
    if (error) continue;

    reminded++;
    notifySellerReminder(o.id, newCount).catch((e) =>
      console.error("[cron/reminders] notifySellerReminder:", e),
    );
  }

  return NextResponse.json({
    ok: true,
    ran_at: new Date().toISOString(),
    cancelled,
    reminded,
  });
}
