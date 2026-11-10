import { NextResponse } from "next/server";
import { assertSuperAdmin } from "@/lib/admin-auth";
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
  const auth = await assertSuperAdmin(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { supabase: sb, user } = auth;

  const body = (await req.json().catch(() => null)) ?? {};
  const sellerId = body.sellerId as string;
  const resendOnly = body.resendOnly === true;

  if (typeof sellerId !== "string" || !sellerId.trim()) {
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
    const { data: updated, error: updateErr } = await sb.from("sellers").update({
      status: "approved",
      approved_at: now,
      approved_by: user.id,
      rejected_reason: null,
      rejected_at: null,
    }).eq("id", sellerId).select("id").maybeSingle();

    if (updateErr) {
      return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 });
    }
    if (!updated) return NextResponse.json({ ok: false, error: "Seller changed; reload and retry" }, { status: 409 });

    // Update profile role
    if (seller.user_id) {
      const { data: profile, error } = await sb.from("profiles").update({ role: "seller" }).eq("id", seller.user_id).select("id").maybeSingle();
      if (error || !profile) return NextResponse.json({ ok: false, error: "Profile update failed" }, { status: 500 });
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
