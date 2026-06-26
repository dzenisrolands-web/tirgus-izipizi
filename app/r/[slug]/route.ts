import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /r/[slug]
 * Referral redirect — looks up seller by slug, 302 → /seller/[id] with UTM.
 * Example: /r/bujums → /seller/s7?utm_source=razotajs&utm_medium=story&utm_campaign=starter
 *
 * Extra query params (?locker=agenskalns) are forwarded as-is.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  if (!slug) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  );

  // Lookup seller by slug
  const { data: seller } = await sb
    .from("sellers")
    .select("id")
    .eq("slug", slug)
    .single();

  if (!seller) {
    // Slug not found — try as seller ID fallback
    const { data: byId } = await sb
      .from("sellers")
      .select("id")
      .eq("id", slug)
      .single();

    if (!byId) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    // Found by ID — redirect with UTM
    return buildRedirect(req, byId.id);
  }

  // Log referral click (fire-and-forget)
  try {
    await sb.from("referral_clicks").insert({
      seller_id: seller.id,
      slug,
      referrer: req.headers.get("referer") || null,
      ua: req.headers.get("user-agent") || null,
    });
  } catch {
    // Non-blocking — don't fail the redirect
  }

  return buildRedirect(req, seller.id);
}

function buildRedirect(req: Request, sellerId: string): NextResponse {
  const incoming = new URL(req.url);
  const dest = new URL(`/seller/${sellerId}`, incoming.origin);

  // Default UTM params (can be overridden by query string)
  const defaults: Record<string, string> = {
    utm_source: "razotajs",
    utm_medium: "story",
    utm_campaign: "starter",
  };

  // Apply defaults first, then overlay any incoming params
  for (const [k, v] of Object.entries(defaults)) {
    if (!incoming.searchParams.has(k)) {
      dest.searchParams.set(k, v);
    }
  }
  // Forward all other query params (locker, custom utm_, etc.)
  for (const [k, v] of incoming.searchParams.entries()) {
    dest.searchParams.set(k, v);
  }

  return NextResponse.redirect(dest, 302);
}
