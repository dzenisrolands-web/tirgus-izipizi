import { NextResponse } from "next/server";

/** A browser return URL is not proof of payment. Only signed callbacks may pay orders. */
export async function POST() {
  return NextResponse.json(
    { ok: false, error: "Payment confirmation requires the signed provider callback" },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}
