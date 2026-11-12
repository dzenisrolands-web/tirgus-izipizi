/**
 * Self-billing invoice generation.
 * Server-side only — uses SUPABASE_SECRET_KEY.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { sendPushToSubscriptions } from "@/lib/push";
import { COMMISSION_RATE, COMMISSION_SERVICE_VAT, COURIER_FEE, commissionBreakdown, vatAmountFromInclusive, exVatPrice } from "@/lib/commission";
import { SELF_BILLING_VERSION, needsReconsent } from "@/lib/legal/self-billing";
import type { Period } from "./period";
import { marketplaceLifecycleEnabled } from "../marketplace-lifecycle";
import { marketplaceInvoiceEvidence } from "./marketplace-evidence";

type OrderItem = {
  id?: string;
  title: string;
  price: number;
  quantity: number;
  unit?: string;
  seller_id?: string | null;
  commission_rate?: number | null;
  vat_rate?: number | null; // product VAT rate (0/5/12/21)
  seller_delivery_mode?: string | null;
  seller_courier_fee_cents?: number | null;
};

type OrderRow = {
  id: string;
  order_number: string;
  paid_at: string | null;
  items: OrderItem[] | null;
  seller_ids: string[] | null;
  status?: string;
  payment_status?: string;
  lifecycle_version?: string | null;
  payment_review_reason?: string | null;
  financial_snapshot?: unknown;
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
  delivery_mode: string | null;
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
  const strict = marketplaceLifecycleEnabled();
  if (strict) {
    const { error } = await supabase.rpc("marketplace_invoice_ready_v1");
    if (error) throw new Error("Atomic invoicing migration is not ready");
  }

  // Fetch paid orders in period
  const { data: orders, error: ordersErr, count } = await supabase
    .from("orders")
    .select("id, order_number, paid_at, items, seller_ids" + (strict
      ? ", status, payment_status, lifecycle_version, payment_review_reason, financial_snapshot" : ""), strict ? { count: "exact" } : undefined)
    .gte("paid_at", period.start.toISOString())
    .lte("paid_at", period.end.toISOString())
    .eq("payment_status", "paid").returns<OrderRow[]>();
  if (ordersErr) throw ordersErr;
  if (strict && (!Number.isSafeInteger(count) || count !== orders?.length)) throw new Error("Complete invoice period could not be read");
  const blocked = new Set<string>();
  const operatorBySeller = new Map<string, { operator: Record<string, string>; version: string }>();
  if (strict) {
    for (const order of (orders ?? []) as OrderRow[]) {
      if (!order.seller_ids?.length) throw new Error("Unknown seller audience requires period reconciliation");
      const evidence = marketplaceInvoiceEvidence(order);
      for (const id of order.seller_ids ?? []) {
        if (!evidence.ok) { blocked.add(id); continue; }
        const previous = operatorBySeller.get(id);
        if (previous && (previous.version !== evidence.version
          || JSON.stringify(previous.operator) !== JSON.stringify(evidence.operator))) blocked.add(id);
        operatorBySeller.set(id, evidence);
      }
    }
  }

  // Aggregate by seller
  // Collect all listing IDs to batch-fetch their vat_rate
  const allItemIds = new Set<string>();
  for (const order of (orders ?? []) as OrderRow[]) {
    for (const item of order.items ?? []) {
      if (item.id) allItemIds.add(item.id);
    }
  }
  const listingVatMap = new Map<string, number>(); // listingId -> vat_rate
  if (!strict && allItemIds.size > 0) {
    const { data: listings } = await supabase
      .from("listings")
      .select("id, vat_rate")
      .in("id", Array.from(allItemIds));
    for (const l of listings ?? []) {
      listingVatMap.set(l.id, l.vat_rate ?? 21);
    }
  }

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
    if (strict && !marketplaceInvoiceEvidence(order).ok) continue;
    const orderDate = order.paid_at.split("T")[0];

    for (const item of order.items) {
      const sellerId = item.seller_id;
      if (!sellerId || blocked.has(sellerId)) continue;
      const rate = item.commission_rate ?? COMMISSION_RATE;
      // Product VAT rate: from item (if stored), listing lookup, or fallback
      const vatRate = item.vat_rate ?? (item.id ? listingVatMap.get(item.id) : undefined) ?? 21;

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
        agg = { sellerId, lines: [], grossCents: 0, productVatCents: 0, commissionCents: 0, commissionNetCents: 0, commissionVatCents: 0, netCents: 0 };
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
    return { generated: [], skipped: [...blocked].map(sellerId => ({ sellerId, reason: "Financial evidence requires reconciliation" })), totalSellers: blocked.size };
  }

  // Fetch seller details
  const sellerIds = Array.from(bySeller.keys());
  const { data: sellers } = await supabase
    .from("sellers")
    .select("id, user_id, legal_name, registration_number, vat_number, is_vat_registered, legal_address, bank_name, bank_iban, self_billing_agreed, delivery_mode, self_billing_agreement_version")
    .in("id", sellerIds);
  const sellerMap = new Map<string, SellerRow>();
  for (const s of (sellers ?? []) as SellerRow[]) sellerMap.set(s.id, s);

  const generated: GenerateResult["generated"] = [];
  const skipped: GenerateResult["skipped"] = [...blocked].map(sellerId => ({ sellerId, reason: "Financial evidence requires reconciliation" }));

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
    if ((strict && seller.self_billing_agreement_version !== SELF_BILLING_VERSION) || needsReconsent(seller.self_billing_agreement_version)) {
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

    // Get invoice number
    const { data: numData, error: numErr } = strict
      ? { data: "allocated_atomically", error: null }
      : await supabase.rpc("next_invoice_number");
    if (numErr || !numData) {
      skipped.push({ sellerId, reason: `numbering failed: ${numErr?.message ?? "no number"}` });
      continue;
    }
    const invoiceNumber = numData as unknown as string;

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

    // Courier fee: deduct COURIER_FEE once per unique order if seller uses courier mode
    const isCourier = seller.delivery_mode === "courier";
    const uniqueOrderIds = new Set(agg.lines.map((l) => l.order_id));
    const capturedPickup = new Map<string, number>();
    if (strict) for (const order of (orders ?? []) as OrderRow[]) {
      for (const item of order.items ?? []) if (item.seller_id === sellerId) {
        const amount = item.seller_courier_fee_cents;
        if (amount !== 0 && amount !== 350) throw new Error("Missing pickup snapshot");
        if (capturedPickup.has(order.id) && capturedPickup.get(order.id) !== amount) throw new Error("Conflicting pickup snapshot");
        capturedPickup.set(order.id, amount);
      }
    }
    const courierOrderCount = strict ? [...capturedPickup.values()].filter(value => value === 350).length : isCourier ? uniqueOrderIds.size : 0;
    const courierFeeCents = strict ? courierOrderCount * 350 : isCourier ? Math.round(COURIER_FEE * 100) * uniqueOrderIds.size : 0;
    const finalNetCents = agg.netCents - courierFeeCents;

    const header = {
        invoice_number: invoiceNumber,
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
        courier_order_count: courierOrderCount,
        total_net_cents: finalNetCents,
        seller_legal_name: seller.legal_name,
        seller_reg_number: seller.registration_number,
        seller_vat_number: seller.vat_number,
        seller_legal_address: seller.legal_address,
        seller_bank_name: seller.bank_name,
        seller_bank_iban: seller.bank_iban,
        status: "draft",
        ...(strict ? { operator_version: operatorBySeller.get(sellerId)!.version,
          operator_snapshot: operatorBySeller.get(sellerId)!.operator } : {}),
      };
    const linePayload = agg.lines.map((l, i) => ({ ...l, line_order: i }));
    const { data: invoice, error: invErr } = strict
      ? await supabase.rpc("marketplace_create_invoice_v1", { p_header: header, p_lines: linePayload })
      : await supabase.from("invoices").insert(header).select("id, invoice_number").single();

    if (invErr || !invoice) {
      skipped.push({ sellerId, reason: `insert failed: ${invErr?.message}` });
      continue;
    }

    // Insert lines
    const lines = agg.lines.map((l, i) => ({ ...l, invoice_id: invoice.id, line_order: i }));
    const { error: linesErr } = strict ? { error: null } : await supabase.from("invoice_lines").insert(lines);
    if (linesErr) {
      skipped.push({ sellerId, reason: `lines insert failed: ${linesErr.message}` });
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

  return { generated, skipped, totalSellers: bySeller.size + blocked.size };
}
