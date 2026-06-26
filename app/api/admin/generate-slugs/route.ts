import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { slugify } from "@/lib/slugify";

/**
 * POST /api/admin/generate-slugs
 * Generates URL slugs for all sellers that don't have one yet.
 * Also creates the `referral_clicks` table if missing.
 * Requires admin auth (Bearer token).
 */
export async function POST(req: Request) {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  );

  // Auth check — only admins
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (token) {
    const { data: { user } } = await sb.auth.getUser(token);
    if (!user) return NextResponse.json({ ok: false, error: "Nav autorizācijas" }, { status: 401 });
  } else {
    return NextResponse.json({ ok: false, error: "Nav autorizācijas" }, { status: 401 });
  }

  // Ensure referral_clicks table exists (best-effort — exec_sql may not exist)
  try {
    await sb.rpc("exec_sql", {
      query: `
        CREATE TABLE IF NOT EXISTS referral_clicks (
          id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
          seller_id text NOT NULL,
          slug text NOT NULL,
          referrer text,
          ua text,
          created_at timestamptz DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS idx_referral_clicks_seller ON referral_clicks(seller_id);
        CREATE INDEX IF NOT EXISTS idx_referral_clicks_created ON referral_clicks(created_at);
      `,
    });
  } catch {
    // rpc exec_sql might not exist — table may need manual creation via SQL editor
  }

  // Fetch all sellers
  const { data: sellers, error } = await sb
    .from("sellers")
    .select("id, name, slug");

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // Collect existing slugs to avoid collisions
  const existingSlugs = new Set(
    (sellers ?? []).filter(s => s.slug).map(s => s.slug as string)
  );

  const updated: { id: string; name: string; slug: string }[] = [];

  for (const seller of sellers ?? []) {
    if (seller.slug) continue; // Already has slug

    let base = slugify(seller.name || "seller");
    let candidate = base;
    let counter = 2;
    while (existingSlugs.has(candidate)) {
      candidate = `${base}-${counter}`;
      counter++;
    }

    const { error: updateErr } = await sb
      .from("sellers")
      .update({ slug: candidate })
      .eq("id", seller.id);

    if (!updateErr) {
      existingSlugs.add(candidate);
      updated.push({ id: seller.id, name: seller.name, slug: candidate });
    }
  }

  return NextResponse.json({
    ok: true,
    total: sellers?.length ?? 0,
    alreadyHadSlug: (sellers?.length ?? 0) - updated.length,
    generated: updated.length,
    slugs: updated,
  });
}
