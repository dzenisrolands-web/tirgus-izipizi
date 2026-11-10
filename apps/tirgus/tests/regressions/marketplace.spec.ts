import { test, expect } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { operatorInfo, footerRekviziti, invoiceHeader } from "../../lib/operator-info";
import { SELF_BILLING_VERSION, needsReconsent } from "../../lib/legal/self-billing";
import { FIRST_ORDER_PROMO_ENABLED, isDisabledFirstOrderPromo } from "../../lib/promo-policy";
import { validatePromoCode } from "../../lib/promo";
import { publicProductImage, PRODUCT_IMAGE_PLACEHOLDER } from "../../lib/product-image";
import { mapRow, fetchActiveListings } from "../../lib/db-listings";
import { isPublicReady } from "../../lib/utils";

const app = resolve(__dirname, "../..");
const source = (path: string) => readFileSync(resolve(app, path), "utf8");
const row = {
  id: "product", seller_id: "seller", title: "Āboli", price: 3,
  image_url: null, created_at: "2026-11-01T00:00:00Z",
  category: "Augļi", unit: "kg", quantity: 5,
};

test("patched stable Next and matching ESLint config, with paired React versions", () => {
  const pkg = JSON.parse(source("package.json"));
  const version = pkg.dependencies.next;
  expect(version).toMatch(/^\d+\.\d+\.\d+$/);
  const [major, minor, patch] = version.split(".").map(Number);
  expect(major > 16 || (major === 16 && (minor > 4 || (minor === 4 && patch >= 6)))).toBe(true);
  expect(pkg.devDependencies["eslint-config-next"]).toBe(version);
  expect(pkg.dependencies.react).toBe(pkg.dependencies["react-dom"]);
});

test("Svaigi identity reaches legal, footer, and invoice headers; numbering and Paysera stay unchanged", () => {
  expect(operatorInfo.shortName).toBe("SIA Svaigi");
  expect(operatorInfo.registrationNumber).toBe("40103915568");
  expect(operatorInfo.vatNumber).toBe("LV40103915568");
  expect(footerRekviziti()).toContain("Margrietas iela 7, Rīga, LV-1046");
  expect(invoiceHeader().name).toContain('"Svaigi"');
  expect(operatorInfo.invoice.numberPrefix).toBe("TIR-");
  expect(operatorInfo.paysera.projectId).toBe("210216");
});

test("restored Citadele IBAN passes ISO mod-97 checksum", () => {
  const iban = operatorInfo.bank.iban;
  expect(iban).toHaveLength(21);
  const numeric = (iban.slice(4) + iban.slice(0, 4)).replace(/[A-Z]/g, c => String(c.charCodeAt(0) - 55));
  expect(BigInt(numeric) % BigInt(97)).toBe(BigInt(1));
});

test("all five Auth email templates identify Svaigi", () => {
  const files = readdirSync(resolve(app, "email-templates/auth")).filter(f => f.endsWith(".html"));
  expect(files).toHaveLength(5);
  for (const file of files) {
    const html = source(`email-templates/auth/${file}`);
    expect(html).toContain("SIA &quot;Svaigi&quot; · Reģ. Nr. 40103915568");
    expect(html).not.toContain("40203272626");
  }
});

test("payment processing, invoice generation, and historical agreements match the reviewed base", () => {
  for (const path of [
    "lib/paysera.ts", "lib/invoice/generate.ts",
    "app/api/checkout/create-session/route.ts", "app/api/webhooks/paysera/route.ts",
    "lib/legal/self-billing-agreement-v1.lv.md", "lib/legal/self-billing-agreement-v2.lv.md",
  ]) {
    const original = execFileSync("git", [
      "show", `aa88b6575a4146e630bf24f40af5683825675305:apps/tirgus/${path}`,
    ], { cwd: app, encoding: "utf8" });
    expect(source(path), path).toBe(original);
  }
});

test("v3 agreement requires renewed consent without rewriting earlier versions", () => {
  expect(SELF_BILLING_VERSION).toBe("3.0");
  expect(needsReconsent("1.0")).toBe(true);
  expect(needsReconsent("2.0")).toBe(true);
  expect(needsReconsent("3.0")).toBe(false);
  expect(source("lib/legal/self-billing-agreement-v3.lv.md")).toContain("40103915568");
});

test("PIRMAIS is rejected case-insensitively before any backend call", async () => {
  expect(FIRST_ORDER_PROMO_ENABLED).toBe(false);
  expect(isDisabledFirstOrderPromo(" pirmAis ")).toBe(true);
  expect(isDisabledFirstOrderPromo("OTHER")).toBe(false);
  const original = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("Disabled promo must not query a backend"); };
  try {
    expect(await validatePromoCode(" pirmais ", null, 300)).toMatchObject({ valid: false });
  } finally { globalThis.fetch = original; }
});

test("signup and profile first-order promotions are gated; cart prompt is generic", () => {
  expect(source("components/buyer-signup-form.tsx").match(/\{FIRST_ORDER_PROMO_ENABLED &&/g)).toHaveLength(2);
  expect(source("components/buyer-profile.tsx").match(/\{FIRST_ORDER_PROMO_ENABLED &&/g)).toHaveLength(1);
  expect(source("components/cart-page.tsx")).toContain('placeholder="Ievadi promo kodu"');
  expect(source("components/cart-page.tsx")).not.toContain('placeholder="PIRMAIS"');
});

test("missing, invalid, and bare-domain photos use a neutral placeholder", () => {
  for (const value of [null, undefined, "", " ", "/", "//example.com/a.png",
    "https://example.com/", "javascript:alert(1)", "https://u:p@example.com/a.png"]) {
    expect(publicProductImage(value)).toBe(PRODUCT_IMAGE_PLACEHOLDER);
  }
  expect(publicProductImage("https://example.com/a.png")).toBe("https://example.com/a.png");
  expect(publicProductImage("/images/a.png")).toBe("/images/a.png");
  expect(source("public/images/product-placeholder.svg")).toContain("Attēls vēl nav pievienots");
  expect(source("app/catalog/page.tsx")).toContain("image: publicProductImage(row.image_url)");
});

test("positive-price products without photos survive public visibility, zero-price products do not", () => {
  const product = mapRow(row, null);
  expect(product.image).toBe(PRODUCT_IMAGE_PLACEHOLDER);
  expect(isPublicReady(product)).toBe(true);
  expect(isPublicReady(mapRow({ ...row, price: 0 }, null))).toBe(false);
});

test("active listing fetch keeps active filter and public seller view", async () => {
  const calls: URL[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    calls.push(url);
    if (url.pathname.endsWith("/listings")) {
      return Response.json([row, { ...row, id: "zero", price: 0 }]);
    }
    if (url.pathname.endsWith("/sellers_public")) {
      return Response.json([{ id: "seller", name: "Ražotājs", status: "approved" }]);
    }
    throw new Error(`Unexpected request: ${url.pathname}`);
  };
  try {
    const products = await fetchActiveListings();
    expect(products.map(p => p.id)).toEqual(["product"]);
    expect(calls.find(u => u.pathname.endsWith("/listings"))?.searchParams.get("status")).toBe("eq.active");
    expect(calls.some(u => u.pathname.endsWith("/sellers_public"))).toBe(true);
  } finally { globalThis.fetch = original; }
});
