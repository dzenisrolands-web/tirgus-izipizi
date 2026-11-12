import type { Handoff, Acknowledgement } from "./marketplace-handoff";
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
type Configuration = { endpoint: string; approvedOrigin: string; token: string };

function configuration(input: Configuration): URL {
  const url = new URL(input.endpoint), origin = new URL(input.approvedOrigin);
  for (const value of [url, origin]) {
    if (value.protocol !== "https:" || value.username || value.password || value.search || value.hash
      || (value.port && value.port !== "443") || value.hostname.includes(":") || /^[0-9.]+$/.test(value.hostname)
      || !value.hostname.includes(".") || /(?:^|\.)(?:localhost|local|internal)$/.test(value.hostname)) {
      throw new Error("Invalid receiver configuration");
    }
  }
  if (origin.pathname !== "/" || url.origin !== origin.origin
    || !/^[A-Za-z0-9._~-]{32,512}$/.test(input.token)) throw new Error("Invalid receiver configuration");
  return url;
}

async function boundedJson(response: Response): Promise<unknown> {
  const limit = 16384;
  if (response.headers.get("content-type")?.toLowerCase().split(";")[0].trim() !== "application/json"
    || Number(response.headers.get("content-length")) > limit || !response.body) {
    throw new Error("Invalid receiver acknowledgement");
  }
  const reader = response.body.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) { await reader.cancel(); throw new Error("Invalid receiver acknowledgement"); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } finally { reader.releaseLock(); }
}

/** URL/token are approved server settings, never request-body destinations. */
export function createMarketplaceHttpTransport(input: Configuration): (job: Handoff) => Promise<Acknowledgement> {
  const endpoint = configuration(input);
  return async job => {
    if (!UUID.test(job.order_id) || job.source_key !== `marketplace/persisted_id/${job.order_id.toLowerCase()}`
      || !record(job.envelope) || job.envelope.schema !== "marketplace-order-v1"
      || !record(job.envelope.record) || job.envelope.record.id !== job.order_id) {
      throw new Error("Invalid handoff source identity");
    }
    const body = JSON.stringify(job.envelope);
    if (new TextEncoder().encode(body).length > 262144) throw new Error("Handoff exceeds transport limit");
    try {
      const response = await fetch(endpoint, {
        method: "POST", redirect: "error", cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer",
        signal: AbortSignal.timeout(8000),
        headers: { Authorization: `Bearer ${input.token}`, "Content-Type": "application/json",
          "Idempotency-Key": `marketplace-intake/${job.order_id.toLowerCase()}` },
        body,
      });
      if (![200, 201].includes(response.status) || response.redirected || response.url && new URL(response.url).origin !== endpoint.origin) {
        throw new Error("Invalid receiver acknowledgement");
      }
      const ack = await boundedJson(response);
      if (!record(ack) || ack.recorded !== true || ack.sourceKey !== job.source_key
        || ack.intakeVersion !== "logistics-intake-v1" || typeof ack.receiverId !== "string" || !UUID.test(ack.receiverId)
        || ack.dispatchAuthorized !== false || ack.billingAuthorized !== false) throw new Error("Invalid receiver acknowledgement");
      return { sourceKey: ack.sourceKey, receiverId: ack.receiverId, intakeVersion: ack.intakeVersion,
        dispatchAuthorized: false, billingAuthorized: false };
    } catch {
      // A timeout may have happened after a receiver commit. Never echo the
      // URL, token, customer envelope, provider body or transport exception.
      throw new Error("Receiver outcome requires reconciliation");
    }
  };
}

export function configuredMarketplaceHttpTransport() {
  const endpoint = process.env.MARKETPLACE_LOGISTICS_RECEIVER_URL;
  const approvedOrigin = process.env.MARKETPLACE_LOGISTICS_RECEIVER_ORIGIN;
  const token = process.env.MARKETPLACE_LOGISTICS_RECEIVER_TOKEN;
  if (!endpoint && !approvedOrigin && !token) return undefined;
  if (!endpoint || !approvedOrigin || !token) throw new Error("Incomplete receiver configuration");
  return createMarketplaceHttpTransport({ endpoint, approvedOrigin, token });
}
