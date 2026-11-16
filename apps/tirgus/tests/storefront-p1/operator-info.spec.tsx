import "../public-phase3/react-runtime";
import { test, expect } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { operatorInfo, formattedAddress, footerRekviziti, siteFooterLine, emailFooterLine, invoiceHeader } from "../../lib/operator-info";
import { legacySelfBillingOperatorInfo, legacySelfBillingFormattedAddress } from "../../lib/legal/legacy-self-billing-operator";
import { SELF_BILLING_VERSION, SELF_BILLING_EFFECTIVE_DATE, needsReconsent } from "../../lib/legal/self-billing";
import AboutPage from "../../app/par-mums/page";
import TermsPage from "../../app/noteikumi/page";
import PrivacyPage from "../../app/privatums/page";
import ReturnsPage from "../../app/atgriesana/page";
import SelfBillingPage from "../../app/noteikumi/self-billing/page";
import { GET as llms } from "../../app/llms.txt/route";

const root = resolve(__dirname, "../..");
const source = (path: string) => readFileSync(resolve(root, path), "utf8");
const text = (node: React.ReactNode) => load(renderToStaticMarkup(node))("body").text().replace(/\s+/g, " ");

test("public Svaigi identity matches the archived legal details, not the IziPizi entity", () => {
  const archive = source("lib/legal/self-billing-agreement-v1.lv.md");
  expect(operatorInfo).toMatchObject({
    legalName: 'Sabiedrība ar ierobežotu atbildību "Svaigi"',
    shortName: "SIA Svaigi", registrationNumber: "40103915568", vatNumber: "LV40103915568",
    legalAddress: { street: "Margrietas iela 7", city: "Rīga", postalCode: "LV-1046", country: "Latvija" },
    bank: { name: "AS Citadele banka", iban: "LV08PARX0017085950001", bic: "PARXLV22" },
  });
  for (const value of [operatorInfo.legalName, operatorInfo.registrationNumber, operatorInfo.vatNumber, formattedAddress(), operatorInfo.bank.iban]) {
    expect(archive).toContain(value);
  }
  expect(operatorInfo.contact.publicWebsite).toBe("https://izipizi.lv");
  expect(operatorInfo.contact.website).toBe("https://tirgus.izipizi.lv");
});

test("current footer and transaction-email helpers use Svaigi without changing the brand", () => {
  expect(siteFooterLine()).toBe("SIA Svaigi · Reģ. Nr. 40103915568 · PVN reģ. Nr. LV40103915568 · Margrietas iela 7, Rīga, LV-1046");
  for (const line of [footerRekviziti(), siteFooterLine(), emailFooterLine()]) {
    expect(line).toContain("Svaigi");
    expect(line).toContain("40103915568");
    expect(line).not.toMatch(/40203272626|Miltu cehs/);
  }
  expect(emailFooterLine()).toContain("tirgus.izipizi.lv");
  expect(source("app/layout.tsx")).toContain("siteFooterLine()");
  expect(source("app/layout.tsx")).toContain('brand: { "@type": "Brand", name: operatorInfo.brandName }');
  expect(source("app/layout.tsx")).toContain("legalName: operatorInfo.legalName");
});

for (const [name, page] of [["about", AboutPage], ["terms", TermsPage], ["privacy", PrivacyPage], ["returns", ReturnsPage]] as const) {
  test(`${name} public SSR identifies Svaigi with the historical registration number`, () => {
    const rendered = text(page());
    expect(rendered).toContain("Svaigi");
    expect(rendered).toContain("40103915568");
    expect(rendered).not.toMatch(/40203272626|Miltu cehs/);
    if (name === "about" || name === "terms") {
      expect(rendered).toContain(operatorInfo.brandRelationship);
      expect(rendered).toContain("maksājumu saņēmējs ir SIA Svaigi");
    }
  });
}

test("public AI information names the intended Svaigi recipient and keeps the IziPizi brand", async () => {
  const response = await llms();
  const rendered = await response.text();
  expect(rendered).toContain("SIA Svaigi (reg. nr. 40103915568, VAT LV40103915568, Margrietas iela 7, Rīga, LV-1046)");
  expect(rendered).toContain("Marketplace payment recipient**: SIA Svaigi");
  expect(rendered).toContain(operatorInfo.brandRelationship);
  expect(rendered).not.toContain("40203272626");
  expect(source("components/cart-page.tsx")).toContain("Maksājumu saņēmējs: {operatorInfo.shortName}");
});

