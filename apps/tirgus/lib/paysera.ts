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
  if (m === "mock" && process.env.NODE_ENV !== "production") return "mock";
  if (m === "test") return "test";
  throw new Error("Invalid or production-disabled Paysera mode");
}

/** Never derive payment return URLs from untrusted Host/forwarding headers. */
export function trustedPaymentBaseUrl(): string {
  const url = new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://tirgus.izipizi.lv");
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/"
    || (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.protocol === "http:" && url.hostname === "localhost"))) {
    throw new Error("Invalid payment site origin");
  }
  return url.origin;
}

/**
 * Build the URL that the user should be redirected to in order to start payment.
 * In mock mode, returns a local URL that lands the user on the success page directly.
 */
export function buildPayseraRedirectUrl(p: PayseraParams): string {
  const mode = getMode();
  if (!Number.isSafeInteger(p.amountCents) || p.amountCents < 0 || !/^[A-Za-z0-9-]{1,40}$/.test(p.orderNumber)) {
    throw new Error("Invalid payment order or amount");
  }

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
    lang: "LAT",
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
  let mode: PayseraMode;
  try { mode = getMode(); } catch { return { valid: false, reason: "payment mode unavailable" }; }
  if (!data || data.length > 16384) return { valid: false, reason: "missing or oversized data" };
  const password = process.env.PAYSERA_SIGN_PASSWORD;
  if (!password) return { valid: false, reason: "signing not configured" };
  // ss1 and legacy sign both use MD5(data + password); never accept unsigned mock callbacks.
  if (!/^[a-fA-F0-9]{32}$/.test(sign)
    || !crypto.timingSafeEqual(Buffer.from(sign, "hex"), Buffer.from(md5(data + password), "hex"))) {
    return { valid: false, reason: "signature mismatch" };
  }

  let params: Record<string, string>;
  try {
    params = parseQueryString(urlSafeBase64Decode(data));
  } catch {
    return { valid: false, reason: "malformed callback data" };
  }

  if (!process.env.PAYSERA_PROJECT_ID || params.projectid !== process.env.PAYSERA_PROJECT_ID) {
    return { valid: false, reason: "project mismatch" };
  }
  if (params.currency !== "EUR") {
    return { valid: false, reason: "currency mismatch" };
  }
  if ((params.payamount === undefined) !== (params.paycurrency === undefined)
    || (params.paycurrency !== undefined && !/^[A-Z]{3}$/.test(params.paycurrency))) {
    return { valid: false, reason: "invalid actual payment fields" };
  }
  if (params.test !== (mode === "live" ? "0" : "1")) {
    return { valid: false, reason: "test mode mismatch" };
  }
  if (!/^[A-Za-z0-9-]{1,40}$/.test(params.orderid ?? "") || !/^[01234]$/.test(params.status ?? "")) {
    return { valid: false, reason: "invalid order or status" };
  }
  for (const key of ["amount", ...(params.payamount !== undefined ? ["payamount"] : [])]) {
    if (!/^(0|[1-9][0-9]*)$/.test(params[key] ?? "") || !Number.isSafeInteger(Number(params[key]))) {
      return { valid: false, reason: "invalid amount" };
    }
  }
  return {
    valid: true,
    params,
    orderNumber: params.orderid ?? "",
    status: params.status ?? "",
    amountCents: Number(params.amount),
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
  if (!/^[A-Za-z0-9_-]+={0,2}$/.test(str) || str.length % 4 === 1) throw new Error("Invalid base64");
  const buffer = Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  if (buffer.toString("base64url") !== str.replace(/=+$/, "")
    || (str.includes("=") && buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_") !== str)) {
    throw new Error("Non-canonical base64");
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
}

function md5(s: string): string {
  return crypto.createHash("md5").update(s, "utf8").digest("hex");
}

function parseQueryString(qs: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of qs.split("&")) {
    if (!part) throw new Error("Empty parameter");
    const eq = part.indexOf("=");
    if (eq < 1) throw new Error("Malformed parameter");
    const k = part.slice(0, eq);
    const v = eq === -1 ? "" : part.slice(eq + 1);
    const key = decodeURIComponent(k.replace(/\+/g, " "));
    if (Object.hasOwn(out, key) || ["__proto__", "constructor", "prototype"].includes(key)) throw new Error("Duplicate or unsafe parameter");
    out[key] = decodeURIComponent(v.replace(/\+/g, " "));
  }
  return out;
}
