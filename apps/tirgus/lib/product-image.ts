export const PRODUCT_IMAGE_PLACEHOLDER = "/images/product-placeholder.svg";

/** Missing photos must not silently hide otherwise public, priced products. */
export function publicProductImage(raw: unknown): string {
  if (typeof raw !== "string") return PRODUCT_IMAGE_PLACEHOLDER;
  const value = raw.trim();
  if (value.startsWith("/") && value !== "/" && !value.startsWith("//")) return value;
  try {
    const url = new URL(value);
    if (["https:", "http:"].includes(url.protocol) && !url.username && !url.password && url.pathname !== "/") return value;
  } catch { /* Use the explicit neutral fallback. */ }
  return PRODUCT_IMAGE_PLACEHOLDER;
}
