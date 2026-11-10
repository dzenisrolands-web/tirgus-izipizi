/** Match an exact catalog ID or an actual declared variant, never a guessed ID prefix. */
export function deliveryListingForCartItem<T extends {
  id: string;
  variants?: readonly { id: string }[];
}>(itemId: string, listings: readonly T[]): T | undefined {
  return listings.find(listing => listing.id === itemId) ??
    listings.find(listing => listing.variants?.some(variant => `${listing.id}-${variant.id}` === itemId));
}
