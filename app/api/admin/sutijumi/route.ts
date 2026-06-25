import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { assertSuperAdmin } from "@/lib/admin-auth";

// izipizi-web Supabase (sutijumi table lives here)
const IZP_URL = "https://wepyslyqcxpszobfkzzs.supabase.co";
const IZP_KEY = "sb_publishable_BMqu4RvrA4cl72OJQQakLA_8Amc2F8-";

function izpClient() {
  return createClient(IZP_URL, IZP_KEY);
}

/**
 * GET /api/admin/sutijumi — list all shipments
 * POST /api/admin/sutijumi — update status
 */
export async function GET(req: Request) {
  const ctx = await assertSuperAdmin(req);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  // Use service-like approach: add a broad read policy or use anon with a policy
  // For now we read with anon key — requires SELECT policy for anon on sutijumi
  const sb = izpClient();
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
  const { error } = await sb
    .from("sutijumi")
    .update({ status })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status });
}
