import { NextResponse } from "next/server";
import { adminClient } from "@/lib/admin-auth";
import { marketplaceLifecycleEnabled } from "@/lib/marketplace-lifecycle";
import { processMarketplaceEmail } from "@/lib/marketplace-outbox";
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!marketplaceLifecycleEnabled()) return NextResponse.json({ state: "disabled" }, { headers: { "Cache-Control": "no-store" } });
  try {
    const sb = adminClient();
    const { error } = await sb.rpc("marketplace_expire_v1");
    if (error) throw new Error("Expiration unavailable");
    const notification = await processMarketplaceEmail(sb);
    return NextResponse.json({ ok: true, notification }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Lifecycle processing requires review" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
