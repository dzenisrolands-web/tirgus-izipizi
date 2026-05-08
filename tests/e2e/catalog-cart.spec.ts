import { test, expect } from "@playwright/test";

/**
 * Catalog browse + cart flow — works without authentication (guest checkout).
 */

test("catalog shows products and product card opens detail", async ({ page }) => {
  await page.goto("/catalog");
  // Wait for product cards to render (they pull from DB)
  const cards = page.locator("a[href^='/listing/']");
  await expect(cards.first()).toBeVisible({ timeout: 15_000 });

  const firstCard = cards.first();
  const href = await firstCard.getAttribute("href");
  expect(href).toMatch(/^\/listing\//);

  await firstCard.click();
  await expect(page).toHaveURL(/\/listing\//);
  // Listing page should show price and "Add to cart"
  await expect(page.getByRole("button", { name: /grozam|Pievienot/i }).first()).toBeVisible();
});

test("razotaji page lists sellers and links to profile", async ({ page }) => {
  await page.goto("/razotaji");
  const sellerLinks = page.locator("a[href^='/seller/']");
  await expect(sellerLinks.first()).toBeVisible({ timeout: 15_000 });

  const href = await sellerLinks.first().getAttribute("href");
  expect(href).toMatch(/^\/seller\//);

  await sellerLinks.first().click();
  await expect(page).toHaveURL(/\/seller\//);
  // Seller profile shows "Sekot ražotājam" or "Sekot" button somewhere
  await expect(page.getByText(/Sekot/i).first()).toBeVisible({ timeout: 10_000 });
});

test("seller profile renders without console errors", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && !msg.text().includes("Quality Sign")) {
      consoleErrors.push(msg.text());
    }
  });

  await page.goto("/razotaji");
  const sellerLink = page.locator("a[href^='/seller/']").first();
  await expect(sellerLink).toBeVisible({ timeout: 15_000 });
  await sellerLink.click();
  await expect(page).toHaveURL(/\/seller\//);

  // Wait a moment for async hydration
  await page.waitForTimeout(2000);
  expect(consoleErrors).toEqual([]);
});
