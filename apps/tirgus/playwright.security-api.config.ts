import { defineConfig } from "@playwright/test";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.invalid";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "dummy-publishable";
process.env.SUPABASE_SECRET_KEY = "dummy-service";
process.env.PAYSERA_MODE = "mock";
delete process.env.CRON_SECRET;
delete process.env.VAPID_PRIVATE_KEY;
delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
delete process.env.RESEND_API_KEY;

export default defineConfig({
  testDir: "./tests/security-api",
  workers: 1,
  fullyParallel: false,
  reporter: [["list"]],
  outputDir: "test-results/security-api",
});
