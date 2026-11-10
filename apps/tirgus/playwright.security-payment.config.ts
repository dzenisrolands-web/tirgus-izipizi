import { defineConfig } from "@playwright/test";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.invalid";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "nonfunctional-security-payment-public";
process.env.SUPABASE_SECRET_KEY = "nonfunctional-security-payment-service";
process.env.ORDER_ACCESS_SECRET = "nonfunctional-security-payment-cookie";
process.env.NEXT_PUBLIC_SITE_URL = "https://example.invalid";
process.env.PAYSERA_PROJECT_ID = "123456";
process.env.PAYSERA_SIGN_PASSWORD = "nonfunctional-security-payment-signing";
process.env.PAYSERA_MODE = "test";
delete process.env.RESEND_API_KEY;
delete process.env.EMAIL_FROM;
delete process.env.VAPID_PRIVATE_KEY;

export default defineConfig({
  testDir: "./tests/security-payment",
  workers: 1,
  fullyParallel: false,
  reporter: [["list"]],
  outputDir: "test-results/security-payment",
});
