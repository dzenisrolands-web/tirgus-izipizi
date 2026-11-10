export function paymentDisplayState(order: {
  status: string; payment_status: string; payment_review_reason?: string | null;
}): "review" | "paid" | "refunded" | "cancelled" | "awaiting" {
  if (order.payment_status === "refunded") return "refunded";
  if (order.payment_review_reason) return "review";
  if (order.status === "cancelled") return "cancelled";
  return order.payment_status === "paid" ? "paid" : "awaiting";
}
