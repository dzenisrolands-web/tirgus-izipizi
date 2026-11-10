import { test, expect } from "@playwright/test";
import { safeInternalRedirect } from "../../lib/auth-redirect";

test("auth callback targets never execute script or leave this origin", () => {
  for (const value of [null, undefined, "", "javascript:alert(1)", "https://evil.invalid",
    "//evil.invalid", "/\\evil.invalid", "/\n/evil.invalid", " /cart"]) {
    expect(safeInternalRedirect(value)).toBe("/");
  }
  expect(safeInternalRedirect("/cart")).toBe("/cart");
  expect(safeInternalRedirect("/catalog?q=āboli#products")).toBe("/catalog?q=%C4%81boli#products");
});