test("legacy billing headers keep the exact previous identity, bank and number prefix", () => {
  expect(legacySelfBillingOperatorInfo).toMatchObject({
    shortName: "SIA IziPizi", registrationNumber: "40203272626", vatNumber: "LV40203272626",
    bank: { iban: "LV72PARX0023541960001" }, invoice: { numberPrefix: "TIR-" },
  });
  expect(legacySelfBillingFormattedAddress()).toBe('"Miltu cehs", Ogresgala pag., Ogres nov., LV-5041, Latvija');
  expect(invoiceHeader()).toEqual({
    name: 'Sabiedrība ar ierobežotu atbildību "IziPizi"', regNr: "40203272626", vatNr: "LV40203272626",
    address: legacySelfBillingFormattedAddress(), phone: "+371 20031552", email: "tirgus@izipizi.lv",
    bankName: "AS Citadele banka", iban: "LV72PARX0023541960001", bic: "PARXLV22",
  });
  for (const file of ["app/admin/rekini/[id]/page.tsx", "app/dashboard/rekini/[id]/page.tsx", "app/dashboard/rekini/page.tsx", "components/seller-legal-section.tsx"]) {
    expect(source(file)).toContain('from "@/lib/legal/legacy-self-billing-operator"');
    expect(source(file)).not.toContain('from "@/lib/operator-info"');
  }
});

test("existing v2 agreement and consent are not silently rewritten to a different legal person", () => {
  const rendered = text(SelfBillingPage());
  expect(rendered).toContain("Versija 2.0");
  expect(rendered).toContain('Sabiedrība ar ierobežotu atbildību "IziPizi"');
  expect(rendered).toContain("40203272626");
  expect(rendered).not.toContain("40103915568");
  expect(SELF_BILLING_VERSION).toBe("2.0");
  expect(SELF_BILLING_EFFECTIVE_DATE).toBe("2026-09-01");
  expect(needsReconsent("2.0")).toBe(false);
  expect(needsReconsent("1.0")).toBe(true);
  for (const [file, hash] of [
    ["lib/legal/self-billing-agreement-v1.lv.md", "addc89a72811f86e6fba5cbe35c41241d1242c06b615fac589291f3f37bd0664"],
    ["lib/legal/self-billing-agreement-v2.lv.md", "99825fe68a80a9658208253169c9d9adae54cbdaf2d792dda29165fe6f2f30d7"],
  ]) expect(createHash("sha256").update(source(file)).digest("hex")).toBe(hash);
});

for (const file of readdirSync(resolve(root, "email-templates/auth")).filter(file => file.endsWith(".html"))) {
  test(`Auth source template ${file} uses Svaigi and preserves the authentication placeholder`, () => {
    const html = source(`email-templates/auth/${file}`);
    expect(html).toContain("SIA &quot;Svaigi&quot; · Reģ. Nr. 40103915568 · Margrietas iela 7, Rīga, LV-1046");
    expect(html).not.toMatch(/40203272626|Miltu cehs/);
    expect(html).toContain("{{ .ConfirmationURL }}");
    expect(html).toContain("https://tirgus.izipizi.lv/izipizi-logo.png");
  });
}

test("public identity does not become an authority for Paysera merchant routing", () => {
  expect(operatorInfo.paysera.projectId).toBe("210216"); // Historical reference, not verified as a Svaigi merchant.
  expect(source("lib/paysera.ts")).toContain("PAYSERA_PROJECT_ID");
  for (const file of ["lib/paysera.ts", "app/api/checkout/create-session/route.ts", "app/api/checkout/retry-payment/route.ts", "app/api/webhooks/paysera/route.ts"]) {
    expect(source(file)).not.toContain("operator-info");
    expect(source(file)).not.toContain("40103915568");
  }
  expect(source("../../docs/PAYSERA_SETUP.md")).toContain("Rekvizītu labojums kodā nepārslēdz maksājumu saņēmēju");
});
