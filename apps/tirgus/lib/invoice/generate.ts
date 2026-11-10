/**
 * Self-billing invoice generation.
 * Server-side only — uses SUPABASE_SECRET_KEY.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { sendPushToSubscriptions } from "@/lib/push";
import { COMMISSION_RATE, COMMISSION_SERVICE_VAT, commissionBreakdown, vatAmountFromInclusive } from "@/lib/commission";
import { SELF_BILLING_VERSION, needsReconsent } from "@/lib/legal/self-billing";
import type { Period } from "./period";
import { newInvoiceOperatorSnapshot } from "./operator-snapshot";
import { assertInvoiceSchema } from "./schema";

type OrderItem = {
  id?: string;
  title: string;
  price: number;
  quantity: number;
  unit?: string;
  seller_id?: string | null;
  commission_rate?: number | null;
  vat_rate?: number | null; // product VAT rate (0/5/12/21)
  seller_delivery_mode?: "courier" | "locker" | null;
  seller_courier_fee_cents?: number | null;
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
  self_billing_agreement_version: string | null;
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
  await assertInvoiceSchema(supabase);

  // Fetch paid orders in period
  const { data: orders, error: ordersErr } = await supabase
    .from("orders")
    .select("id, order_number, paid_at, items, seller_ids")
    .gte("paid_at", period.start.toISOString())
    .lte("paid_at", period.end.toISOString())
    .eq("payment_status", "paid");
  if (ordersErr) throw ordersErr;

  // Missing historical evidence must not be reconstructed from current listings
  // or seller profiles: their VAT/pickup settings may have changed since sale.
  const reconciliation = new Map<string, string>();
  const pickupByOrderSeller = new Map<string, string>();
  for (const order of (orders ?? []) as OrderRow[]) {
    if (!order.paid_at || !order.items?.length) {
      throw new Error(`Manual reconciliation required: order ${order.order_number} has no paid item evidence`);
    }
    for (const item of order.items ?? []) {
      if (!item.seller_id) {
        throw new Error(`Manual reconciliation required: order ${order.order_number} has an item without seller_id`);
      }
      const key = `${order.id}:${item.seller_id}`;
      const priorPickup = pickupByOrderSeller.get(key);
      if (item.commission_rate !== COMMISSION_RATE ||
          ![0, 5, 12, 21].includes(item.vat_rate as number) ||
          !["courier", "locker"].includes(item.seller_delivery_mode ?? "") ||
          item.seller_courier_fee_cents !== (item.seller_delivery_mode === "courier" ? 350 : 0) ||
          !Number.isFinite(item.price) || item.price <= 0 ||
          !Number.isFinite(item.quantity) || item.quantity <= 0 ||
          !Number.isSafeInteger(Math.round(item.price * 100) * item.quantity) ||
          (priorPickup !== undefined && priorPickup !== item.seller_delivery_mode)) {
        reconciliation.set(item.seller_id,
          `manual reconciliation required: order ${order.order_number} has missing/unsupported commission, VAT, pickup or amount evidence`);
      }
      if (item.seller_delivery_mode) pickupByOrderSeller.set(key, item.seller_delivery_mode);
    }
  }

  type Aggregate = {
    sellerId: string;
    courierOrderIds: Set<string>;
    lines: {
      order_id: string;
      order_number: string;
      order_date: string;
      product_title: string;
      quantity: number;
      unit: string | null;
      unit_price_cents: number;
      line_gross_cents: number;
      vat_rate: number;
      vat_amount_cents: number;
      ex_vat_cents: number;
      commission_rate: number;
      commission_cents: number;
      net_cents: number;
    }[];
    grossCents: number;
    productVatCents: number;
    commissionCents: number;   // total deducted = commissionNet + commissionVat
    commissionNetCents: number; // operator's net revenue (15% of ex-VAT)
    commissionVatCents: number; // 21% service VAT operator remits to VID
    netCents: number;
  };
  const bySeller = new Map<string, Aggregate>();

  for (const order of (orders ?? []) as OrderRow[]) {
    if (!order.paid_at || !order.items) continue;
    const orderDate = order.paid_at.split("T")[0];

    for (const item of order.items) {
      const sellerId = item.seller_id;
      if (!sellerId || reconciliation.has(sellerId)) continue;
      const rate = item.commission_rate!;
      const vatRate = item.vat_rate!;

      const unitPriceCents = Math.round(Number(item.price) * 100);
      const lineGross = unitPriceCents * Number(item.quantity);
      const lineVatAmount = Math.round(vatAmountFromInclusive(lineGross / 100, vatRate) * 100);
      const lineExVat = lineGross - lineVatAmount;
      // Commission: 15% of ex-VAT price + 21% VAT on commission
      const cb = commissionBreakdown(lineGross / 100, vatRate);
      const lineCommissionNet = Math.round(cb.commissionNet * 100); // operator net (before service VAT)
      const lineCommissionVat = Math.round(cb.commissionVat * 100); // 21% service VAT
      const lineCommission = lineCommissionNet + lineCommissionVat;  // total deduction
      const lineNet = lineGross - lineCommission;

      let agg = bySeller.get(sellerId);
      if (!agg) {
        agg = { sellerId, courierOrderIds: new Set(), lines: [], grossCents: 0, productVatCents: 0, commissionCents: 0, commissionNetCents: 0, commissionVatCents: 0, netCents: 0 };
        bySeller.set(sellerId, agg);
      }
      if (item.seller_delivery_mode === "courier") agg.courierOrderIds.add(order.id);
      agg.lines.push({
        order_id: order.id,
        order_number: order.order_number,
        order_date: orderDate,
        product_title: item.title,
        quantity: Number(item.quantity),
        unit: item.unit ?? null,
        unit_price_cents: unitPriceCents,
        line_gross_cents: lineGross,
        vat_rate: vatRate,
        vat_amount_cents: lineVatAmount,
        ex_vat_cents: lineExVat,
        commission_rate: rate,
        commission_cents: lineCommission,
        net_cents: lineNet,
      });
      agg.grossCents += lineGross;
      agg.productVatCents += lineVatAmount;
      agg.commissionCents += lineCommission;
      agg.commissionNetCents += lineCommissionNet;
      agg.commissionVatCents += lineCommissionVat;
      agg.netCents += lineNet;
    }
  }

  if (bySeller.size === 0) {
    return { generated: [], skipped: Array.from(reconciliation, ([sellerId, reason]) => ({ sellerId, reason })), totalSellers: reconciliation.size };
  }

  // Fetch seller details
  const sellerIds = Array.from(bySeller.keys());
  const { data: sellers } = await supabase
    .from("sellers")
    .select("id, user_id, legal_name, registration_number, vat_number, is_vat_registered, legal_address, bank_name, bank_iban, self_billing_agreed, self_billing_agreement_version")
    .in("id", sellerIds);
  const sellerMap = new Map<string, SellerRow>();
  for (const s of (sellers ?? []) as SellerRow[]) sellerMap.set(s.id, s);

  const generated: GenerateResult["generated"] = [];
  const skipped: GenerateResult["skipped"] = Array.from(reconciliation, ([sellerId, reason]) => ({ sellerId, reason }));

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
    // The agreement names a specific operator entity. A consent given to a
    // previous operator does not authorise us to issue invoices in the
    // seller's name, so hold the payout until they accept the new version.
    if (!seller.self_billing_agreement_version || needsReconsent(seller.self_billing_agreement_version)) {
      skipped.push({
        sellerId,
        reason: `self-billing consent is version ${seller.self_billing_agreement_version}, needs ${SELF_BILLING_VERSION}`,
      });
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

    // Commission breakdown:
    //   commissionNet = 15% of ex-VAT (operator's revenue)
    //   commissionVat = 21% VAT on commissionNet (operator remits to VID)
    //   commissionTotal = commissionNet + commissionVat (deducted from seller)
    //   netToSeller = gross - commissionTotal
    //
    // Note: for 21% VAT products commissionTotal = 15% of gross (same as before).
    // For reduced VAT products (5%, 12%) the operator VAT is proportionally larger.
    const commissionVatRate = COMMISSION_SERVICE_VAT;
    // Use per-line breakdowns accumulated during aggregation — no re-computation needed.
    // agg.commissionNetCents = 15% of ex-VAT (operator net revenue)
    // agg.commissionVatCents = 21% service VAT on that net (operator remits to VID)
    // agg.netCents           = gross - (commissionNet + commissionVat) per line
    const productVatCents = agg.productVatCents;
    const exVatGrossCents = agg.grossCents - productVatCents;

    // Courier pickup uses order-time seller snapshots, once per seller/order.
    const courierFeeCents = 350 * agg.courierOrderIds.size;
    const finalNetCents = agg.netCents - courierFeeCents;

    // Number, header and lines are one PostgreSQL transaction. No client-side
    // fallback: an unavailable RPC must never leave a partial accounting record.
    const { data: invoice, error: invErr } = await supabase.rpc("create_invoice_with_lines", {
      p_header: {
        ...newInvoiceOperatorSnapshot(),
        seller_id: sellerId,
        period_start: periodStart,
        period_end: periodEnd,
        total_gross_cents: agg.grossCents,
        total_ex_vat_cents: exVatGrossCents,
        total_product_vat_cents: productVatCents,
        total_commission_cents: agg.commissionNetCents,
        commission_vat_rate: commissionVatRate,
        commission_vat_cents: agg.commissionVatCents,
        courier_fee_cents: courierFeeCents,
        courier_order_count: agg.courierOrderIds.size,
        total_net_cents: finalNetCents,
        seller_legal_name: seller.legal_name,
        seller_reg_number: seller.registration_number,
        seller_vat_number: seller.vat_number,
        seller_legal_address: seller.legal_address,
        seller_bank_name: seller.bank_name,
        seller_bank_iban: seller.bank_iban,
        status: "draft",
      },
      p_lines: agg.lines.map((line, line_order) => ({ ...line, line_order })),
    });

    if (invErr || !invoice) {
      skipped.push({ sellerId, reason: `atomic invoice failed: ${invErr?.message ?? "no invoice returned"}` });
      continue;
    }

    generated.push({ invoiceNumber: invoice.invoice_number, sellerId, netCents: finalNetCents });

    // Notify seller
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", seller.user_id);
    if (subs && subs.length > 0) {
      sendPushToSubscriptions(subs, {
        title: "📄 Jauns rēķins!",
        body: `${invoice.invoice_number} · neto ${(finalNetCents / 100).toFixed(2)}€ · ${period.label}`,
        url: `/dashboard/rekini/${invoice.id}`,
      }).catch((e) => console.error("[invoice] push failed:", e));
    }
  }

  return { generated, skipped, totalSellers: bySeller.size + reconciliation.size };
}
