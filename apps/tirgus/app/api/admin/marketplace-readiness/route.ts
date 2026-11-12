import { NextResponse } from "next/server";
import { assertSuperAdmin } from "@/lib/admin-auth";
import { marketplaceLifecycleEnabled } from "@/lib/marketplace-lifecycle";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(req: Request) {
  const ctx = await assertSuperAdmin(req);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status, headers });
  const { data, error } = await ctx.supabase.rpc("marketplace_readiness_v1");
  if (error || !data) return NextResponse.json({ productionReady: false, error: "Lifecycle schema has not been verified" }, { status: 503, headers });
  return NextResponse.json({
    ...data, productionReady: false, applicationLifecycleEnabled: marketplaceLifecycleEnabled(),
    receiverConfigured: false, automaticRefundsEnabled: false,
    note: "Read-only database observations are not a production rollout authorization.",
  }, { headers });
}
