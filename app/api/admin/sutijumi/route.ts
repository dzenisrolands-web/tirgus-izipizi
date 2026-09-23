import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { assertSuperAdmin } from "@/lib/admin-auth";

// izipizi-web Supabase (sutijumi tabula dzīvo tur).
// TODO(konsolidācija): pēc DB apvienošanas šis cross-project klients pazūd —
// sutijumi pārceļas uz tirgus projektu un lasāms ar parasto service-role klientu.
function izpClient() {
  const url = process.env.IZP_SUPABASE_URL;
  const key = process.env.IZP_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const MISCONFIGURED =
  "Trūkst IZP_SUPABASE_URL vai IZP_SUPABASE_ANON_KEY vides mainīgo";

/**
 * GET /api/admin/sutijumi — list all shipments
 * POST /api/admin/sutijumi — update status
 */
export async function GET(req: Request) {
  const ctx = await assertSuperAdmin(req);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  // Lasām ar anon atslēgu — prasa SELECT politiku anon lomai uz sutijumi.
  const sb = izpClient();
  if (!sb) return NextResponse.json({ error: MISCONFIGURED }, { status: 500 });

  const { data, error } = await sb
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

  const sb = izpClient();
  if (!sb) return NextResponse.json({ error: MISCONFIGURED }, { status: 500 });

  const { error } = await sb
    .from("sutijumi")
    .update({ status })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status });
}
