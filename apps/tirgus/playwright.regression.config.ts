import { defineConfig } from "@playwright/test";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.invalid";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_nonfunctional_regression_key";
process.env.SUPABASE_SECRET_KEY = "nonfunctional-regression-key";
process.env.PAYSERA_MODE = "mock";

export default defineConfig({
  testDir: "./tests/regressions",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  outputDir: "test-results/regressions",
});
