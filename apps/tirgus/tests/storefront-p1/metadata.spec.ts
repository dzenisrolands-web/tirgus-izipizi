import "../public-phase3/react-runtime";
import { test, expect } from "@playwright/test";
import ts from "typescript";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { resolveTitle } from "next/dist/lib/metadata/resolvers/resolve-title";
import { generateMetadata as listingMetadata } from "../../app/listing/[id]/page";
import { generateMetadata as sellerMetadata } from "../../app/seller/[id]/page";
import sitemap from "../../app/sitemap";

const app = resolve(__dirname, "../..");
const source = (file: string) => readFileSync(join(app, file), "utf8");
const brand = "tirgus.izipizi.lv";
const template = '%s | tirgus.izipizi.lv';
const product = { id: "11111111-1111-4111-8111-111111111111", slug: "synthetic-product",
  title: "Sintētisks produkts", description: "Sintētisks apraksts", price: 4.35, unit: "gab.",
  quantity: 1, category: "Iepakotā pārtika", storage_type: "chilled",
  seller_id: "22222222-2222-4222-8222-222222222222", updated_at: "2026-11-01T00:00:00Z" };
const seller = { id: product.seller_id, name: "Sintētisks ražotājs", farm_name: "Sintētiska saimniecība",
  status: "approved", location: "Rīga", updated_at: product.updated_at };
let original: typeof fetch;
test.beforeEach(() => {
  original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    expect(url.origin).toBe("https://example.invalid");
    expect(init?.method ?? "GET").toBe("GET");
    const columns = url.searchParams.get("select") ?? "";
    if (url.pathname === "/rest/v1/listings") return Response.json(columns.includes("updated_at") || url.searchParams.has("seller_id") ? [product] : product);
    if (url.pathname === "/rest/v1/sellers_public") return Response.json(columns.includes("updated_at") ? [seller] : seller);
    throw new Error("No private or provider requests allowed");
  };
});
test.afterEach(() => { globalThis.fetch = original; });

function titleIn(file: string): string | undefined {
  const ast = ts.createSourceFile(file, source(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  for (const statement of ast.statements) if (ts.isVariableStatement(statement)) {
    for (const declaration of statement.declarationList.declarations) {
      if (declaration.name.getText(ast) !== "metadata" || !declaration.initializer || !ts.isObjectLiteralExpression(declaration.initializer)) continue;
      const property = declaration.initializer.properties.find(p => ts.isPropertyAssignment(p) && p.name.getText(ast) === "title");
      if (property && ts.isPropertyAssignment(property) && ts.isStringLiteralLike(property.initializer)) return property.initializer.text;
    }
  }
}
test("all sitemap route titles avoid duplication; child routes receive one layout suffix", async () => {
  expect(source("app/layout.tsx")).toContain(`template: "${template}"`);
  const entries = await sitemap();
  expect(entries.length).toBeGreaterThan(10);
  for (const entry of entries) {
    const path = new URL(entry.url).pathname;
    const metadata = path.startsWith("/listing/")
      ? await listingMetadata({ params: Promise.resolve({ id: product.slug }) })
      : path.startsWith("/seller/")
        ? await sellerMetadata({ params: Promise.resolve({ id: seller.id }) })
        : { title: titleIn(`app${path === "/" ? "" : path}/page.tsx`) };
    expect(typeof metadata.title, entry.url).toBe("string");
    expect(metadata.title, entry.url).not.toContain(brand);
    // The root page is in the template's own segment; Next does not apply
    // the layout template to it. Child route segments receive the suffix.
    const rendered = resolveTitle(metadata.title, path === "/" ? null : template);
    expect(rendered?.absolute.split(brand).length, entry.url).toBe(path === "/" ? 1 : 2);
    if (path !== "/") expect(rendered?.absolute, entry.url).toMatch(/\| tirgus\.izipizi\.lv$/);
  }
});
test("no page or nested layout title declaration carries the root layout suffix", () => {
  const pages = readdirSync(join(app, "app"), { recursive: true })
    .filter(name => typeof name === "string" && /(?:page|layout)\.tsx$/.test(name) && name !== "layout.tsx") as string[];
  for (const file of pages) {
    const text = source(`app/${file}`);
    expect(text, file).not.toMatch(/(?:title\s*:|const title\s*=)[^\n]*(?:\||—|–|-)\s*tirgus\.izipizi\.lv["'`]/);
  }
});
