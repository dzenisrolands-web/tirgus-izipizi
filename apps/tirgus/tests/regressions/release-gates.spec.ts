import { test, expect } from "@playwright/test";
import { POST } from "../../app/api/admin/paysera-diagnostics/route";

test("even a verified admin cannot bypass inventory settlement through diagnostics", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async input => {
    const url = new URL(String(input));
    if (url.origin !== "https://example.invalid" || url.pathname !== "/auth/v1/user") {
      throw new Error("No order reads/writes or notifications permitted");
    }
    return Response.json({ id: "admin", app_metadata: { is_super_admin: true } });
  };
  try {
    const response = await POST(new Request("https://example.invalid/diagnostics", {
      method: "POST", headers: { authorization: "Bearer nonfunctional-test" },
      body: JSON.stringify({ orderNumber: "TRG-test" }),
    }));
    expect(response.status).toBe(410);
  } finally { globalThis.fetch = original; }
});
