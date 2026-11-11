/** A deterministic UI key; the server must still verify actual DB membership. */
export function canonicalCartId(listingId: string, variantId?: string | null): string {
  return variantId == null ? listingId : `${listingId}-${variantId}`;
}

export function cartIdentity(listingId: string, variantId?: string | null) {
  return {
    id: canonicalCartId(listingId, variantId),
    listingId,
    variantId: variantId ?? null,
  };
}
