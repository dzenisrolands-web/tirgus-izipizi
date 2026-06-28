import { NextResponse } from "next/server";
import { assertSuperAdmin } from "@/lib/admin-auth";

/**
 * GET /api/admin/users
 * Returns all auth users + their seller status and order count.
 * Admin-only (requires super_admin auth).
 */
export async function GET(req: Request) {
  const ctx = await assertSuperAdmin(req);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { supabase } = ctx;

  // Fetch all auth users (paginated — Supabase returns max 1000 per call)
  const allUsers: Array<{
    id: string;
    email: string;
    created_at: string;
    last_sign_in_at: string | null;
    user_metadata: Record<string, unknown>;
    app_metadata: Record<string, unknown>;
  }> = [];

  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 500 });
    if (error || !data?.users?.length) break;
    for (const u of data.users) {
      allUsers.push({
        id: u.id,
        email: u.email ?? "",
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        user_metadata: u.user_metadata ?? {},
        app_metadata: u.app_metadata ?? {},
      });
    }
    if (data.users.length < 500) break;
    page++;
  }

  // Fetch all sellers (to match user_id → seller)
  const { data: sellers } = await supabase
    .from("sellers")
    .select("id, user_id, name, status, created_at");
  const sellerByUserId = new Map<string, { id: string; name: string; status: string; created_at: string }>();
  for (const s of sellers ?? []) {
    if (s.user_id) sellerByUserId.set(s.user_id, s);
  }

  // Fetch order counts by buyer email
  const { data: orders } = await supabase
    .from("orders")
    .select("buyer_email, payment_status");
  const ordersByEmail = new Map<string, { total: number; paid: number }>();
  for (const o of orders ?? []) {
    if (!o.buyer_email) continue;
    const key = o.buyer_email.toLowerCase();
    const cur = ordersByEmail.get(key) ?? { total: 0, paid: 0 };
    cur.total++;
    if (o.payment_status === "paid") cur.paid++;
    ordersByEmail.set(key, cur);
  }

  // Build response
  const users = allUsers.map((u) => {
    const seller = sellerByUserId.get(u.id);
    const meta = u.user_metadata;
    const fullName =
      (typeof meta.full_name === "string" ? meta.full_name : null) ??
      (typeof meta.name === "string" ? meta.name : null) ??
      null;
    const avatar =
      (typeof meta.avatar_url === "string" ? meta.avatar_url : null) ??
      (typeof meta.picture === "string" ? meta.picture : null) ??
      null;
    const provider = (u.app_metadata?.provider as string) ?? "email";
    const oStats = ordersByEmail.get(u.email.toLowerCase());

    return {
      id: u.id,
      email: u.email,
      name: fullName,
      avatar,
      provider,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      role: seller ? "seller" : "buyer",
      seller: seller ? { id: seller.id, name: seller.name, status: seller.status } : null,
      orders: oStats ?? { total: 0, paid: 0 },
    };
  });

  // Sort by created_at descending (newest first)
  users.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return NextResponse.json({ ok: true, total: users.length, users });
}
