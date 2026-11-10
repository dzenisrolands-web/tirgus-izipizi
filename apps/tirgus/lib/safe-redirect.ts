/** Only same-origin absolute paths; reject URL parser normalization surprises. */
export function safeInternalRedirect(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const decoded = decodeURIComponent(value);
    if (/[\\\u0000-\u0020\u007f]/.test(decoded) || decoded.startsWith("//")) return "/";
    const url = new URL(value, "https://example.invalid");
    if (url.origin !== "https://example.invalid" || url.pathname.startsWith("//")) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}
