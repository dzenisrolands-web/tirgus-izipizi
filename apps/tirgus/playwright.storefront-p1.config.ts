import { defineConfig } from "@playwright/test";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.invalid";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "dummy-publishable";
process.env.SUPABASE_SECRET_KEY = "dummy-service";
process.env.NEXT_PUBLIC_SITE_URL = "https://example.invalid";
process.env.PAYSERA_MODE = "test";
for (const key of ["RESEND_API_KEY", "VAPID_PRIVATE_KEY", "PAYSERA_SIGN_PASSWORD"]) delete process.env[key];
export default defineConfig({
  testDir: "./tests/storefront-p1", workers: 1, fullyParallel: false,
  outputDir: "test-results/storefront-p1", reporter: [["list"]],
});
