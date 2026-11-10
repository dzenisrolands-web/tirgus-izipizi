import crypto from "node:crypto";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { NextResponse } from "next/server";

export const ORDER_ACCESS_TTL_SECONDS = 30 * 24 * 60 * 60;

function signingKey(): string {
  // Domain separation keeps this capability distinct from Supabase and Paysera tokens.
  const key = process.env.ORDER_ACCESS_SECRET || process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("Order access signing key is not configured");
  return key;
}

export function orderCookieName(orderNumber: string): string {
  return `order_access_${crypto.createHash("sha256").update(orderNumber).digest("hex").slice(0, 24)}`;
}

function signature(orderNumber: string, issuedAt: number, expiresAt: number): string {
  return crypto.createHmac("sha256", signingKey())
    .update(JSON.stringify(["order-access-v1", orderNumber, issuedAt, expiresAt]))
    .digest("hex");
}

export function createOrderCapability(orderNumber: string, now = Date.now()): string {
  const issuedAt = Math.floor(now / 1000);
  const expiresAt = issuedAt + ORDER_ACCESS_TTL_SECONDS;
  return `${issuedAt}.${expiresAt}.${signature(orderNumber, issuedAt, expiresAt)}`;
}

export function hasOrderCapability(req: Request, orderNumber: string, now = Date.now()): boolean {
  const name = orderCookieName(orderNumber);
  const values = (req.headers.get("cookie") ?? "").split(";")
    .map((part) => part.trim()).filter((part) => part.startsWith(`${name}=`));
  if (values.length !== 1) return false;
  const match = /^([0-9]{1,12})\.([0-9]{1,12})\.([a-f0-9]{64})$/.exec(values[0].slice(name.length + 1));
  if (!match) return false;
  const issuedAt = Number(match[1]);
  const expiresAt = Number(match[2]);
  const seconds = Math.floor(now / 1000);
  if (issuedAt > seconds || expiresAt <= seconds || expiresAt - issuedAt !== ORDER_ACCESS_TTL_SECONDS) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(match[3], "hex"), Buffer.from(signature(orderNumber, issuedAt, expiresAt), "hex"));
  } catch {
    return false;
  }
}

export function attachOrderCookie(response: NextResponse, orderNumber: string): NextResponse {
  response.cookies.set(orderCookieName(orderNumber), createOrderCapability(orderNumber), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ORDER_ACCESS_TTL_SECONDS,
  });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function verifiedOrderUser(req: Request, supabase: SupabaseClient): Promise<User | null> {
  const match = /^Bearer ([^\s]+)$/i.exec(req.headers.get("authorization") ?? "");
  if (!match) return null;
  const { data, error } = await supabase.auth.getUser(match[1]);
  return error ? null : data.user;
}

export function userOwnsOrder(
  user: User | null,
  order: { buyer_id?: string | null; buyer_email?: string | null },
): boolean {
  if (!user) return false;
  if (user.app_metadata?.is_super_admin === true || (order.buyer_id && order.buyer_id === user.id)) return true;
  // A verified email supports old legitimate orders with missing/stale buyer_id.
  return !!user.email_confirmed_at && !!user.email && !!order.buyer_email
    && user.email.trim().toLowerCase() === order.buyer_email.trim().toLowerCase();
}

export function newOrderNumber(prefix: "TRG" | "KER"): string {
  return `${prefix}-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${crypto.randomBytes(12).toString("hex")}`;
}
