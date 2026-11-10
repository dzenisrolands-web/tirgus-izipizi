/** Never pass untrusted auth callback targets to the client router. */
export function safeInternalRedirect(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") ||
      /[\\\u0000-\u0020\u007f]/.test(value)) return "/";
  try {
    const base = "https://tirgus.izipizi.lv";
    const url = new URL(value, base);
    return url.origin === base ? `${url.pathname}${url.search}${url.hash}` : "/";
  } catch {
    return "/";
  }
}
