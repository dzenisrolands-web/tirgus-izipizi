import { defineConfig } from "@playwright/test";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.invalid";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "nonfunctional-public";
process.env.SUPABASE_SECRET_KEY = "nonfunctional-service";
process.env.ORDER_ACCESS_SECRET = "nonfunctional-capability";
process.env.NEXT_PUBLIC_SITE_URL = "https://example.invalid";
process.env.PAYSERA_MODE = "test";
process.env.PAYSERA_PROJECT_ID = "123456";
process.env.PAYSERA_SIGN_PASSWORD = "nonfunctional-synthetic-signing";
for (const key of ["RESEND_API_KEY", "VAPID_PRIVATE_KEY", "ESTERIA_API_KEY", "IZP_SUPABASE_SERVICE_KEY"]) delete process.env[key];
for (const key of ["MARKETPLACE_LOGISTICS_RECEIVER_URL", "MARKETPLACE_LOGISTICS_RECEIVER_ORIGIN", "MARKETPLACE_LOGISTICS_RECEIVER_TOKEN"]) delete process.env[key];
export default defineConfig({
  testDir: "./tests/lifecycle-api", workers: 1, fullyParallel: false,
  reporter: [["list"]], outputDir: "test-results/lifecycle-api",
});
