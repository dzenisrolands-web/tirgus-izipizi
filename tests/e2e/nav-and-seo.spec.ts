import { test, expect } from "@playwright/test";

/**
 * Navigation links and SEO metadata sanity checks.
 */

test("main nav links work and don't 404", async ({ page, isMobile }) => {
  await page.goto("/");
  // On mobile, nav is hidden behind hamburger toggle — open it first
  if (isMobile) {
    await page.getByRole("button", { name: /Navigācija|Open|menu/i }).click();
  }
  for (const label of ["Produkti", "Ražotāji", "Piegāde"]) {
    const link = page.getByRole("link", { name: new RegExp(`^${label}$`) }).first();
    await expect(link).toBeVisible();
  }
});

test("footer has legal links", async ({ page }) => {
  await page.goto("/");
  // Scroll to footer
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  for (const label of ["Lietošanas noteikumi", "Privātuma politika", "Atgriešanas politika"]) {
    await expect(page.getByRole("link", { name: label })).toBeVisible();
  }
});

test("homepage has correct og tags", async ({ page }) => {
  await page.goto("/");
  const ogTitle = await page.locator('meta[property="og:title"]').getAttribute("content");
  expect(ogTitle).toContain("tirgus.izipizi.lv");
  const ogImage = await page.locator('meta[property="og:image"]').first().getAttribute("content");
  expect(ogImage).toBeTruthy();
});

test("admin route is noindexed", async ({ page }) => {
  // Use raw HTTP request — Playwright's page.goto would trigger the client-
  // side auth redirect to /login, masking the meta tag we want to verify.
  const res = await page.request.get("/admin");
  const html = await res.text();
  expect(html, "/admin static HTML must declare noindex").toMatch(/<meta[^>]*name="robots"[^>]*noindex/i);
});

test("dashboard route is noindexed", async ({ page }) => {
  const res = await page.request.get("/dashboard");
  const html = await res.text();
  expect(html, "/dashboard static HTML must declare noindex").toMatch(/<meta[^>]*name="robots"[^>]*noindex/i);
});

test("recipes route is noindexed", async ({ page }) => {
  const res = await page.request.get("/receptes");
  const html = await res.text();
  expect(html, "/receptes static HTML must declare noindex").toMatch(/<meta[^>]*name="robots"[^>]*noindex/i);
});

test("public homepage is indexed", async ({ page }) => {
  const res = await page.request.get("/");
  const html = await res.text();
  // Should NOT have noindex
  expect(html).not.toMatch(/<meta[^>]*name="robots"[^>]*noindex/i);
});
