import { NextResponse } from "next/server";
import { generateInvoicesForPeriod } from "@/lib/invoice/generate";
import { previousPeriod, periodForDate } from "@/lib/invoice/period";
import { isSuperAdmin } from "@/lib/admin-auth";

/**
 * POST /api/admin/generate-invoices
 *
 * Triggers invoice generation for the most recently completed period,
 * or for a specific period when ?period=YYYY-MM-DD is passed.
 *
 * Requires a valid super_admin session (Authorization: Bearer <access_token>).
 * Does NOT require CRON_SECRET — intended for manual admin use.
 */
export async function POST(req: Request) {
  if (!await isSuperAdmin(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const periodParam = url.searchParams.get("period");

  let period;
  if (periodParam) {
    const d = new Date(periodParam);
    if (isNaN(d.getTime())) {
      return NextResponse.json({ error: "invalid period date" }, { status: 400 });
    }
    period = periodForDate(d);
  } else {
    period = previousPeriod(new Date());
  }

  try {
    const result = await generateInvoicesForPeriod(period);
    return NextResponse.json({
      ok: true,
      period: period.label,
      periodStart: period.start.toISOString().split("T")[0],
      periodEnd: period.end.toISOString().split("T")[0],
      ...result,
    });
  } catch (err) {
    console.error("[admin/generate-invoices] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}
