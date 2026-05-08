import { test, expect } from "@playwright/test";

/**
 * Smoke tests for public pages. Each page should:
 * - Load without errors
 * - Render expected key content
 * - Have no JS console errors
 * - Have no failed network requests
 */

const PAGES = [
  { path: "/", h1: /Ražotājs|pakomāts|galds/i, mustHave: ["Produkti", "Ražotāji"] },
  { path: "/catalog", mustHave: ["Visi produkti"] },
  { path: "/razotaji", h1: /Ražotāji/ },
  { path: "/piegade", mustHave: ["Piegāde"] },
  { path: "/eksprespiegade" },
  { path: "/par-mums", h1: /Pērc no.*vietējā/ },
  { path: "/how-it-works" },
  { path: "/contact" },
  { path: "/sell", h1: /Pārdod/ },
  { path: "/login", h1: /Pieslēgties/ },
  { path: "/register", h1: /Sveiks/ },
  { path: "/register/pircejs", h1: /pircējs/ },
  { path: "/register/razotajs", h1: /ražotājs/ },
  { path: "/lockers" },
  { path: "/noteikumi" },
  { path: "/privatums" },
  { path: "/atgriesana" },
];

for (const p of PAGES) {
  test(`public page renders: ${p.path}`, async ({ page }) => {
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();
        // Ignore noisy known-irrelevant errors
        if (text.includes("Quality Sign")) return;
        if (text.includes("preload")) return;
        consoleErrors.push(text);
      }
    });
    page.on("requestfailed", (req) => {
      // Ignore extension requests + known non-critical
      const url = req.url();
      if (url.includes("chrome-extension")) return;
      if (url.includes("paysera.com")) return; // 3rd-party widget
      failedRequests.push(`${req.method()} ${url} — ${req.failure()?.errorText}`);
    });

    const response = await page.goto(p.path, { waitUntil: "domcontentloaded" });
    expect(response?.status(), `${p.path} should return 200`).toBeLessThan(400);

    if (p.h1) {
      await expect(page.locator("h1").first()).toContainText(p.h1);
    }

    if (p.mustHave) {
      for (const text of p.mustHave) {
        await expect(page.locator("body")).toContainText(text);
      }
    }

    expect(consoleErrors, `Console errors on ${p.path}`).toEqual([]);
    expect(failedRequests, `Failed requests on ${p.path}`).toEqual([]);
  });
}
