import "../public-phase3/react-runtime";
import { test, expect } from "@playwright/test";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ZonesMap } from "../../components/zones-map";
import { FoundResult, NotFoundResult } from "../../components/postal-zone-lookup";
import Delivery from "../../app/piegade/page";
import How from "../../app/how-it-works/page";
import Home from "../../app/page";
import { GET as llms } from "../../app/llms.txt/route";
import { ZONE_PRICING, postalCodesByZone, lookupPostalCode } from "../../lib/postal-zones";
import { BUYER_LOCKER_FEE_CENTS } from "../../lib/delivery-policy";
import { formatPrice } from "../../lib/utils";
import { CartProvider } from "../../lib/cart-context";
import { StorageTypesProvider } from "../../lib/storage-types-context";

const originalFetch = globalThis.fetch;
test.beforeEach(() => {
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.origin !== "https://example.invalid") throw new Error("Non-dummy network forbidden");
    expect(init?.method ?? "GET").toBe("GET");
    return Response.json([]);
  };
});
test.afterEach(() => { globalThis.fetch = originalFetch; });
const text = (value: string) => value.replace(/\s+/g, " ").trim();
const render = (node: React.ReactNode) => load(renderToStaticMarkup(
  <CartProvider><StorageTypesProvider>{node}</StorageTypesProvider></CartProvider>,
));
const source = (path: string) => readFileSync(resolve(__dirname, "../..", path), "utf8");

test("postcode table renders the same gross matrix with no fictional geographic coverage", () => {
  const $ = render(<ZonesMap />);
  expect($("tbody tr")).toHaveLength(4);
  for (const zone of [0,1,2,3] as const) {
    const cells = $(`tr[data-zone="${zone}"] td`).toArray().map(element => text($(element).text()));
    const rate = ZONE_PRICING[zone];
    expect(cells).toEqual([
      formatPrice(rate.singleTemp), formatPrice(rate.dualTemp),
      rate.expressSingle === null ? "Nav publicēts" : formatPrice(rate.expressSingle),
      rate.expressDual === null ? "Nav publicēts" : formatPrice(rate.expressDual),
    ].map(text));
    for (const code of postalCodesByZone(zone)) expect($("details").text()).toContain(`LV-${code}`);
  }
  expect($("body").text()).not.toContain("Tukuma tirgus");
  expect($("body").text()).toContain("Ilūkstes");
  expect($("body").text()).not.toContain("km");
  expect($("body").text()).toContain("Tarifa aprēķins nav pārvadātāja maršruta");
  expect($("body").text()).toContain("arī divām temperatūrām");
  expect(source("components/zones-map.tsx")).not.toContain("leaflet");
  expect(source("components/zones-map.tsx")).not.toContain("POLYGON");
});

test("home, delivery and help display current per-producer prices instead of ambient or doubled-locker tariffs", async () => {
  const pages = [render(await Home()), render(<Delivery />), render(<How />)];
  for (const $ of pages) {
    const body = text($("body").text());
    expect(body).toContain(text(formatPrice(ZONE_PRICING[0].singleTemp)));
    expect(body).toContain(text(formatPrice(ZONE_PRICING[0].expressSingle!)));
    expect(body).toContain(text(formatPrice(BUYER_LOCKER_FEE_CENTS / 100)));
    expect(body).toContain("par ražotāju");
    expect(body).not.toMatch(/5[.,]45|6[.,]66|10[.,]77|skapītis|2 temperaturas zonas ×/);
    expect(body).not.toContain("attāluma līdz ražotājam");
  }
  expect(pages[1]("body").text()).toContain("Maksa netiek reizināta ar produktu skaitu");
});

test("lookup estimates show destination prices and all-item constraints without origin or distance promises", () => {
  for (const code of ["1001","1005","1016","2105"]) {
    const result = lookupPostalCode(code);
    expect(result.found).toBe(true);
    if (!result.found) throw new Error("Fixture code must exist");
    const $ = render(<FoundResult result={result} />);
    const body = text($("body").text());
    expect(body).toContain(text(formatPrice(result.pricing.singleTemp)));
    expect(body).toContain("Zonas tarifs");
    expect(body).toContain("visu produktu atļautajiem piegādes veidiem");
    expect(body).not.toMatch(/tuvāk|~[\d.]| km|skapītis/);
  }
  const unknown = lookupPostalCode("9999");
  if (unknown.found) throw new Error("Unknown fixture must fail closed");
  expect(render(<NotFoundResult result={unknown} />)("body").text()).toContain("nav mūsu sarakstā");
  const component = source("components/postal-zone-lookup.tsx");
  const editHandler = component.slice(component.indexOf("function handleAddressChange"), component.indexOf("\n  return ("));
  expect(editHandler).toContain("setResult(null)");
  expect(editHandler).toContain("setParsedAddress(null)");
  expect(editHandler).not.toContain("if (");
});

test("llms publishes current tariff ranges and exact coverage without changing closed-locker policy", async () => {
  const body = await (await llms()).text();
  expect(body).toContain("7.74 €–13.19 € per producer");
  expect(body).toContain("9.08 €–16.34 € per producer");
  expect(body).toContain("3.00 € once per producer and pickup destination, including dual temperature");
  expect(body).toContain("79 published destination postcodes");
  expect(body).toContain("No express tariff for zone 3");
  expect(body).toContain("every product permitting express");
  expect(body).not.toMatch(/5[.,]45|6[.,]66|10[.,]77|700\+|per producer cabinet|Tukuma tirgus/);
  expect(body).toContain("Ilūkstes");
});
