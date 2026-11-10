import { test, expect } from "@playwright/test";
import { generateInvoicesForPeriod } from "../../lib/invoice/generate";

const period = {
  start: new Date("2026-11-01T00:00:00Z"), end: new Date("2026-11-15T23:59:59Z"), label: "Test",
};
const item = {
  title: "Test", price: 12.1, quantity: 1, seller_id: "seller",
  commission_rate: 15, vat_rate: 21, seller_delivery_mode: "locker", seller_courier_fee_cents: 0,
};
const order = (id: string, items: object[]) => ({
  id, order_number: `TEST-${id}`, paid_at: "2026-11-01T12:00:00Z", items, seller_ids: ["seller"],
});

function mock(orders: object[], options: { missingRpc?: boolean; failInsert?: boolean } = {}) {
  const calls: string[] = [];
  let payload: { p_header: Record<string, unknown>; p_lines: Record<string, unknown>[] } | null = null;
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    expect(url.hostname).toBe("example.invalid");
    const table = url.pathname.split("/").pop();
    const method = init?.method ?? "GET";
    calls.push(`${method} ${table}`);
    if (table === "invoice_generation_ready") return options.missingRpc
      ? Response.json({ code: "PGRST202", message: "function missing" }, { status: 404 })
      : Response.json(1);
    if (table === "create_invoice_with_lines") {
      payload = JSON.parse(String(init?.body));
      return options.failInsert
        ? Response.json({ code: "23503", message: "atomic rollback test" }, { status: 409 })
        : Response.json({ id: "invoice", invoice_number: "TIR-2026-9999" });
    }
    // Direct financial writes, standalone numbering and current listing lookups
    // are forbidden even when the RPC fails.
    expect(method).toBe("GET");
    if (table === "invoices") return Response.json(url.searchParams.get("limit") === "0" ? [] : null);
    if (table === "invoice_lines") return Response.json([]);
    if (table === "orders") return Response.json(orders);
    if (table === "sellers") return Response.json([{
      id: "seller", user_id: "user", legal_name: "Test", bank_iban: "DUMMY",
      self_billing_agreed: true, self_billing_agreement_version: "3.0",
      // Current profile deliberately contradicts order-time evidence.
      delivery_mode: "courier", is_vat_registered: true,
    }]);
    if (table === "push_subscriptions") return Response.json([]);
    throw new Error(`Forbidden invoice call ${method} ${url.pathname}`);
  };
  return { calls, fetcher, payload: () => payload };
}

test("missing atomic RPC blocks before reading paid orders", async () => {
  const original = globalThis.fetch;
  const backend = mock([], { missingRpc: true });
  globalThis.fetch = backend.fetcher;
  try {
    await expect(generateInvoicesForPeriod(period)).rejects.toThrow("0039_atomic_invoice_generation.sql");
    expect(backend.calls).toEqual(["GET invoices", "GET invoice_lines", "POST invoice_generation_ready"]);
  } finally { globalThis.fetch = original; }
});

test("unknown financial snapshots block whole seller period without reconstructing history", async () => {
  const original = globalThis.fetch;
  try {
    for (const changes of [
      { commission_rate: undefined }, { commission_rate: 10 },
      { vat_rate: null }, { vat_rate: 99 }, { vat_rate: "21" },
      { seller_delivery_mode: undefined }, { seller_delivery_mode: "courier" },
      { seller_courier_fee_cents: undefined }, { seller_courier_fee_cents: 350 },
      { price: -1 }, { quantity: 0 },
    ]) {
      const backend = mock([order("one", [item, { ...item, ...changes }])]);
      globalThis.fetch = backend.fetcher;
      const result = await generateInvoicesForPeriod(period);
      expect(result.generated).toEqual([]);
      expect(result.totalSellers).toBe(1);
      expect(result.skipped).toEqual([{
        sellerId: "seller", reason: expect.stringContaining("manual reconciliation required"),
      }]);
      expect(backend.calls).not.toContain("GET sellers");
      expect(backend.payload()).toBeNull();
    }
  } finally { globalThis.fetch = original; }
});

test("conflicting pickup snapshots within one seller/order require manual reconciliation", async () => {
  const original = globalThis.fetch;
  const backend = mock([order("one", [item, {
    ...item, seller_delivery_mode: "courier", seller_courier_fee_cents: 350,
  }])]);
  globalThis.fetch = backend.fetcher;
  try {
    const result = await generateInvoicesForPeriod(period);
    expect(result.generated).toEqual([]);
    expect(result.skipped[0].reason).toContain("manual reconciliation");
    expect(backend.payload()).toBeNull();
  } finally { globalThis.fetch = original; }
});

test("stored VAT0 and locker pickup override changed current seller settings", async () => {
  const original = globalThis.fetch;
  const backend = mock([order("one", [{ ...item, vat_rate: 0 }])]);
  globalThis.fetch = backend.fetcher;
  try {
    expect((await generateInvoicesForPeriod(period)).generated).toHaveLength(1);
    expect(backend.payload()?.p_header).toMatchObject({
      courier_fee_cents: 0, courier_order_count: 0, total_product_vat_cents: 0,
      total_ex_vat_cents: 1210, total_commission_cents: 182, commission_vat_cents: 38, total_net_cents: 990,
    });
    expect(backend.payload()?.p_lines[0]).toMatchObject({ vat_rate: 0, vat_amount_cents: 0 });
  } finally { globalThis.fetch = original; }
});

test("courier pickup is charged once per seller/order using recorded fee", async () => {
  const original = globalThis.fetch;
  const courier = { ...item, seller_delivery_mode: "courier", seller_courier_fee_cents: 350 };
  const backend = mock([order("one", [courier, courier]), order("two", [item])]);
  globalThis.fetch = backend.fetcher;
  try {
    expect((await generateInvoicesForPeriod(period)).generated).toHaveLength(1);
    expect(backend.payload()?.p_header).toMatchObject({
      courier_fee_cents: 350, courier_order_count: 1, total_net_cents: 2734,
    });
    expect(backend.payload()?.p_lines).toHaveLength(3);
    expect(backend.calls.filter(call => call === "POST create_invoice_with_lines")).toHaveLength(1);
  } finally { globalThis.fetch = original; }
});

test("atomic insert failure never falls back to partial writes or notifications", async () => {
  const original = globalThis.fetch;
  const backend = mock([order("one", [item])], { failInsert: true });
  globalThis.fetch = backend.fetcher;
  try {
    const result = await generateInvoicesForPeriod(period);
    expect(result.generated).toEqual([]);
    expect(result.skipped[0].reason).toContain("atomic invoice failed");
    expect(backend.calls).not.toContain("GET push_subscriptions");
  } finally { globalThis.fetch = original; }
});
