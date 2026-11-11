import type { DeliveryZone } from "./postal-zones";

export type DeliveryMethod = "locker" | "courier" | "express";
export type DeliveryStorageType = "frozen" | "chilled";

/** These are references, not authority for price, ownership or fulfillment. */
export type CheckoutItemReference = {
  id: string;
  quantity: number;
  listingId?: string;
  variantId?: string | null;
};

export type CheckoutQuoteRequest = {
  items: CheckoutItemReference[];
  deliveryType?: DeliveryMethod;
  deliveryInfo?: Record<string, unknown>;
  locker?: { id?: string };
  promoCode?: string;
};

/** Cart identity stays distinct from the listing ID persisted in order items. */
export type CanonicalCartItem = {
  id: string;
  listingId: string;
  variantId: string | null;
  title: string;
  price: number;
  unitCents: number;
  quantity: number;
  availableQuantity: number;
  unit: string;
  image: string;
  sellerId: string;
  sellerName: string;
  storageType: DeliveryStorageType;
  category: string;
  courier_delivery: boolean;
  express_delivery: boolean;
  slug?: string;
};

export type CheckoutQuoteSeller = {
  id: string;
  name: string;
  homeLockerIds: string[];
};

export type DeliveryQuoteItem = {
  storageType?: string | null;
  category: string;
  courierDelivery?: boolean | null;
  expressDelivery?: boolean | null;
};

export type DeliveryQuoteInput = {
  method: DeliveryMethod;
  buyerPostalCode?: string | null;
  lockerId?: string | null;
  sellers: readonly {
    sellerId: string;
    homeLockerIds: readonly string[];
    items: readonly DeliveryQuoteItem[];
  }[];
};

export type DeliveryFeeSnapshot = {
  sellerId: string;
  method: DeliveryMethod;
  lockerId: string | null;
  buyerPostalCode: string | null;
  buyerZone: DeliveryZone | null;
  temperature: "single" | "dual";
  netCents: number | null;
  vatCents: number | null;
  totalCents: number;
  tariffVersion: string;
  zonePolicy: "published-destination-postcode-v1";
};

export type DeliveryQuoteError =
  | "invalid_method"
  | "invalid_seller"
  | "invalid_locker"
  | "unknown_buyer_zone"
  | "courier_unsupported"
  | "express_unsupported"
  | "invalid_amount";

export type DeliveryQuote =
  | { ok: true; totalCents: number; breakdown: DeliveryFeeSnapshot[] }
  | {
    ok: false;
    totalCents: null;
    breakdown: [];
    error: DeliveryQuoteError;
    sellerId?: string;
  };

export type CheckoutPromo = {
  valid: boolean;
  code?: string;
  discountCents: number;
  reason?: string;
};

/** An incomplete delivery selection is never represented as free shipping. */
export type CheckoutQuote = {
  version: string;
  fingerprint: string;
  available: boolean;
  items: CanonicalCartItem[];
  sellers: CheckoutQuoteSeller[];
  sellerIds: string[];
  deliveryType: DeliveryMethod;
  deliveryInfo: Record<string, unknown>;
  delivery: DeliveryQuote;
  subtotalCents: number;
  deliveryFeeCents: number | null;
  discountCents: number;
  preDiscountTotalCents: number | null;
  totalCents: number | null;
  promo: CheckoutPromo;
};

export type CheckoutIssue = {
  id: string;
  code: string;
  message: string;
};

export type CheckoutQuoteResponse =
  | { ok: true; quote: CheckoutQuote }
  | {
    ok: false;
    code: string;
    error: string;
    issues?: CheckoutIssue[];
    quote?: CheckoutQuote;
  };
