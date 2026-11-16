import { test, expect } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
const repo = resolve(__dirname, "../../../..");
test("food SQL is a proposal outside automatic migrations and preserves unknown historical data", () => {
  const file = "docs/proposals/p1-food-information.sql";
  const sql = readFileSync(resolve(repo, file), "utf8");
  expect(sql).toContain("PROPOSAL ONLY");
  expect(readdirSync(resolve(repo, "supabase/migrations"))).not.toContain("p1-food-information.sql");
  for (const field of ["ingredients", "allergens", "net_quantity", "net_unit", "storage_conditions",
    "food_business_name", "food_business_address", "country_of_origin", "nutrition"]) expect(sql).toContain(`ADD COLUMN ${field} `);
  expect(sql).not.toMatch(/ADD COLUMN[^\n]*(?:DEFAULT|NOT NULL)/);
  const statements = sql.split("\n").filter(line => !line.trim().startsWith("--")).join("\n");
  expect(statements).not.toMatch(/\b(?:UPDATE\s+public|INSERT\s+INTO|CREATE\s+POLICY|GRANT\s|REVOKE\s)\b/i);
  expect(sql).toContain("'basis'");
});
