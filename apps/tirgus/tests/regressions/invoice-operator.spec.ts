import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  newInvoiceOperatorSnapshot, resolveInvoiceOperator,
} from "../../lib/invoice/operator-snapshot";
import { assertInvoiceSchema } from "../../lib/invoice/schema";
import { invoiceCommissionVat } from "../../lib/invoice/vat";
import { commissionBreakdown } from "../../lib/commission";
import { generateInvoicesForPeriod } from "../../lib/invoice/generate";

const app = resolve(__dirname, "../..");
const source = (path: string) => readFileSync(resolve(app, path), "utf8");
const legacy = (number: string, date: string) => ({
  invoice_number: number, generated_at: date,
});

test("missing or old operator consent cannot generate a snapshot under the new operator", async () => {
  const original = globalThis.fetch;
  try {
    for (const version of [null, "1.0", "2.0"]) {
      globalThis.fetch = async (input, init) => {
        const url = new URL(String(input));
        expect(url.hostname).toBe("example.invalid");
        const table = url.pathname.split("/").pop();
        if (table === "invoice_generation_ready") return Response.json(1);
        expect(init?.method ?? "GET").toBe("GET");
        if (table === "invoices" || table === "invoice_lines") return Response.json([]);
        if (table === "orders") return Response.json([{
          id: "order", order_number: "TEST", paid_at: "2026-11-01T12:00:00Z",
          items: [{ title: "Test", price: 1, quantity: 1, seller_id: "seller", vat_rate: 21,
            commission_rate: 15, seller_delivery_mode: "locker", seller_courier_fee_cents: 0 }],
        }]);
        if (table === "sellers") return Response.json([{
          id: "seller", legal_name: "Test", bank_iban: "DUMMY",
          self_billing_agreed: true, self_billing_agreement_version: version,
        }]);
        throw new Error(`Consent check must not number, write or notify: ${url.pathname}`);
      };
      const result = await generateInvoicesForPeriod({
        start: new Date("2026-11-01T00:00:00Z"), end: new Date("2026-11-15T23:59:59Z"), label: "Test",
      });
      expect(result.generated).toEqual([]);
      expect(result.skipped).toEqual([{
        sellerId: "seller", reason: `self-billing consent is version ${version}, needs 3.0`,
      }]);
    }
  } finally { globalThis.fetch = original; }
});

test("generation with missing snapshot migration stops before orders or financial writes", async () => {
  const original = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    expect(url.hostname).toBe("example.invalid");
    expect(init?.method ?? "GET").toBe("GET");
    calls.push(url.pathname);
    return Response.json({ code: "42703", message: "column does not exist" }, { status: 400 });
  };
  try {
    await expect(generateInvoicesForPeriod({
      start: new Date("2026-11-01T00:00:00Z"), end: new Date("2026-11-15T23:59:59Z"), label: "Test",
    })).rejects.toThrow("Apply 0038_invoice_operator_snapshots.sql");
    expect(calls).toEqual(["/rest/v1/invoices"]);
  } finally { globalThis.fetch = original; }
});

test("archived SV and TIR issue eras retain their original identity and bank", () => {
  expect(resolveInvoiceOperator(legacy("SV-2026-0001", "2026-08-31T20:59:59Z")))
    .toMatchObject({ regNr: "40103915568", iban: "LV08PARX0017085950001" });
  expect(resolveInvoiceOperator(legacy("TIR-2026-0001", "2026-08-31T21:00:00Z")))
    .toMatchObject({ regNr: "40203272626", iban: "LV72PARX0023541960001" });
  expect(resolveInvoiceOperator(legacy("TIR-2026-0002", "2026-11-08T21:59:59Z")))
    .toMatchObject({ regNr: "40203272626" });
});

test("ambiguous, inconsistent and invalid legacy rows never acquire guessed identities", () => {
  for (const row of [
    legacy("TIR-2026-0003", "2026-11-08T22:00:00Z"),
    legacy("TIR-2026-0004", "2026-11-10T16:00:00Z"),
    legacy("SV-2026-0001", "2026-09-01T00:00:00Z"),
    legacy("TIR-2026-0001", "2026-08-01T00:00:00Z"),
    legacy("SV-2025-0001", "2026-08-01T00:00:00Z"),
    legacy("OTHER-2026-0001", "2026-08-01T00:00:00Z"),
    legacy("SV-2026-0001", "not a date"),
    legacy("SV-2026-0001", "2026-01-01T00:00:00Z"),
  ]) expect(resolveInvoiceOperator(row), JSON.stringify(row)).toBeNull();
});

test("stored snapshots outrank numbering and current globals without being rewritten", () => {
  const snapshot = newInvoiceOperatorSnapshot();
  expect(snapshot.operator_version).toBe("svaigi-3.0");
  expect(snapshot.operator_snapshot.regNr).toBe("40103915568");
  const frozen = { ...snapshot.operator_snapshot, regNr: "historic-registration", iban: "historic-bank" };
  expect(resolveInvoiceOperator({
    ...legacy("TIR-2026-0001", "2026-10-01T00:00:00Z"),
    operator_version: "historic-reviewed", operator_snapshot: frozen,
  })).toEqual(frozen);
});

test("partial or corrupt snapshots do not fall back to a plausible legacy operator", () => {
  const row = legacy("TIR-2026-0001", "2026-10-01T00:00:00Z");
  for (const bad of [
    { operator_version: "2", operator_snapshot: {} },
    { operator_version: null, operator_snapshot: newInvoiceOperatorSnapshot().operator_snapshot },
    { operator_version: "2", operator_snapshot: null },
    { operator_version: "2", operator_snapshot: [] },
    { operator_version: "2", operator_snapshot: { ...newInvoiceOperatorSnapshot().operator_snapshot, iban: "" } },
  ]) expect(resolveInvoiceOperator({ ...row, ...bad })).toBeNull();
});

