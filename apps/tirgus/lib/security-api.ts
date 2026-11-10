/** Strict bearer extraction; never treats an arbitrary header as a token. */
export function bearerToken(req: Request): string | null {
  return /^Bearer\s+(\S+)$/i.exec(req.headers.get("authorization") ?? "")?.[1] ?? null;
}

export function isCronRequest(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return !!secret && bearerToken(req) === secret;
}

/** Include item ownership too, so inconsistent aggregates fail safely. */
export function orderSellerIds(order: { seller_ids?: unknown; items?: unknown }): string[] {
  const ids = new Set<string>();
  if (Array.isArray(order.seller_ids)) {
    for (const id of order.seller_ids) if (typeof id === "string" && id) ids.add(id);
  }
  if (Array.isArray(order.items)) {
    for (const item of order.items) {
      const id = item?.seller_id ?? item?.sellerId;
      if (typeof id === "string" && id) ids.add(id);
    }
  }
  return [...ids];
}
