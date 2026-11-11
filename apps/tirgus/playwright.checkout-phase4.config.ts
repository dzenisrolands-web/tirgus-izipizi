import { defineConfig } from "@playwright/test";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.invalid";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "nonfunctional-checkout-public";
process.env.SUPABASE_SECRET_KEY = "nonfunctional-checkout-service";
process.env.ORDER_ACCESS_SECRET = "nonfunctional-checkout-cookie";
process.env.NEXT_PUBLIC_SITE_URL = "https://example.invalid";
process.env.PAYSERA_MODE = "mock";
process.env.PAYSERA_PROJECT_ID = "123456";
process.env.PAYSERA_SIGN_PASSWORD = "nonfunctional-checkout-signing";
delete process.env.RESEND_API_KEY;
delete process.env.EMAIL_FROM;
delete process.env.VAPID_PRIVATE_KEY;

export default defineConfig({
  testDir: "./tests/checkout-phase4",
  workers: 1,
  fullyParallel: false,
  reporter: [["list"]],
  outputDir: "test-results/checkout-phase4",
});
