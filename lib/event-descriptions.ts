import { events } from "@/lib/events-data";

// Populated by scripts/generate-descriptions.mjs
let generated: Record<string, string> = {};
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  generated = require("./event-descriptions.json");
} catch {
  // File doesn't exist yet — use fallback descriptions below
}

export async function getEventDescription(id: string): Promise<string> {
  if (generated[id]) return generated[id];

  // Fallback: return the short description from mock data
  const event = events.find((e) => e.id === id);
  return event?.description ?? "";
}
