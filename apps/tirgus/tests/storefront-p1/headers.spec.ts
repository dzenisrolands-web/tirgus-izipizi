import { test, expect } from "@playwright/test";
import config from "../../next.config";
import { storefrontSecurityHeaders } from "../../lib/security-headers";
import { POST as report } from "../../app/api/security/csp-report/route";
import { GET as paymentRedirect } from "../../app/pay/route";
import { NextRequest } from "next/server";

test("global headers are report-only and retain payment/analytics/Storage resource origins", async () => {
  expect(config.poweredByHeader).toBe(false);
  const routes = await config.headers!();
  expect(routes).toEqual([{ source: "/:path*", headers: storefrontSecurityHeaders() }]);
  const values = Object.fromEntries(routes[0].headers.map(h => [h.key, h.value]));
  expect(values["Content-Security-Policy"]).toBeUndefined();
  const policy = values["Content-Security-Policy-Report-Only"];
  for (const allowed of ["https://example.invalid", "wss://example.invalid", "business.izipizi.lv",
    "paysera.com", "googletagmanager.com", "google-analytics.com", "frame-ancestors 'none'", "report-uri /api/security/csp-report"]) {
    expect(policy).toContain(allowed);
  }
  expect(values["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
  expect(values["Strict-Transport-Security"]).toContain("includeSubDomains");
  expect(values["X-Content-Type-Options"]).toBe("nosniff");
  expect(values["X-Frame-Options"]).toBe("DENY");
});
test("report endpoint bounds bodies and never logs URLs, tokens, script samples or customer fields", async () => {
  const original = console.warn, observed: unknown[][] = [];
  console.warn = (...args) => { observed.push(args); };
  try {
    const response = await report(new Request("https://example.invalid/report", {
      method: "POST", body: JSON.stringify({ "csp-report": { "effective-directive": "connect-src",
        "blocked-uri": "https://private.example.invalid/?token=never-log-this",
        "document-uri": "https://example.invalid/private-order", "script-sample": "private customer" } }),
    }));
    expect(response.status).toBe(204);
    expect(JSON.stringify(observed)).not.toMatch(/never-log-this|private-order|private customer|private\.example/);
    expect((await report(new Request("https://example.invalid", { method: "POST", body: "x".repeat(17000) }))).status).toBe(413);
    expect((await report(new Request("https://example.invalid", { method: "POST", body: "invalid" }))).status).toBe(400);
  } finally { console.warn = original; }
});
test("payment intermediary preserves its Paysera 302 and does not override strict referrer policy", async () => {
  const destination = "https://www.paysera.com/pay/?data=synthetic";
  const response = await paymentRedirect(new NextRequest(`https://example.invalid/pay?url=${encodeURIComponent(destination)}`));
  expect(response.status).toBe(302);
  expect(response.headers.get("location")).toBe(destination);
  expect(response.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
});
