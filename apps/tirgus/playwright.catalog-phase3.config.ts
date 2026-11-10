import { defineConfig } from "@playwright/test";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.invalid";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "nonfunctional-catalog-public";
process.env.SUPABASE_SECRET_KEY = "nonfunctional-catalog-service";
process.env.NEXT_PUBLIC_SITE_URL = "https://example.invalid";
delete process.env.RESEND_API_KEY;
delete process.env.EMAIL_FROM;
delete process.env.VAPID_PRIVATE_KEY;

export default defineConfig({
  testDir: "./tests/catalog-phase3",
  workers: 1,
  fullyParallel: false,
  reporter: [["list"]],
  outputDir: "test-results/catalog-phase3",
});
