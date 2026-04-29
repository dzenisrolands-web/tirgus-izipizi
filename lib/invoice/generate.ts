/**
 * Self-billing invoice generation.
 * Server-side only — uses SUPABASE_SECRET_KEY.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { sendPushToSubscriptions } from "@/lib/push";
import type { Period } from "./period";

type OrderItem = {
  id?: string;
  title: string;
  price: number;
  quantity: number;
  unit?: string;
  seller_id?: string | null;
  commission_rate?: number | null;
};

type OrderRow = {
  id: string;
  order_number: string;
  paid_at: string | null;
  items: OrderItem[] | null;
  seller_ids: string[] | null;
};

type SellerRow = {
  id: string;
  user_id: string;
  legal_name: string | null;
  registration_number: string | null;
  vat_number: string | null;
  is_vat_registered: boolean | null;
  legal_address: string | null;
  bank_name: string | null;
  bank_iban: string | null;
  self_billing_agreed: boolean | null;
};

type GenerateResult = {
  generated: { invoiceNumber: string; sellerId: string; netCents: number }[];
  skipped: { sellerId: string; reason: string }[];
  totalSellers: number;
};

function svc(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );
}

/**
 * Aggregate paid orders for a period and create invoice + invoice_lines for each seller.
 * Idempotent — relies on UNIQUE (seller_id, period_start, period_end) constraint.
 */
