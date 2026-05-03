import { NextRequest } from "next/server";
import {
  GoogleGenerativeAI,
  type FunctionDeclaration,
  type Content,
  type Part,
  SchemaType,
} from "@google/generative-ai";
import { TOOL_DECLARATIONS, dispatchTool } from "@/lib/assistant-tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Per-IP rate limit (in-memory; resets on cold start — fine for MVP)
const RATE_LIMIT = 30; // req per window
const RATE_WINDOW_MS = 60_000;
const ipHits = new Map<string, { count: number; resetAt: number }>();

const SYSTEM_INSTRUCTION = `Tu esi tirgus.izipizi.lv AI asistents — palīdzi pircējiem atrast produktus, izprast pirkšanas procesu un atbildi uz jautājumiem par lapu.

Konteksts:
- tirgus.izipizi.lv ir Latvijas vietējo ražotāju online tirgus.
- Produkti tiek piegādāti caur izipizi pakomātu tīklu (3€/pakomāts) vai ar kurjeru (no 5€).
- Maksājumi caur Paysera.
- Operators: SIA Svaigi.

Rīcības principi:
1. Vienmēr atbildi LATVIEŠU valodā.
2. Esi īss un konkrēts — 1–3 teikumi vai bullet list.
3. Kad lietotājs prasa produktu/-us, vienmēr izsauc 'search_products' un atgriez rezultātus.
4. Kad jautā par piegādi, maksājumu, atgriešanu — izsauc 'get_help_topic' lai dabūtu aktuālo informāciju.
5. Nevirtulizē atbildes — ja nevari atrast produktu, saki tieši: "Šobrīd tāda produkta nav."
6. Nepiedāvā konkurējošas lapas. Visi ieteikumi paliek tirgus.izipizi.lv robežās.
7. Ja lietotājs prasa kā veikt pirkumu: 1) Pievieno grozam → 2) Atver grozu → 3) Izvēlies pakomātu vai kurjeru → 4) Apstiprini un maksā ar Paysera → 5) Saņem SMS ar pakomāta kodu.
8. Ja lietotājs grib kļūt par pārdevēju — izsauc 'get_help_topic' ar 'becoming_seller'.

Formatēšana:
- Produktus piemini ar formātu [Nosaukums](URL) — €cena/vienība, no Ražotājs.
- Nelieto markdown headerus (#, ##). Lieto tikai bullet list (-) un bold (**).`;

function getIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
}

function checkRate(ip: string): boolean {
  const now = Date.now();
  const entry = ipHits.get(ip);
  if (!entry || entry.resetAt < now) {
    ipHits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count += 1;
  return true;
}

// Convert our JSON-Schema-ish tool declarations to Gemini's SchemaType enum form
function toGeminiTools(): { functionDeclarations: FunctionDeclaration[] } {
  const decls = TOOL_DECLARATIONS.map((t) => {
    const props: Record<string, { type: SchemaType; description?: string }> = {};
    const rawProps = t.parameters?.properties ?? {};
    for (const [k, v] of Object.entries(rawProps)) {
      const def = v as { type: string; description?: string };
      props[k] = {
        type: def.type === "number" ? SchemaType.NUMBER : SchemaType.STRING,
        description: def.description,
      };
    }
    return {
      name: t.name,
      description: t.description,
      parameters: {
        type: SchemaType.OBJECT,
        properties: props,
        required: (t.parameters as { required?: string[] }).required ?? [],
      },
    } as FunctionDeclaration;
  });
  return { functionDeclarations: decls };
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "GEMINI_API_KEY nav uzstādīts" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  const ip = getIp(req);
  if (!checkRate(ip)) {
    return new Response(JSON.stringify({ error: "Pārāk daudz pieprasījumu — pamēģini pēc minūtes" }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { messages?: Array<{ role: string; content: string }> };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Nevalīds JSON" }), { status: 400 });
  }

  const messages = body.messages ?? [];
  if (!messages.length) {
    return new Response(JSON.stringify({ error: "Tukšs ziņojums" }), { status: 400 });
  }

  // Keep only last 10 messages to bound token cost
  const trimmed = messages.slice(-10);

  // Convert client-format messages into Gemini history format.
  // Last message is the user's current query; everything before is history.
  const history: Content[] = trimmed.slice(0, -1).map((m) => ({
    role: m.role === "user" ? "user" : "model",
    parts: [{ text: m.content }] as Part[],
  }));
  const userMsg = trimmed[trimmed.length - 1];
  if (userMsg.role !== "user") {
    return new Response(JSON.stringify({ error: "Pēdējam ziņojumam jābūt no user" }), { status: 400 });
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: SYSTEM_INSTRUCTION,
    tools: [toGeminiTools()],
  });

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));

      try {
        const chat = model.startChat({ history });
        type Pending =
          | { kind: "text"; text: string }
          | { kind: "fnResponses"; parts: Part[] };
        let pending: Pending = { kind: "text", text: userMsg.content };
        let safety = 0;

        while (safety++ < 5) {
          const result =
            pending.kind === "text"
              ? await chat.sendMessage(pending.text)
              : await chat.sendMessage(pending.parts);
          const calls = result.response.functionCalls();
          if (calls && calls.length > 0) {
            const responseParts: Part[] = [];
            for (const call of calls) {
              send("tool", { name: call.name });
              const out = await dispatchTool(call.name, (call.args ?? {}) as Record<string, unknown>);
              // When products are returned, also stream them as a separate event
              // so the client can render real product cards (not just text links).
              if (call.name === "search_products" && Array.isArray(out)) {
                send("products", out);
              }
              responseParts.push({
                functionResponse: { name: call.name, response: { result: out } },
              } as Part);
            }
            pending = { kind: "fnResponses", parts: responseParts };
            continue;
          }
          // No more tool calls — get final text and stream it
          const text = result.response.text();
          // Send in chunks for a typing-like feel
          const CHUNK = 24;
          for (let i = 0; i < text.length; i += CHUNK) {
            send("token", text.slice(i, i + CHUNK));
            await new Promise((r) => setTimeout(r, 12));
          }
          send("done", {});
          break;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        send("error", { message: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
