import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/track-address
 *
 * Logs every address lookup a buyer makes — even without purchase.
 * Used for demand analytics: where are potential customers looking?
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { postal_code, city, address, zone, outside_zones } = body as {
      postal_code?: string;
      city?: string;
      address?: string;
      zone?: number | null;
      outside_zones?: boolean;
    };

    if (!postal_code && !city && !address) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!,
    );

    await supabase.from("delivery_lookups").insert({
      postal_code: postal_code ?? null,
      city: city ?? null,
      address: address ?? null,
      zone: zone ?? null,
      outside_zones: outside_zones ?? false,
    });

    return NextResponse.json({ ok: true });
  } catch {
    // Fire-and-forget — never block the user
    return NextResponse.json({ ok: true });
  }
}
