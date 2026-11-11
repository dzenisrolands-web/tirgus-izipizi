import { defineConfig } from "@playwright/test";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.invalid";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "nonfunctional-cart-public";
process.env.NEXT_PUBLIC_SITE_URL = "https://example.invalid";
delete process.env.SUPABASE_SECRET_KEY;
delete process.env.RESEND_API_KEY;
delete process.env.EMAIL_FROM;
delete process.env.VAPID_PRIVATE_KEY;

// Node/SSR only: no browser, webServer, storageState or live baseURL.
export default defineConfig({
  testDir: "./tests/cart-phase4",
  workers: 1,
  fullyParallel: false,
  reporter: [["list"]],
  outputDir: "test-results/cart-phase4",
});
