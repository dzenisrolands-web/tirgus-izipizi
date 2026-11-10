export const PRODUCT_IMAGE_PLACEHOLDER = "/images/product-placeholder.svg";

/** Keep this allowlist aligned with next.config.ts images.remotePatterns. */
export function publicProductImage(raw: unknown): string {
  if (typeof raw !== "string") return PRODUCT_IMAGE_PLACEHOLDER;
  const value = raw.trim();
  if (!value || [...value].some(char => char === "\\" || char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) return PRODUCT_IMAGE_PLACEHOLDER;
  if (value.startsWith("/") && !value.startsWith("//") && value !== "/") return value;
  try {
    const url = new URL(value);
    const allowed = url.hostname === "images.unsplash.com"
      || ["izipizi.lv", "supabase.co"].some(domain => url.hostname.endsWith(`.${domain}`));
    if (url.protocol === "https:" && allowed && !url.username && !url.password && !url.port && url.pathname !== "/") return url.href;
  } catch { /* Invalid input uses a neutral local placeholder, never a demo product. */ }
  return PRODUCT_IMAGE_PLACEHOLDER;
}
