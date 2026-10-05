import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendSellerApprovalEmail } from "@/lib/email";

/**
 * POST /api/admin/approve-seller
 * Body: { sellerId: string }
 *
 * 1. Updates seller status → "approved"
 * 2. Updates profile role → "seller"
 * 3. Sends branded approval email with dashboard + referral link
 *
 * Also supports: { sellerId, resendOnly: true } — skips status update, just resends email.
 */
export async function POST(req: Request) {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  );

  // Auth check
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ ok: false, error: "Nav autorizācijas" }, { status: 401 });
  }
  const { data: { user } } = await sb.auth.getUser(token);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Nav autorizācijas" }, { status: 401 });
  }

  const body = await req.json();
  const sellerId = body.sellerId as string;
  const resendOnly = body.resendOnly === true;

  if (!sellerId) {
    return NextResponse.json({ ok: false, error: "sellerId ir obligāts" }, { status: 400 });
  }

  // Fetch seller
  const { data: seller, error: fetchErr } = await sb
    .from("sellers")
    .select("id, name, email, slug, user_id, status")
    .eq("id", sellerId)
    .single();

  if (fetchErr || !seller) {
    return NextResponse.json({ ok: false, error: "Ražotājs nav atrasts" }, { status: 404 });
  }

  // Approve (unless resend-only)
  if (!resendOnly) {
    const now = new Date().toISOString();
    const { error: updateErr } = await sb.from("sellers").update({
      status: "approved",
      approved_at: now,
      approved_by: user.id,
      rejected_reason: null,
      rejected_at: null,
    }).eq("id", sellerId);

    if (updateErr) {
      return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 });
    }

    // Update profile role
    if (seller.user_id) {
      await sb.from("profiles").update({ role: "seller" }).eq("id", seller.user_id);
    }
  }

  // Find seller email — from sellers.email or from auth user
  let sellerEmail = seller.email;
  if (!sellerEmail && seller.user_id) {
    const { data: authUser } = await sb.auth.admin.getUserById(seller.user_id);
    sellerEmail = authUser?.user?.email ?? null;
  }

  // Send approval email
  let emailResult = null;
  if (sellerEmail) {
    emailResult = await sendSellerApprovalEmail({
      to: sellerEmail,
      sellerName: seller.name ?? "Ražotāj",
      sellerId: seller.id,
      sellerSlug: seller.slug ?? null,
    });
  }

  return NextResponse.json({
    ok: true,
    approved: !resendOnly,
    emailSent: emailResult?.ok ?? false,
    emailTo: sellerEmail ?? null,
    emailError: emailResult && !emailResult.ok ? (emailResult as { error: string }).error : null,
  });
}
