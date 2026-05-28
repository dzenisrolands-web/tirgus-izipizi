import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabase as anonClient } from "@/lib/supabase";

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );
}

async function isAdmin(req: Request): Promise<boolean> {
  // Verify the caller has a valid super_admin session
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return false;
  const { data: { user } } = await anonClient.auth.getUser(token);
  if (!user) return false;
  const { data: profile } = await svc()
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return profile?.role === "super_admin";
}

export async function GET(req: Request) {
  if (!await isAdmin(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { data, error } = await svc()
    .from("feedback")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function PATCH(req: Request) {
  if (!await isAdmin(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { id, status } = await req.json();
  const { error } = await svc()
    .from("feedback")
    .update({ status })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
