function supabaseSources() {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return ["https://*.supabase.co", "wss://*.supabase.co"];
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("Invalid public Supabase origin");
  return [url.origin, `wss://${url.host}`];
}

export function storefrontSecurityHeaders() {
  const dev = process.env.NODE_ENV !== "production";
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""} https://www.googletagmanager.com https://*.google-analytics.com https://*.paysera.com https://*.vercel-scripts.com`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    // Existing public catalog images use multiple HTTPS CDNs, not only Storage.
    "img-src 'self' https: data: blob:",
    `connect-src 'self' ${supabaseSources().join(" ")} https://business.izipizi.lv https://*.paysera.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://*.vercel-insights.com https://*.vercel-scripts.com https://nominatim.openstreetmap.org${dev ? " ws: wss:" : ""}`,
    "frame-src 'self' https://business.izipizi.lv https://*.paysera.com https://www.youtube.com https://www.youtube-nocookie.com",
    "form-action 'self' https://*.paysera.com",
    "report-uri /api/security/csp-report",
  ].join("; ");
  return [
    { key: "Content-Security-Policy-Report-Only", value: csp },
    // RO frame-ancestors is not enforcement; DENY provides the actual frame gate.
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: 'camera=(), microphone=(), geolocation=(self), payment=(self "https://www.paysera.com"), usb=()' },
    { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  ];
}
