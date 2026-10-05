/**
 * MailerLite API v2 integration.
 * Server-side only.
 */

const API_BASE = "https://connect.mailerlite.com/api";

function headers(): Record<string, string> {
  const key = process.env.MAILERLITE_API_KEY;
  if (!key) throw new Error("MAILERLITE_API_KEY not set");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
  };
}

/**
 * Add a subscriber to the configured MailerLite group.
 * Idempotent — if the subscriber already exists, updates their fields.
 */
export async function addSubscriber(email: string, name?: string): Promise<{ ok: boolean; error?: string }> {
  const groupId = process.env.MAILERLITE_GROUP_ID;

  try {
    const body: Record<string, unknown> = {
      email,
      ...(name ? { fields: { name } } : {}),
      ...(groupId ? { groups: [groupId] } : {}),
    };

    const res = await fetch(`${API_BASE}/subscribers`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body),
    });

    if (res.ok || res.status === 200 || res.status === 201) {
      return { ok: true };
    }

    const err = await res.json().catch(() => ({}));
    return { ok: false, error: err.message ?? `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}
