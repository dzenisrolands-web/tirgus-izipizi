/**
 * SMS sūtīšana caur Esteria API.
 *
 * Endpoint: https://api.esteria.eu/send (sūtīšana)
 *           https://api1.esteria.lv/status-xml (statusa pārbaude)
 *
 * Konfigurācija .env.local:
 *   ESTERIA_API_KEY=7efb246e2f
 *   ESTERIA_SENDER=IziPiziAPP
 *
 * Ierobežojumi:
 * - Tikai Latīņu burti (NO ā,č,ē,ģ,ī,ķ,ļ,ņ,š,ū,ž — automātiski transliterējam)
 * - Maks. 160 simboli (automātiski apgriežam)
 *
 * Lietojums:
 *   import { sendSms } from "@/lib/sms";
 *   const r = await sendSms("+37120031552", "Pasūtījums TRG-... gatavs! Kods: 1234");
 *   if (r.ok) console.log("messageId:", r.messageId);
 */

const SEND_URL = "https://api.esteria.eu/send";
const STATUS_URL = "https://api1.esteria.lv/status-xml";

const LATVIAN_MAP: Record<string, string> = {
  "ā": "a", "č": "c", "ē": "e", "ģ": "g", "ī": "i", "ķ": "k",
  "ļ": "l", "ņ": "n", "š": "s", "ū": "u", "ž": "z",
  "Ā": "A", "Č": "C", "Ē": "E", "Ģ": "G", "Ī": "I", "Ķ": "K",
  "Ļ": "L", "Ņ": "N", "Š": "S", "Ū": "U", "Ž": "Z",
};

export function latvianToLatin(text: string): string {
  return text.replace(/[āčēģīķļņšūžĀČĒĢĪĶĻŅŠŪŽ]/g, (ch) => LATVIAN_MAP[ch] ?? ch);
}

/** Trim to 160 chars; if longer, end with single ellipsis. */
function truncateForSms(text: string, max = 160): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "…".replace(/…/, "."); // single dot, valid Latin
}

/** Normalize Latvian phone number — accepts +37120000000, 20000000, "+371 2000 0000" etc. */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("371")) return "+" + digits;
  if (digits.length === 8) return "+371" + digits;
  return digits;
}

export type SmsResult = {
  ok: boolean;
  messageId?: string;
  error?: string;
};

export async function sendSms(phone: string, text: string): Promise<SmsResult> {
  const apiKey = process.env.ESTERIA_API_KEY;
  const sender = process.env.ESTERIA_SENDER ?? "IziPiziAPP";

  if (!apiKey) {
    return { ok: false, error: "ESTERIA_API_KEY nav uzstādīts .env.local failā" };
  }

  const cleanedPhone = normalizePhone(phone);
  const cleanedText = truncateForSms(latvianToLatin(text), 160);

  const url = new URL(SEND_URL);
  url.searchParams.set("api-key", apiKey);
  url.searchParams.set("sender", sender);
  url.searchParams.set("number", cleanedPhone);
  url.searchParams.set("text", cleanedText);

  try {
    const res = await fetch(url.toString(), { method: "GET" });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status} no Esteria API` };
    }
    const messageId = (await res.text()).trim();
    if (!messageId || messageId.length < 6) {
      return { ok: false, error: `Nederīgs atbildes formāts: "${messageId}"` };
    }
    return { ok: true, messageId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Nezināma kļūda" };
  }
}

export type SmsStatus = {
  found: boolean;
  time?: string;
  number?: string;
  statusDescription?: string;
  errorDescription?: string;
  processingTime?: string;
};

export async function checkSmsStatus(messageId: string): Promise<SmsStatus> {
  const apiKey = process.env.ESTERIA_API_KEY;
  if (!apiKey || messageId.length < 6) return { found: false };

  const url = new URL(STATUS_URL);
  url.searchParams.set("api-key", apiKey);
  url.searchParams.set("id", messageId);

  try {
    const res = await fetch(url.toString());
    const xml = await res.text();
    const get = (tag: string): string => {
      const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`);
      const m = xml.match(re);
      return m ? m[1].trim() : "";
    };
    return {
      found: true,
      time: get("time"),
      number: get("number"),
      statusDescription: get("status_description"),
      errorDescription: get("error_description"),
      processingTime: get("p_time"),
    };
  } catch {
    return { found: false };
  }
}