test("schema preflight fails explicitly before any write or numbering", async () => {
  const tables: string[] = [];
  function client(failingTable: string | null) {
    return {
      rpc: async () => ({ data: 1, error: null }),
      from(table: string) {
        tables.push(table);
        return { select: () => ({ limit: async () => ({
          error: table === failingTable ? { code: "42703" } : null,
        }) }) };
      },
    } as unknown as SupabaseClient;
  }
  await expect(assertInvoiceSchema(client("invoices"))).rejects.toThrow("0038_invoice_operator_snapshots.sql");
  expect(tables).toEqual(["invoices"]);
  tables.length = 0;
  await expect(assertInvoiceSchema(client("invoice_lines"))).rejects.toThrow("Invoice line schema unavailable");
  expect(tables).toEqual(["invoices", "invoice_lines"]);
  await expect(assertInvoiceSchema(client(null))).resolves.toBeUndefined();
});

test("new invoice generation persists operator snapshot using mocked backend only", async () => {
  const original = globalThis.fetch;
  let inserted: Record<string, unknown> | undefined;
  const calls: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    expect(url.hostname).toBe("example.invalid");
    calls.push(`${init?.method ?? "GET"} ${url.pathname}`);
    const table = url.pathname.split("/").pop();
    if (table === "invoice_generation_ready") return Response.json(1);
    const select = url.searchParams.get("select") ?? "";
    if ((table === "invoices" && select.includes("operator_snapshot")) ||
        (table === "invoice_lines" && select === "vat_rate,vat_amount_cents,ex_vat_cents")) {
      return Response.json([]);
    }
    if (table === "orders") return Response.json([{
      id: "order", order_number: "TEST-1", paid_at: "2026-11-01T12:00:00Z",
      seller_ids: ["seller"], items: [{ title: "Test", price: 12.1, quantity: 1, seller_id: "seller", vat_rate: 21,
        commission_rate: 15, seller_delivery_mode: "locker", seller_courier_fee_cents: 0 }],
    }]);
    if (table === "sellers") return Response.json([{
      id: "seller", user_id: "user", legal_name: "Test seller", bank_iban: "DUMMY",
      self_billing_agreed: true, self_billing_agreement_version: "3.0", delivery_mode: "locker",
    }]);
    if (table === "create_invoice_with_lines" && init?.method === "POST") {
      inserted = JSON.parse(String(init.body)).p_header;
      return Response.json({ id: "invoice", invoice_number: "TIR-2026-9999" });
    }
    if (table === "invoices" && (init?.method ?? "GET") === "GET") return Response.json(null);
    if (table === "push_subscriptions") return Response.json([]);
    throw new Error(`Unexpected mocked request: ${url.pathname}`);
  };
  try {
    const result = await generateInvoicesForPeriod({
      start: new Date("2026-11-01T00:00:00Z"), end: new Date("2026-11-15T23:59:59Z"), label: "Test",
    });
    expect(result.generated).toHaveLength(1);
    expect(inserted).toMatchObject({
      ...newInvoiceOperatorSnapshot(), total_commission_cents: 150,
      commission_vat_rate: 21, commission_vat_cents: 32, total_net_cents: 1028,
    });
    expect(calls[0]).toBe("GET /rest/v1/invoices");
    expect(calls[1]).toBe("GET /rest/v1/invoice_lines");
  } finally { globalThis.fetch = original; }
});

test("service VAT uses current stored columns and retains legacy values without recomputation", () => {
  expect(invoiceCommissionVat({ commission_vat_cents: 32, commission_vat_rate: 21,
    vat_amount_cents: 999, vat_rate: 5 })).toEqual({ cents: 32, rate: 21 });
  expect(invoiceCommissionVat({ commission_vat_cents: 0, commission_vat_rate: 21,
    vat_amount_cents: 999 })).toEqual({ cents: 0, rate: 21 });
  expect(invoiceCommissionVat({ vat_amount_cents: 87, vat_rate: 21 })).toEqual({ cents: 87, rate: 21 });
});

test("both invoice views use scoped identity and service VAT, retaining totals for unresolved rows", () => {
  for (const path of ["app/dashboard/rekini/[id]/page.tsx", "app/admin/rekini/[id]/page.tsx"]) {
    const page = source(path);
    expect(page).toContain("resolveInvoiceOperator(invoice)");
    expect(page).toContain("UNRESOLVED_INVOICE_OPERATOR");
    expect(page).toContain("invoiceCommissionVat(invoice)");
    expect(page).toContain("eur(invoice.total_net_cents)");
    expect(page).not.toContain("operatorInfo");
  }
});

test("v3 current terms match fixed commission while v1/v2 stay byte-identical", () => {
  for (const path of ["app/noteikumi/self-billing/page.tsx", "lib/legal/self-billing-agreement-v3.lv.md"]) {
    const text = source(path);
    expect(text).toContain("15 % no preču cenas bez preču PVN");
    expect(text).toContain("21 % PVN par komisijas pakalpojumu");
    expect(text).not.toContain("5 % līdz 20 %");
  }
  expect(commissionBreakdown(12.1, 21)).toMatchObject({
    exVat: 10, commissionNet: 1.5, commissionVat: 0.32, netToSeller: 10.28,
  });
  for (const version of [1, 2]) {
    const path = `lib/legal/self-billing-agreement-v${version}.lv.md`;
    expect(source(path)).toBe(execFileSync("git", [
      "show", `3e4a532:apps/tirgus/${path}`,
    ], { cwd: app, encoding: "utf8" }));
  }
});
