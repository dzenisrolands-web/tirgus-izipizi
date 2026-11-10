/** Publication and admin review are separate: new products can be active before review. */
export function needsListingReview(listing: { status: string; commission_approved_at?: string | null }): boolean {
  return listing.status === "pending_review" ||
    (listing.status === "active" && !listing.commission_approved_at);
}
