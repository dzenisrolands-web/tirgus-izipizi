import { NextResponse } from "next/server";

/** A browser redirect is not proof of payment. Only verified provider callbacks settle orders. */
export async function POST() {
  return NextResponse.json(
    { ok: false, error: "Payment confirmation requires a verified Paysera callback" },
    { status: 410 },
  );
}
