import { NextResponse } from "next/server";
import { generateInvoicesForPeriod } from "@/lib/invoice/generate";
import { previousPeriod } from "@/lib/invoice/period";

/**
 * Vercel cron — runs on 1st and 16th of every month at 03:00 UTC
 * (configured in vercel.json). Generates invoices for the period that
 * just completed.
 *
 * Manual trigger: GET with Authorization: Bearer ${CRON_SECRET}
 *   curl -H "Authorization: Bearer XXX" https://tirgus.izipizi.lv/api/cron/generate-invoices
 *
 * Optional ?period=2026-04-1 forces a specific half-month period.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace("Bearer ", "");
  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const period = previousPeriod(new Date());

  try {
    const result = await generateInvoicesForPeriod(period);
    return NextResponse.json({
      ok: true,
      period: period.label,
      ...result,
    });
  } catch (err) {
    console.error("[cron/generate-invoices] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}
