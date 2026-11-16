import type { ReactNode } from "react";

/** One purchase control: fixed above mobile navigation, in-flow on desktop. */
export function ProductPurchaseAction({ stickyMobile, children }: { stickyMobile?: boolean; children: ReactNode }) {
  return <div className={stickyMobile ? "product-purchase-action" : undefined}>{children}</div>;
}