export async function generateInvoicesForPeriod(period: Period): Promise<GenerateResult> {
  const supabase = svc();

  // Fetch paid orders in period
  const { data: orders, error: ordersErr } = await supabase
    .from("orders")
    .select("id, order_number, paid_at, items, seller_ids")
    .gte("paid_at", period.start.toISOString())
    .lte("paid_at", period.end.toISOString())
    .eq("payment_status", "paid");
  if (ordersErr) throw ordersErr;

  // Aggregate by seller
  type Aggregate = {
    sellerId: string;
    lines: {
      order_id: string;
      order_number: string;
      order_date: string;
      product_title: string;
      quantity: number;
      unit: string | null;
      unit_price_cents: number;
      line_gross_cents: number;
      commission_rate: number;
      commission_cents: number;
      net_cents: number;
    }[];
    grossCents: number;
    commissionCents: number;
    netCents: number;
  };
  const bySeller = new Map<string, Aggregate>();

  for (const order of (orders ?? []) as OrderRow[]) {
    if (!order.paid_at || !order.items) continue;
    const orderDate = order.paid_at.split("T")[0];

    for (const item of order.items) {
      const sellerId = item.seller_id;
      if (!sellerId) continue;
      const rate = item.commission_rate ?? 10; // fallback for legacy orders
      const unitPriceCents = Math.round(Number(item.price) * 100);
      const lineGross = unitPriceCents * Number(item.quantity);
      const lineCommission = Math.round(lineGross * (rate / 100));
      const lineNet = lineGross - lineCommission;

      let agg = bySeller.get(sellerId);
      if (!agg) {
        agg = { sellerId, lines: [], grossCents: 0, commissionCents: 0, netCents: 0 };
        bySeller.set(sellerId, agg);
      }
      agg.lines.push({
        order_id: order.id,
        order_number: order.order_number,
        order_date: orderDate,
        product_title: item.title,
        quantity: Number(item.quantity),
        unit: item.unit ?? null,
        unit_price_cents: unitPriceCents,
        line_gross_cents: lineGross,
        commission_rate: rate,
        commission_cents: lineCommission,
        net_cents: lineNet,
      });
      agg.grossCents += lineGross;
      agg.commissionCents += lineCommission;
      agg.netCents += lineNet;
    }
  }

  if (bySeller.size === 0) {
    return { generated: [], skipped: [], totalSellers: 0 };
  }

  // Fetch seller details
  const sellerIds = Array.from(bySeller.keys());
  const { data: sellers } = await supabase
    .from("sellers")
    .select("id, user_id, legal_name, registration_number, vat_number, is_vat_registered, legal_address, bank_name, bank_iban, self_billing_agreed")
    .in("id", sellerIds);
  const sellerMap = new Map<string, SellerRow>();
  for (const s of (sellers ?? []) as SellerRow[]) sellerMap.set(s.id, s);

  const generated: GenerateResult["generated"] = [];
  const skipped: GenerateResult["skipped"] = [];

  for (const [sellerId, agg] of bySeller) {
    const seller = sellerMap.get(sellerId);
    if (!seller) {
      skipped.push({ sellerId, reason: "seller not found" });
      continue;
    }
    if (!seller.self_billing_agreed) {
      skipped.push({ sellerId, reason: "self-billing not agreed" });
      continue;
    }
    if (!seller.legal_name || !seller.bank_iban) {
      skipped.push({ sellerId, reason: "missing legal_name or IBAN" });
      continue;
    }

    // Idempotency check — does invoice for this period already exist?
    const periodStart = period.start.toISOString().split("T")[0];
    const periodEnd = period.end.toISOString().split("T")[0];
    const { data: existing } = await supabase
      .from("invoices")
      .select("id, invoice_number")
      .eq("seller_id", sellerId)
      .eq("period_start", periodStart)
      .eq("period_end", periodEnd)
      .maybeSingle();
    if (existing) {
      skipped.push({ sellerId, reason: `already exists: ${existing.invoice_number}` });
      continue;
    }

    // Get invoice number
    const { data: numData, error: numErr } = await supabase.rpc("next_invoice_number");
    if (numErr || !numData) {
      skipped.push({ sellerId, reason: `numbering failed: ${numErr?.message ?? "no number"}` });
      continue;
    }
    const invoiceNumber = numData as unknown as string;

    // VAT handling: 21% on commission only if seller is VAT-registered
    // (Operator SIA Svaigi is VAT registered and charges VAT on its commission service)
    const vatRate = 21;
    const vatAmountCents = Math.round(agg.commissionCents * (vatRate / 100));

    // Insert invoice
    const { data: invoice, error: invErr } = await supabase
      .from("invoices")
      .insert({
        invoice_number: invoiceNumber,
        seller_id: sellerId,
        period_start: periodStart,
        period_end: periodEnd,
        total_gross_cents: agg.grossCents,
        total_commission_cents: agg.commissionCents,
        total_net_cents: agg.netCents - vatAmountCents, // net to seller after VAT on commission
        vat_rate: vatRate,
        vat_amount_cents: vatAmountCents,
        seller_legal_name: seller.legal_name,
        seller_reg_number: seller.registration_number,
        seller_vat_number: seller.vat_number,
        seller_legal_address: seller.legal_address,
        seller_bank_name: seller.bank_name,
        seller_bank_iban: seller.bank_iban,
        status: "draft",
      })
      .select("id, invoice_number")
      .single();

    if (invErr || !invoice) {
      skipped.push({ sellerId, reason: `insert failed: ${invErr?.message}` });
      continue;
    }

    // Insert lines
    const lines = agg.lines.map((l, i) => ({ ...l, invoice_id: invoice.id, line_order: i }));
    const { error: linesErr } = await supabase.from("invoice_lines").insert(lines);
    if (linesErr) {
      skipped.push({ sellerId, reason: `lines insert failed: ${linesErr.message}` });
      continue;
    }

    generated.push({ invoiceNumber: invoice.invoice_number, sellerId, netCents: agg.netCents - vatAmountCents });

    // Notify seller
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", seller.user_id);
    if (subs && subs.length > 0) {
      sendPushToSubscriptions(subs, {
        title: "📄 Jauns rēķins!",
        body: `${invoice.invoice_number} · neto ${((agg.netCents - vatAmountCents) / 100).toFixed(2)}€ · ${period.label}`,
        url: `/dashboard/rekini/${invoice.id}`,
      }).catch((e) => console.error("[invoice] push failed:", e));
    }
  }

  return { generated, skipped, totalSellers: bySeller.size };
}
