import { NextResponse } from "next/server";
import { adminClient, isSuperAdmin } from "@/lib/admin-auth";

export async function GET(req: Request) {
  if (!await isSuperAdmin(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { data, error } = await adminClient()
    .from("feedback")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function PATCH(req: Request) {
  if (!await isSuperAdmin(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { id, status } = await req.json();
  const { error } = await adminClient()
    .from("feedback")
    .update({ status })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
