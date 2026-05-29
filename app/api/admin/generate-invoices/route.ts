import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabase as anonClient } from "@/lib/supabase";
import { generateInvoicesForPeriod } from "@/lib/invoice/generate";
import { previousPeriod, periodForDate } from "@/lib/invoice/period";

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );
}

async function isAdmin(req: Request): Promise<boolean> {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return false;
  const { data: { user } } = await anonClient.auth.getUser(token);
  if (!user) return false;
  const { data: profile } = await svc()
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return profile?.role === "super_admin";
}

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
  if (!await isAdmin(req)) {
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
