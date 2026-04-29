/**
 * Paysera integration — sign / verify / redirect.
 *
 * Modes (PAYSERA_MODE env):
 *  - "live" — production gateway, real payments
 *  - "test" — Paysera test mode (test=1 param), no real money
 *  - "mock" — skip Paysera entirely, simulate success (for E2E tests)
 *
 * Required env (when not in mock mode):
 *  - PAYSERA_PROJECT_ID
 *  - PAYSERA_SIGN_PASSWORD
 */

import crypto from "node:crypto";

export type PayseraMode = "live" | "test" | "mock";

export type PayseraParams = {
  orderNumber: string;
  amountCents: number;
  buyerEmail: string;
  buyerName: string;
  buyerPhone?: string;
  baseUrl: string; // Origin of our site, e.g. https://tirgus.izipizi.lv
};

export type PayseraCallbackResult =
  | { valid: false; reason: string }
  | { valid: true; params: Record<string, string>; orderNumber: string; status: string; amountCents: number };

export function getMode(): PayseraMode {
  const m = (process.env.PAYSERA_MODE ?? "test").toLowerCase();
  if (m === "live") return "live";
  if (m === "mock") return "mock";
  return "test";
}

/**
 * Build the URL that the user should be redirected to in order to start payment.
 * In mock mode, returns a local URL that lands the user on the success page directly.
 */
export function buildPayseraRedirectUrl(p: PayseraParams): string {
  const mode = getMode();

  if (mode === "mock") {
    return `${p.baseUrl}/cart/success?order=${encodeURIComponent(p.orderNumber)}&mock=1`;
  }

  const projectId = process.env.PAYSERA_PROJECT_ID;
  const password = process.env.PAYSERA_SIGN_PASSWORD;
  if (!projectId || !password) {
    throw new Error("PAYSERA_PROJECT_ID vai PAYSERA_SIGN_PASSWORD nav uzstādīts .env failā");
  }

  const [firstName, ...rest] = p.buyerName.split(/\s+/);

  const params: Record<string, string> = {
    projectid: projectId,
    orderid: p.orderNumber,
    accepturl: `${p.baseUrl}/cart/success?order=${encodeURIComponent(p.orderNumber)}`,
    cancelurl: `${p.baseUrl}/cart/cancel?order=${encodeURIComponent(p.orderNumber)}`,
    callbackurl: `${p.baseUrl}/api/webhooks/paysera`,
    amount: String(p.amountCents),
    currency: "EUR",
    country: "LV",
    version: "1.6",
    test: mode === "test" ? "1" : "0",
    lang: "LIT",
    paytext: `Pasūtījums ${p.orderNumber} — tirgus.izipizi.lv`,
    p_email: p.buyerEmail,
    p_firstname: firstName ?? "",
    p_lastname: rest.join(" "),
  };
  if (p.buyerPhone) params.p_phone = p.buyerPhone;

  const query = new URLSearchParams(params).toString();
  const data = urlSafeBase64Encode(query);
  const sign = md5(data + password);

  return `https://www.paysera.com/pay/?data=${data}&sign=${sign}`;
}

/**
 * Verify the data+sign pair from a Paysera callback.
 * Returns parsed params on success.
 */
export function verifyPayseraCallback(data: string, sign: string): PayseraCallbackResult {
  const mode = getMode();

  if (!data) return { valid: false, reason: "missing data" };

  let decoded: string;
  try {
    decoded = urlSafeBase64Decode(data);
  } catch {
    return { valid: false, reason: "invalid base64" };
  }

  if (mode !== "mock") {
    const password = process.env.PAYSERA_SIGN_PASSWORD;
    if (!password) return { valid: false, reason: "PAYSERA_SIGN_PASSWORD not set" };
    const expected = md5(data + password);
    if (sign !== expected) return { valid: false, reason: "signature mismatch" };
  }

  const params = parseQueryString(decoded);
  return {
    valid: true,
    params,
    orderNumber: params.orderid ?? "",
    status: params.status ?? "",
    amountCents: parseInt(params.amount ?? "0", 10),
  };
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function urlSafeBase64Encode(str: string): string {
  return Buffer.from(str, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function urlSafeBase64Decode(str: string): string {
  // Restore padding
  const padded = str + "=".repeat((4 - (str.length % 4)) % 4);
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function md5(s: string): string {
  return crypto.createHash("md5").update(s, "utf8").digest("hex");
}

function parseQueryString(qs: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of qs.split("&")) {
    if (!part) continue;
    const eq = part.indexOf("=");
    const k = eq === -1 ? part : part.slice(0, eq);
    const v = eq === -1 ? "" : part.slice(eq + 1);
    out[decodeURIComponent(k.replace(/\+/g, " "))] = decodeURIComponent((v ?? "").replace(/\+/g, " "));
  }
  return out;
}
