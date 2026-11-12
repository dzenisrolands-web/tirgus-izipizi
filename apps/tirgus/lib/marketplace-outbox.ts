import type { SupabaseClient } from "@supabase/supabase-js";
import { marketplaceLifecycleEnabled } from "./marketplace-lifecycle";
import { sendEmail, brandedEmailLayout } from "./email";
import { trustedPaymentBaseUrl } from "./paysera";
type Job = { id: string; event_id: string; order_id: string; audience: "buyer" | "seller"; seller_id: string | null; claim_token: string };
type DeliveryOutcome = { outcome: "accepted" | "not_sent" | "uncertain"; reference?: string };
const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

async function deliverEmail(sb: SupabaseClient, job: Job): Promise<DeliveryOutcome> {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) return { outcome: "not_sent" };
  const { data: order, error } = await sb.from("orders")
    .select("order_number,buyer_email,status,payment_status,payment_review_reason,seller_ids")
    .eq("id", job.order_id).single();
  if (error || !order) return { outcome: "uncertain" };
  const { data: event, error: eventError } = await sb.from("marketplace_events_v1")
    .select("event_type").eq("id", job.event_id).eq("order_id", job.order_id).single();
  if (eventError || !event) return { outcome: "uncertain" };
  const cancellation = event.event_type === "order_cancelled" && job.audience === "buyer" && order.status === "cancelled";
  if (!cancellation && (order.payment_status !== "paid" || order.payment_review_reason || order.status === "cancelled")) return { outcome: "uncertain" };
  let recipient = order.buyer_email;
  if (job.audience === "seller") {
    if (!job.seller_id || !order.seller_ids?.includes(job.seller_id)) return { outcome: "uncertain" };
    const { data: seller } = await sb.from("sellers").select("user_id").eq("id", job.seller_id).single();
    if (!seller?.user_id) return { outcome: "uncertain" };
    const { data, error: userError } = await sb.auth.admin.getUserById(seller.user_id);
    if (userError || !data.user?.email_confirmed_at) return { outcome: "uncertain" };
    recipient = data.user.email;
  }
  if (typeof recipient !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) return { outcome: "uncertain" };
  const path = job.audience === "seller" ? "/dashboard/pasutijumi"
    : `/cart/success?order=${encodeURIComponent(order.order_number)}`;
  const url = trustedPaymentBaseUrl() + path;
  const result = await sendEmail({
    to: recipient, subject: `Pasūtījuma ${order.order_number} informācija — IziPizi`,
    html: brandedEmailLayout(`<p>Pasūtījuma <strong>${escape(order.order_number)}</strong> informācija ir atjaunināta.</p><p><a href="${escape(url)}">Apskatīt pasūtījumu</a></p>`),
    idempotencyKey: `marketplace-email/${job.id}`,
  });
  return result.ok && typeof result.id === "string" && result.id.length >= 3
    ? { outcome: "accepted", reference: result.id } : { outcome: "uncertain" };
}

/** Accepted means provider acceptance, NOT inbox delivery or customer readership. */
export async function processMarketplaceEmail(
  sb: SupabaseClient, transport?: (job: Job) => Promise<DeliveryOutcome>,
) {
  if (!marketplaceLifecycleEnabled() || process.env.MARKETPLACE_EMAIL_OUTBOX !== "enabled") return { state: "disabled" };
  if (!transport && (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM)) return { state: "not_configured" };
  const { data: job, error } = await sb.rpc("marketplace_claim_email_v1");
  if (error) throw new Error("Outbox unavailable");
  if (!job) return { state: "empty" };
  if (typeof job.id !== "string" || typeof job.claim_token !== "string") throw new Error("Invalid outbox claim");
  let result: DeliveryOutcome;
  try { result = await (transport ?? (entry => deliverEmail(sb, entry)))(job); } catch { result = { outcome: "uncertain" }; }
  const { data: confirmed, error: finishError } = await sb.rpc("marketplace_finish_email_v1", {
    p_id: job.id, p_token: job.claim_token, p_outcome: result.outcome, p_reference: result.reference ?? null,
  });
  if (finishError || confirmed !== true) throw new Error("Outbox result requires reconciliation");
  return { state: result.outcome };
}
