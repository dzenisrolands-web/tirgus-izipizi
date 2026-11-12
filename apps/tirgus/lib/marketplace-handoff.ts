import type { SupabaseClient } from "@supabase/supabase-js";
import { marketplaceLifecycleEnabled } from "./marketplace-lifecycle";
import { configuredMarketplaceHttpTransport } from "./marketplace-handoff-http";
export type Handoff = { order_id: string; source_key: string; envelope: unknown; claim_token: string };
export type Acknowledgement = {
  sourceKey: string; receiverId: string; intakeVersion: "logistics-intake-v1";
  dispatchAuthorized: false; billingAuthorized: false;
};
/** Receiver integration must be explicitly supplied; never guess an endpoint or call a provider. */
export async function transferMarketplaceHandoff(
  sb: SupabaseClient, orderId: string,
  transport?: (handoff: Handoff) => Promise<Acknowledgement>,
) {
  if (!marketplaceLifecycleEnabled() || process.env.MARKETPLACE_LOGISTICS_HANDOFF !== "enabled") return { state: "disabled" };
  const selectedTransport = transport ?? configuredMarketplaceHttpTransport();
  if (!selectedTransport) return { state: "receiver_not_configured" };
  const { data: job, error } = await sb.rpc("marketplace_claim_handoff_v1", { p_order_id: orderId });
  if (error) throw new Error("Handoff claim unavailable");
  if (!job) return { state: "not_claimed" };
  let acknowledgement: Acknowledgement | null = null;
  try {
    const received = await selectedTransport(job);
    if (received.sourceKey === job.source_key && received.intakeVersion === "logistics-intake-v1"
      && received.dispatchAuthorized === false && received.billingAuthorized === false
      && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(received.receiverId)) acknowledgement = received;
  } catch { /* An unknown receiver outcome must not be retried automatically. */ }
  const { data: saved, error: writeError } = await sb.rpc("marketplace_finish_handoff_v1", {
    p_order_id: orderId, p_token: job.claim_token, p_receiver_id: acknowledgement?.receiverId ?? null,
    p_accepted: acknowledgement !== null,
  });
  if (writeError || !saved || !["recorded", "review"].includes(saved.state)) throw new Error("Handoff requires receiver reconciliation");
  return { state: saved.state as "recorded" | "review", dispatchAuthorized: false, billingAuthorized: false };
}
