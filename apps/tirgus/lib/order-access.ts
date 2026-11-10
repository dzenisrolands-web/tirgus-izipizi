import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextResponse } from "next/server";

function signature(orderNumber: string): string {
  return createHmac("sha256", process.env.SUPABASE_SECRET_KEY!)
    .update(`guest-order:${orderNumber}`).digest("hex");
}

function cookieName(orderNumber: string): string {
  return `order_${orderNumber.replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

export function grantOrderAccess(response: NextResponse, orderNumber: string): NextResponse {
  response.cookies.set(cookieName(orderNumber), signature(orderNumber), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax",
    path: "/", maxAge: 60 * 60 * 24 * 30,
  });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export function hasGuestOrderAccess(req: Request, orderNumber: string): boolean {
  const name = cookieName(orderNumber);
  const value = (req.headers.get("cookie") ?? "").split(";")
    .map(c => c.trim()).find(c => c.startsWith(`${name}=`))?.slice(name.length + 1);
  if (!value || !/^[a-f0-9]{64}$/.test(value)) return false;
  return timingSafeEqual(Buffer.from(value), Buffer.from(signature(orderNumber)));
}

export async function canReadOrder(
  req: Request, sb: SupabaseClient,
  order: { order_number: string; buyer_id?: string | null; buyer_email?: string | null },
): Promise<boolean> {
  if (hasGuestOrderAccess(req, order.order_number)) return true;
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) return false;
  const { data: { user }, error } = await sb.auth.getUser(token);
  if (error || !user) return false;
  return user.app_metadata?.is_super_admin === true || order.buyer_id === user.id ||
    (!order.buyer_id && !!user.email_confirmed_at && !!user.email &&
      order.buyer_email?.toLowerCase() === user.email.toLowerCase());
}
