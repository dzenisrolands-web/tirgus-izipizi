import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { validatePromoCode } from "@/lib/promo";

/**
 * POST /api/promo/validate
 * Validates a promo code and returns the discount amount.
 */
export async function POST(req: Request) {
  try {
    const { code, deliveryFeeCents, deliveryType } = (await req.json()) as {
      code: string;
      deliveryFeeCents: number;
      deliveryType?: string;
    };

    // Get user from auth header
    let userId: string | null = null;
    const auth = req.headers.get("authorization") ?? "";
    const token = auth.replace("Bearer ", "");
    if (token) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SECRET_KEY!,
      );
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) userId = user.id;
    }

    const result = await validatePromoCode(code, userId, deliveryFeeCents ?? 0, deliveryType ?? "locker");
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ valid: false, reason: "Kļūda" }, { status: 500 });
  }
}
