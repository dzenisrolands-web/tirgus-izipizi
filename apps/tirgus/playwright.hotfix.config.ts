import { defineConfig } from "@playwright/test";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.invalid";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "nonfunctional-hotfix-publishable";
process.env.SUPABASE_SECRET_KEY = "nonfunctional-hotfix-service";
process.env.PAYSERA_MODE = "mock";

export default defineConfig({
  testDir: "./tests/hotfix",
  workers: 1,
  fullyParallel: false,
  reporter: [["list"]],
  outputDir: "test-results/hotfix",
});
