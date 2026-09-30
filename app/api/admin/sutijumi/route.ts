import { NextResponse } from "next/server";
import { assertSuperAdmin } from "@/lib/admin-auth";

/**
 * GET /api/admin/sutijumi — list all shipments
 * POST /api/admin/sutijumi — update status
 *
 * `sutijumi` atrodas tajā pašā Supabase projektā kā pārējā lietotne. Agrāk šeit
 * bija atsevišķs klients ar anon atslēgu, kas prasīja plašu SELECT politiku anon
 * lomai. Tagad lietojam service-role klientu no assertSuperAdmin, tāpēc tabulu
 * var pilnibā slēgt anonīmai piekļuvei.
 */
export async function GET(req: Request) {
  const ctx = await assertSuperAdmin(req);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const { data, error } = await ctx.supabase
    .from("sutijumi")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ sutijumi: data ?? [] });
}

export async function POST(req: Request) {
  const ctx = await assertSuperAdmin(req);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const body = await req.json().catch(() => ({}));
  const { id, status } = body as { id?: string; status?: string };

  if (!id || !status) {
    return NextResponse.json({ error: "Missing id or status" }, { status: 400 });
  }

  const { error } = await ctx.supabase
    .from("sutijumi")
    .update({ status })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status });
}
