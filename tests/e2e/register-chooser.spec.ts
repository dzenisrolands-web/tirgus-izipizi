import { test, expect } from "@playwright/test";

/**
 * Buyer/seller registration UX — the chooser page splits into two distinct
 * paths. We verify both visually and by interaction.
 */

test("register chooser shows both buyer and seller cards", async ({ page }) => {
  await page.goto("/register");
  await expect(page.getByRole("heading", { level: 2, name: /Esmu pircējs/ })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: /Esmu ražotājs/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Reģistrēties kā pircējs/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Pieteikties kā ražotājs/ })).toBeVisible();
});

test("buyer card navigates to /register/pircejs and shows form", async ({ page }) => {
  await page.goto("/register");
  await page.getByRole("link", { name: /Reģistrēties kā pircējs/ }).click();
  await expect(page).toHaveURL(/\/register\/pircejs/);
  await expect(page.getByPlaceholder("Vārds")).toBeVisible();
  await expect(page.getByPlaceholder("E-pasts")).toBeVisible();
  await expect(page.getByPlaceholder(/Parole/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Reģistrēties/ })).toBeVisible();
});

test("seller card navigates to /register/razotajs and shows form", async ({ page }) => {
  await page.goto("/register");
  await page.getByRole("link", { name: /Pieteikties kā ražotājs/ }).click();
  await expect(page).toHaveURL(/\/register\/razotajs/);
  await expect(page.getByPlaceholder(/Vārds/)).toBeVisible();
  await expect(page.getByPlaceholder("E-pasts")).toBeVisible();
  await expect(page.getByPlaceholder(/Parole/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Pieteikties/ })).toBeVisible();
});

test("buyer signup form rejects short password", async ({ page }) => {
  await page.goto("/register/pircejs");
  await page.getByPlaceholder("Vārds").fill("Anna");
  await page.getByPlaceholder("E-pasts").fill(`anna.test+${Date.now()}@example.com`);
  await page.getByPlaceholder(/Parole/).fill("short");
  await page.getByRole("button", { name: /Reģistrēties/ }).click();
  await expect(page.getByText(/vismaz 8 rakstzīmes/)).toBeVisible();
});
