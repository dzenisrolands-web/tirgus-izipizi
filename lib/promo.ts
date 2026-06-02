/**
 * Promo code validation and redemption logic.
 * Server-side only — uses SUPABASE_SECRET_KEY.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function svc(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );
}

export type PromoResult = {
  valid: boolean;
  code?: string;
  type?: "free_delivery" | "percent" | "fixed";
  discountCents?: number;
  reason?: string;
};

/**
 * Validate a promo code.
 * @param code - The promo code string (case-insensitive)
 * @param userId - The authenticated user ID (null for guests)
 * @param deliveryFeeCents - Current delivery fee in cents (for free_delivery type)
 */
export async function validatePromoCode(
  code: string,
  userId: string | null,
  deliveryFeeCents: number,
  deliveryType: string = "locker",
): Promise<PromoResult> {
  const supabase = svc();
  const normalized = code.trim().toUpperCase();

  if (!normalized) return { valid: false, reason: "Ievadi promo kodu" };

  // 1. Look up code
  const { data: promo } = await supabase
    .from("promo_codes")
    .select("*")
    .eq("code", normalized)
    .eq("active", true)
    .maybeSingle();

  if (!promo) return { valid: false, reason: "Kods nav atrasts vai nav aktīvs" };

  // 2. Check expiry
  if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
    return { valid: false, reason: "Koda derīguma termiņš ir beidzies" };
  }

  // 3. Check max uses (0 = unlimited)
  if (promo.max_uses > 0 && promo.used_count >= promo.max_uses) {
    return { valid: false, reason: "Kods ir izlietots" };
  }

  // 4. Check if user already used this code
  if (userId) {
    const { data: existing } = await supabase
      .from("promo_redemptions")
      .select("id")
      .eq("code", normalized)
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) {
      return { valid: false, reason: "Tu jau esi izmantojis šo kodu" };
    }
  }

  // 5. PIRMAIS works only with locker delivery
  if (normalized === "PIRMAIS" && deliveryType !== "locker") {
    return { valid: false, reason: "Kods PIRMAIS darbojas tikai ar pakomātu piegādi" };
  }

  // 6. Calculate discount
  let discountCents = 0;
  if (promo.type === "free_delivery") {
    discountCents = deliveryFeeCents; // full delivery fee waived
  } else if (promo.type === "fixed") {
    discountCents = promo.discount_cents;
  } else if (promo.type === "percent") {
    // percent discount on delivery fee
    discountCents = Math.round(deliveryFeeCents * promo.discount_percent / 100);
  }

  return {
    valid: true,
    code: normalized,
    type: promo.type,
    discountCents,
  };
}

/**
 * Record a promo code redemption after successful payment.
 */
export async function redeemPromoCode(
  code: string,
  userId: string | null,
  orderId: string,
  orderNumber: string,
  discountCents: number,
): Promise<void> {
  const supabase = svc();
  const normalized = code.trim().toUpperCase();

  // Get code ID
  const { data: promo } = await supabase
    .from("promo_codes")
    .select("id")
    .eq("code", normalized)
    .single();

  if (!promo) return;

  // Insert redemption
  await supabase.from("promo_redemptions").insert({
    code_id: promo.id,
    code: normalized,
    user_id: userId,
    order_id: orderId,
    order_number: orderNumber,
    discount_cents: discountCents,
  });

  // Increment used_count
  const { error: rpcErr } = await supabase.rpc("increment_promo_used_count", { promo_id: promo.id });
  if (rpcErr) {
    // Fallback: direct update if RPC doesn't exist
    await supabase
      .from("promo_codes")
      .update({ used_count: (promo as Record<string, unknown>).used_count as number + 1 })
      .eq("id", promo.id);
  }

  // Decrement user's free_delivery_credits if applicable
  if (userId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("free_delivery_credits")
      .eq("id", userId)
      .single();
    if (profile && profile.free_delivery_credits > 0) {
      await supabase
        .from("profiles")
        .update({ free_delivery_credits: profile.free_delivery_credits - 1 })
        .eq("id", userId);
    }
  }
}
