import { NextResponse } from "next/server";
import { assertSuperAdmin } from "@/lib/admin-auth";
import { slugify } from "@/lib/slugify";

/**
 * POST /api/admin/generate-slugs
 * Generates URL slugs for all sellers that don't have one yet.
 * Requires admin auth (Bearer token).
 */
export async function POST(req: Request) {
  const auth = await assertSuperAdmin(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const sb = auth.supabase;

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

    const base = slugify(seller.name || "seller");
    let candidate = base;
    let counter = 2;
    while (existingSlugs.has(candidate)) {
      candidate = `${base}-${counter}`;
      counter++;
    }

    const { data: changed, error: updateErr } = await sb
      .from("sellers")
      .update({ slug: candidate })
      .eq("id", seller.id).select("id").maybeSingle();

    if (updateErr) return NextResponse.json({ ok: false, error: "Slug update failed", generated: updated.length }, { status: 500 });
    if (!changed) return NextResponse.json({ ok: false, error: "Seller changed; reload and retry", generated: updated.length }, { status: 409 });
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
