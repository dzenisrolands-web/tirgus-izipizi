import { createServerClient } from "@/lib/supabase";
import { formatPrice } from "@/lib/utils";
import { COMMISSION_RATE, COMMISSION_FRACTION, COURIER_FEE } from "@/lib/commission";
import { OrdersTimeline } from "./orders-timeline";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type OrderRow = {
  id: string;
  status: string;
  payment_status: string | null;
  total_cents: number;
  items: Array<{ id?: string; title?: string; quantity?: number; price?: number }> | null;
  delivery_type: string | null;
  delivery_info: Record<string, unknown> | null;
  paid_at: string | null;
  created_at: string;
};

type ListingRow = {
  id: string;
  title: string;
  status: string;
  seller_id: string | null;
  freshness_date: string | null;
};

  type SellerRow = { id: string; name: string; farm_name: string | null; delivery_mode: string | null };

function startOfDayISO(daysAgo = 0): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

export default async function StatistikaPage() {
  const supabase = createServerClient();
  const todayStart = startOfDayISO(0);
  const weekStart = startOfDayISO(6);
  const monthStart = startOfDayISO(29);
  const fortyNineDaysAgo = startOfDayISO(48);
  const threeDaysAhead = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [
    paidOrdersRes,
    allOrdersRes,
    listingsRes,
    sellersRes,
    expiringRes,
    pwaShownRes,
    pwaAcceptedRes,
    pwaStandaloneRes,
    lookupsRes,
    pageViewsRes,
    promoCodesRes,
    promoRedemptionsRes,
    emailSubsRes,
  ] = await Promise.all([
    // Paid orders in the last ~50 days (covers month timeline + revenue stats)
    supabase
      .from("orders")
      .select("id, status, payment_status, total_cents, items, delivery_type, delivery_info, paid_at, created_at")
      .or(`paid_at.gte.${fortyNineDaysAgo},and(payment_status.eq.paid,created_at.gte.${fortyNineDaysAgo}),and(status.in.(paid,processing,shipped,delivered),created_at.gte.${fortyNineDaysAgo})`)
      .order("paid_at", { ascending: false }),
    // All orders (any status) for the status split
    supabase.from("orders").select("status", { count: "exact", head: false }),
    // All listings — for status counts
    supabase.from("listings").select("id, title, status, seller_id, freshness_date"),
    // Seller name lookup (including delivery_mode for courier fee calc)
    supabase.from("sellers").select("id, name, farm_name, delivery_mode"),
    // Active listings expiring within the next 3 days
    supabase
      .from("listings")
      .select("id, title, status, seller_id, freshness_date")
      .eq("status", "active")
      .not("freshness_date", "is", null)
      .lte("freshness_date", threeDaysAhead)
      .order("freshness_date", { ascending: true })
      .limit(20),
    supabase.from("pwa_events").select("*", { count: "exact", head: true }).eq("event_type", "prompt_shown"),
    supabase.from("pwa_events").select("*", { count: "exact", head: true }).eq("event_type", "prompt_accepted"),
    supabase.from("pwa_events").select("*", { count: "exact", head: true }).eq("event_type", "standalone_visit"),
    // Address lookups (last 30 days)
    supabase
      .from("delivery_lookups")
      .select("postal_code, city, address, zone, outside_zones, created_at")
      .gte("created_at", monthStart)
      .order("created_at", { ascending: false }),
    // Page views (last 30 days)
    supabase
      .from("page_views")
      .select("path, created_at")
      .gte("created_at", monthStart),
    // Promo codes
    supabase.from("promo_codes").select("id, code, type, max_uses, used_count, active, created_at"),
    // Promo redemptions (all time)
    supabase.from("promo_redemptions").select("id, code, discount_cents, created_at").order("created_at", { ascending: false }),
    // Email subscribers
    supabase.from("email_subscribers").select("id, email, source, mailerlite_synced, subscribed_at").order("subscribed_at", { ascending: false }),
  ]);

  const paidOrders = (paidOrdersRes.data ?? []) as OrderRow[];
  const allOrders = (allOrdersRes.data ?? []) as { status: string }[];
  const listings = (listingsRes.data ?? []) as ListingRow[];
  const sellers = (sellersRes.data ?? []) as SellerRow[];
  const expiring = (expiringRes.data ?? []) as ListingRow[];

  const sellerById = new Map(sellers.map((s) => [s.id, s]));
  const listingById = new Map(listings.map((l) => [l.id, l]));

  // Date helpers
  const inRange = (iso: string | null, fromISO: string) =>
    !!iso && new Date(iso).getTime() >= new Date(fromISO).getTime();

  // D1 — orders in windows
  const ordersToday = paidOrders.filter((o) => inRange(o.paid_at ?? o.created_at, todayStart));
  const ordersWeek = paidOrders.filter((o) => inRange(o.paid_at ?? o.created_at, weekStart));
  const ordersMonth = paidOrders.filter((o) => inRange(o.paid_at ?? o.created_at, monthStart));

  // D2 / D3 — GMV in last 30 days, AOV
  const gmvMonth = ordersMonth.reduce((s, o) => s + (o.total_cents ?? 0), 0);
  const aovMonth = ordersMonth.length ? gmvMonth / ordersMonth.length : 0;

  // D6 — commission earned in last 30 days (fixed platform rate)
  const commissionMonth = Math.round(gmvMonth * COMMISSION_FRACTION);

  // D7 — courier fees earned in last 30 days
  // Count per-seller-per-order: if order has 2 courier sellers, that's 2 courier fees
  const courierSellerIds = new Set(
    sellers.filter(s => s.delivery_mode === "courier").map(s => s.id)
  );
  let courierFeeCount = 0;
  for (const o of ordersMonth) {
    // Find unique courier sellers in this order
    const orderSellerIds = new Set(
      (o.items ?? []).map(it => it.id ? listingById.get(it.id)?.seller_id : null).filter(Boolean)
    );
    for (const sid of orderSellerIds) {
      if (courierSellerIds.has(sid as string)) courierFeeCount++;
    }
  }
  const courierFeesMonth = Math.round(courierFeeCount * COURIER_FEE * 100);

  // D4 — Top 10 products (by units sold in last 30 days)
  const productCounts = new Map<string, { id: string; title: string; units: number; revenueCents: number }>();
  for (const o of ordersMonth) {
    for (const it of o.items ?? []) {
      if (!it.id) continue;
      const cur = productCounts.get(it.id) ?? {
        id: it.id,
        title: it.title ?? listingById.get(it.id)?.title ?? "(nezināms)",
        units: 0,
        revenueCents: 0,
      };
      cur.units += it.quantity ?? 1;
      cur.revenueCents += Math.round((it.price ?? 0) * 100) * (it.quantity ?? 1);
      productCounts.set(it.id, cur);
    }
  }
  const topProducts = [...productCounts.values()].sort((a, b) => b.units - a.units).slice(0, 10);

  // D5 — Top 10 sellers by revenue (last 30 days)
  const sellerRev = new Map<string, { id: string; name: string; revenueCents: number; units: number }>();
  for (const o of ordersMonth) {
    for (const it of o.items ?? []) {
      if (!it.id) continue;
      const sellerId = listingById.get(it.id)?.seller_id;
      if (!sellerId) continue;
      const cur = sellerRev.get(sellerId) ?? {
        id: sellerId,
        name: sellerById.get(sellerId)?.farm_name || sellerById.get(sellerId)?.name || "(nezināms)",
        revenueCents: 0,
        units: 0,
      };
      cur.revenueCents += Math.round((it.price ?? 0) * 100) * (it.quantity ?? 1);
      cur.units += it.quantity ?? 1;
      sellerRev.set(sellerId, cur);
    }
  }
  const topSellers = [...sellerRev.values()].sort((a, b) => b.revenueCents - a.revenueCents).slice(0, 10);

  // H1 — order status split (all-time)
  const statusCounts = allOrders.reduce<Record<string, number>>((m, o) => {
    m[o.status] = (m[o.status] ?? 0) + 1;
    return m;
  }, {});

  // G1 — listing status split
  const listingStatusCounts = listings.reduce<Record<string, number>>((m, l) => {
    m[l.status] = (m[l.status] ?? 0) + 1;
    return m;
  }, {});

  // D8 — Delivery method split + top addresses (last 30 days)
  const deliveryMethodCounts: Record<string, number> = {};
  const addressCounts = new Map<string, { address: string; city: string; postalCode: string; count: number; gmvCents: number }>();
  const lockerCounts = new Map<string, { name: string; count: number }>();
  for (const o of ordersMonth) {
    const dt = (o.delivery_type as string) ?? "locker";
    deliveryMethodCounts[dt] = (deliveryMethodCounts[dt] ?? 0) + 1;
    const di = o.delivery_info as Record<string, unknown> | null;
    if (di) {
      if (dt === "locker") {
        const name = (di.locker_name as string) ?? (di.locker_city as string) ?? "(nezināms)";
        const cur = lockerCounts.get(name) ?? { name, count: 0 };
        cur.count++;
        lockerCounts.set(name, cur);
      } else {
        const addr = (di.address as string) ?? "";
        const city = (di.city as string) ?? "";
        const pc = (di.postal_code as string) ?? "";
        if (addr || city) {
          const key = `${addr}|${city}|${pc}`;
          const cur = addressCounts.get(key) ?? { address: addr, city, postalCode: pc, count: 0, gmvCents: 0 };
          cur.count++;
          cur.gmvCents += o.total_cents ?? 0;
          addressCounts.set(key, cur);
        }
      }
    }
  }
  const topAddresses = [...addressCounts.values()].sort((a, b) => b.count - a.count).slice(0, 10);
  const topLockers = [...lockerCounts.values()].sort((a, b) => b.count - a.count);
  const deliveryMethodLabels: Record<string, string> = {
    locker: "Pakomāts", courier: "Kurjers", express: "Ekspres",
  };

  // D9 — Address lookups (demand analytics — all visitors, not just buyers)
  type LookupRow = { postal_code: string | null; city: string | null; address: string | null; zone: number | null; outside_zones: boolean };
  const lookups = (lookupsRes.data ?? []) as LookupRow[];
  const lookupByPostal = new Map<string, { postalCode: string; city: string; count: number; zone: number | null; outsideZones: boolean }>();
  const lookupByCity = new Map<string, { city: string; count: number }>();
  let lookupOutsideCount = 0;
  for (const l of lookups) {
    if (l.postal_code) {
      const cur = lookupByPostal.get(l.postal_code) ?? { postalCode: l.postal_code, city: l.city ?? "", count: 0, zone: l.zone, outsideZones: l.outside_zones };
      cur.count++;
      lookupByPostal.set(l.postal_code, cur);
    }
    if (l.city) {
      const cur = lookupByCity.get(l.city) ?? { city: l.city, count: 0 };
      cur.count++;
      lookupByCity.set(l.city, cur);
    }
    if (l.outside_zones) lookupOutsideCount++;
  }
  const topLookupPostals = [...lookupByPostal.values()].sort((a, b) => b.count - a.count).slice(0, 15);
  const topLookupCities = [...lookupByCity.values()].sort((a, b) => b.count - a.count).slice(0, 10);

  // D10 — Page views (visitor analytics)
  type PvRow = { path: string; created_at: string };
  const pageViews = (pageViewsRes.data ?? []) as PvRow[];
  const pvToday = pageViews.filter((p) => inRange(p.created_at, todayStart)).length;
  const pvWeek = pageViews.filter((p) => inRange(p.created_at, weekStart)).length;
  const pvMonth = pageViews.length;
  // Top pages
  const pvByPath = new Map<string, number>();
  const pvByDay = new Map<string, number>();
  for (const p of pageViews) {
    pvByPath.set(p.path, (pvByPath.get(p.path) ?? 0) + 1);
    const day = p.created_at?.split("T")[0] ?? "";
    if (day) pvByDay.set(day, (pvByDay.get(day) ?? 0) + 1);
  }
  const topPages = [...pvByPath.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([path, count]) => ({ path, count }));
  // Daily trend
  const pvDays: { date: string; views: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    pvDays.push({ date: key, views: pvByDay.get(key) ?? 0 });
  }

  // D11 — Promo code stats
  type PromoCodeRow = { id: string; code: string; type: string; max_uses: number; used_count: number; active: boolean; created_at: string };
  type RedemptionRow = { id: string; code: string; discount_cents: number; created_at: string };
  const promoCodes = (promoCodesRes.data ?? []) as PromoCodeRow[];
  const redemptions = (promoRedemptionsRes.data ?? []) as RedemptionRow[];
  const totalRedemptions = redemptions.length;
  const totalSavingsCents = redemptions.reduce((s, r) => s + (r.discount_cents ?? 0), 0);
  const redemptionsMonth = redemptions.filter((r) => inRange(r.created_at, monthStart));
  const savingsMonthCents = redemptionsMonth.reduce((s, r) => s + (r.discount_cents ?? 0), 0);
  // Per-code breakdown
  const redemptionsByCode = new Map<string, { code: string; count: number; savingsCents: number }>();
  for (const r of redemptions) {
    const cur = redemptionsByCode.get(r.code) ?? { code: r.code, count: 0, savingsCents: 0 };
    cur.count++;
    cur.savingsCents += r.discount_cents ?? 0;
    redemptionsByCode.set(r.code, cur);
  }
  const promoBreakdown = [...redemptionsByCode.values()].sort((a, b) => b.count - a.count);

  // D12 — Email subscriber stats
  type SubRow = { id: string; email: string; source: string | null; mailerlite_synced: boolean; subscribed_at: string };
  const emailSubs = (emailSubsRes.data ?? []) as SubRow[];
  const subsTotal = emailSubs.length;
  const subsSynced = emailSubs.filter((s) => s.mailerlite_synced).length;
  const subsMonth = emailSubs.filter((s) => inRange(s.subscribed_at, monthStart)).length;
  const subsWeek = emailSubs.filter((s) => inRange(s.subscribed_at, weekStart)).length;
  // By source
  const subsBySource = new Map<string, number>();
  for (const s of emailSubs) {
    const src = s.source ?? "banner";
    subsBySource.set(src, (subsBySource.get(src) ?? 0) + 1);
  }
  const sourceLabels: Record<string, string> = {
    banner: "Banneris", profile: "Profils", checkout: "Checkout", register: "Reģistrācija",
  };

  // Build per-day buckets for the timeline (last 30 days)
  const days: { date: string; count: number; gmvCents: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    days.push({ date: d.toISOString().slice(0, 10), count: 0, gmvCents: 0 });
  }
  const dayIndex = new Map(days.map((d, i) => [d.date, i]));
  for (const o of ordersMonth) {
    const isoDay = (o.paid_at ?? o.created_at).slice(0, 10);
    const idx = dayIndex.get(isoDay);
    if (idx !== undefined) {
      days[idx].count++;
      days[idx].gmvCents += o.total_cents ?? 0;
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Statistika</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Pārdošana, produktu veselība un PWA instalācijas. Atjauno reizi 60 sekundēs.
          </p>
        </div>
        <Link href="/admin" className="text-sm text-brand-600 hover:underline">← Admin sākums</Link>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi title="Šodien" value={`${ordersToday.length}`} sub={`${pvToday} skatījumi`} />
        <Kpi title="Nedēļa" value={`${ordersWeek.length}`} sub={`${pvWeek} skatījumi`} />
        <Kpi title="Mēnesis" value={`${ordersMonth.length}`} sub={`${pvMonth} skatījumi`} />
        <Kpi title="GMV / 30d" value={formatPrice(gmvMonth / 100)} sub={`vid. ${formatPrice(aovMonth / 100)}/pas.`} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi title={`Komisija (${COMMISSION_RATE}%)`} value={formatPrice(commissionMonth / 100)} sub="pēdējās 30d" tone="brand" />
        <Kpi title="Kurjera maksa (€3,50)" value={formatPrice(courierFeesMonth / 100)} sub={`${courierFeeCount} kur. pārdevēji×pasūt.`} tone="brand" />
        <Kpi title="Aktīvi produkti" value={`${listingStatusCounts.active ?? 0}`} sub={`${listings.length} kopā`} />
        <Kpi title="Beidzas drīz" value={`${expiring.length}`} sub="nāk. 3 dienās" tone={expiring.length > 0 ? "warn" : "ok"} />
        <Kpi
          title="PWA instalācijas"
          value={`${pwaAcceptedRes.count ?? 0}`}
          sub={`${pwaShownRes.count ?? 0} piedāvāts · ${pwaStandaloneRes.count ?? 0} sesijas`}
          tone="brand"
        />
      </div>

      {/* D1 timeline */}
      <section className="mt-8 rounded-xl border border-gray-100 bg-white p-5">
        <h2 className="text-sm font-bold text-gray-900">Pasūtījumi · pēdējās 30 dienas</h2>
        <OrdersTimeline days={days} />
      </section>

      {/* H1 + G1 status splits */}
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-100 bg-white p-5">
          <h2 className="text-sm font-bold text-gray-900">Pasūtījumu statusi</h2>
          <ul className="mt-3 space-y-2">
            {Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).map(([k, n]) => (
              <li key={k} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{statusLabel(k)}</span>
                <span className="font-semibold text-gray-900">{n}</span>
              </li>
            ))}
            {Object.keys(statusCounts).length === 0 && (
              <li className="text-sm text-gray-400">Nav datu.</li>
            )}
          </ul>
        </section>
        <section className="rounded-xl border border-gray-100 bg-white p-5">
          <h2 className="text-sm font-bold text-gray-900">Produktu statusi</h2>
          <ul className="mt-3 space-y-2">
            {Object.entries(listingStatusCounts).sort((a, b) => b[1] - a[1]).map(([k, n]) => (
              <li key={k} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{listingStatusLabel(k)}</span>
                <span className="font-semibold text-gray-900">{n}</span>
              </li>
            ))}
            {Object.keys(listingStatusCounts).length === 0 && (
              <li className="text-sm text-gray-400">Nav datu.</li>
            )}
          </ul>
        </section>
      </div>

      {/* D4 + D5 top tables */}
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-100 bg-white p-5">
          <h2 className="text-sm font-bold text-gray-900">Top 10 produkti · 30d</h2>
          {topProducts.length === 0 ? (
            <p className="mt-3 text-sm text-gray-400">Vēl nav samaksātu pasūtījumu pēdējās 30 dienās.</p>
          ) : (
            <table className="mt-3 w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-gray-400">
                <tr><th className="text-left font-medium pb-2">Produkts</th><th className="text-right font-medium pb-2">Gab.</th><th className="text-right font-medium pb-2">€</th></tr>
              </thead>
              <tbody>
                {topProducts.map((p) => (
                  <tr key={p.id} className="border-t border-gray-50">
                    <td className="py-1.5 pr-3 text-gray-700"><span className="line-clamp-1">{p.title}</span></td>
                    <td className="py-1.5 text-right tabular-nums text-gray-900">{p.units}</td>
                    <td className="py-1.5 text-right tabular-nums font-semibold text-gray-900">{formatPrice(p.revenueCents / 100)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="rounded-xl border border-gray-100 bg-white p-5">
          <h2 className="text-sm font-bold text-gray-900">Top 10 ražotāji · 30d</h2>
          {topSellers.length === 0 ? (
            <p className="mt-3 text-sm text-gray-400">Vēl nav samaksātu pasūtījumu pēdējās 30 dienās.</p>
          ) : (
            <table className="mt-3 w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-gray-400">
                <tr><th className="text-left font-medium pb-2">Ražotājs</th><th className="text-right font-medium pb-2">Gab.</th><th className="text-right font-medium pb-2">€</th></tr>
              </thead>
              <tbody>
                {topSellers.map((s) => (
                  <tr key={s.id} className="border-t border-gray-50">
                    <td className="py-1.5 pr-3 text-gray-700"><span className="line-clamp-1">{s.name}</span></td>
                    <td className="py-1.5 text-right tabular-nums text-gray-900">{s.units}</td>
                    <td className="py-1.5 text-right tabular-nums font-semibold text-gray-900">{formatPrice(s.revenueCents / 100)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      {/* D8 — Delivery stats */}
      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-gray-100 bg-white p-5">
          <h2 className="text-sm font-bold text-gray-900">Piegādes veidi · 30d</h2>
          <ul className="mt-3 space-y-2">
            {Object.entries(deliveryMethodCounts).sort((a, b) => b[1] - a[1]).map(([k, n]) => (
              <li key={k} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{deliveryMethodLabels[k] ?? k}</span>
                <span className="font-semibold text-gray-900">{n}</span>
              </li>
            ))}
            {Object.keys(deliveryMethodCounts).length === 0 && (
              <li className="text-sm text-gray-400">Nav datu.</li>
            )}
          </ul>
        </section>

        <section className="rounded-xl border border-gray-100 bg-white p-5">
          <h2 className="text-sm font-bold text-gray-900">Top pakomāti · 30d</h2>
          {topLockers.length === 0 ? (
            <p className="mt-3 text-sm text-gray-400">Nav pakomātu pasūtījumu.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {topLockers.map((l) => (
                <li key={l.name} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{l.name}</span>
                  <span className="font-semibold text-gray-900">{l.count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-gray-100 bg-white p-5">
          <h2 className="text-sm font-bold text-gray-900">Top adreses (kurjers) · 30d</h2>
          {topAddresses.length === 0 ? (
            <p className="mt-3 text-sm text-gray-400">Nav kurjera pasūtījumu.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {topAddresses.map((a, i) => (
                <li key={i} className="text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700 truncate">{a.address}{a.city ? `, ${a.city}` : ""}</span>
                    <span className="font-semibold text-gray-900 shrink-0 ml-2">{a.count}×</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>LV-{a.postalCode}</span>
                    <span>{formatPrice(a.gmvCents / 100)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* D9 — Address lookups (demand analytics) */}
      <section className="mt-8 rounded-xl border border-purple-200 bg-purple-50 p-5">
        <div className="mb-4">
          <h2 className="text-sm font-bold text-purple-900">Adrešu meklējumi · 30d</h2>
          <p className="text-xs text-purple-700 mt-0.5">
            Visas adreses, ko lietotāji ievadījuši piegādes laukā (arī bez pirkuma). Kopā: <strong>{lookups.length}</strong>
            {lookupOutsideCount > 0 && <> · ārpus zonām: <strong>{lookupOutsideCount}</strong></>}
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-purple-400 mb-2">Top pasta indeksi</p>
            {topLookupPostals.length === 0 ? (
              <p className="text-sm text-purple-300 italic">Vēl nav datu.</p>
            ) : (
              <ul className="space-y-1">
                {topLookupPostals.map((l) => (
                  <li key={l.postalCode} className="flex items-center justify-between text-sm">
                    <span className="text-purple-900">
                      <span className="font-mono font-semibold">LV-{l.postalCode}</span>
                      {l.city && <span className="text-purple-600 ml-1.5">{l.city}</span>}
                      {l.zone !== null && <span className="text-purple-400 ml-1 text-xs">(Z{l.zone})</span>}
                      {l.outsideZones && <span className="ml-1 rounded bg-amber-100 px-1 py-0.5 text-[9px] font-bold text-amber-700">ārpus</span>}
                    </span>
                    <span className="font-bold text-purple-900">{l.count}×</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-purple-400 mb-2">Top pilsētas</p>
            {topLookupCities.length === 0 ? (
              <p className="text-sm text-purple-300 italic">Vēl nav datu.</p>
            ) : (
              <ul className="space-y-1">
                {topLookupCities.map((c) => (
                  <li key={c.city} className="flex items-center justify-between text-sm">
                    <span className="text-purple-900">{c.city}</span>
                    <span className="font-bold text-purple-900">{c.count}×</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* D10 — Visitor stats */}
      <section className="mt-8 rounded-xl border border-blue-200 bg-blue-50 p-5">
        <div className="mb-4">
          <h2 className="text-sm font-bold text-blue-900">Lapas apmeklējumi · 30d</h2>
          <p className="text-xs text-blue-700 mt-0.5">
            Kopā: <strong>{pvMonth}</strong> · šodien: <strong>{pvToday}</strong> · nedēļā: <strong>{pvWeek}</strong>
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-2">Top lapas</p>
            {topPages.length === 0 ? (
              <p className="text-sm text-blue-300 italic">Vēl nav datu.</p>
            ) : (
              <ul className="space-y-1">
                {topPages.map((p) => (
                  <li key={p.path} className="flex items-center justify-between text-sm">
                    <span className="text-blue-900 font-mono text-xs truncate">{p.path}</span>
                    <span className="font-bold text-blue-900 shrink-0 ml-2">{p.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-2">Pa dienām</p>
            <div className="flex items-end gap-px h-24">
              {pvDays.map((d) => {
                const max = Math.max(...pvDays.map((x) => x.views), 1);
                const h = Math.max(2, (d.views / max) * 100);
                return (
                  <div key={d.date} className="flex-1 group relative">
                    <div
                      className="w-full rounded-t bg-blue-400 hover:bg-blue-600 transition"
                      style={{ height: `${h}%` }}
                      title={`${d.date}: ${d.views}`}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[9px] text-blue-400 mt-1">
              <span>{pvDays[0]?.date.slice(5)}</span>
              <span>{pvDays[pvDays.length - 1]?.date.slice(5)}</span>
            </div>
          </div>
        </div>
      </section>

      {/* D11 — Promo code stats */}
      <section className="mt-8 rounded-xl border border-green-200 bg-green-50 p-5">
        <div className="mb-4">
          <h2 className="text-sm font-bold text-green-900">Promo kodi</h2>
          <p className="text-xs text-green-700 mt-0.5">
            Kodi: <strong>{promoCodes.length}</strong> (aktīvi: {promoCodes.filter(c => c.active).length})
            {" · "}Izmantoti: <strong>{totalRedemptions}</strong>
            {" · "}Ietaupījums kopā: <strong>{formatPrice(totalSavingsCents / 100)}</strong>
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-green-400 mb-2">30d statistika</p>
            <ul className="space-y-2">
              <li className="flex items-center justify-between text-sm">
                <span className="text-green-900">Izmantošanas (30d)</span>
                <span className="font-bold text-green-900">{redemptionsMonth.length}</span>
              </li>
              <li className="flex items-center justify-between text-sm">
                <span className="text-green-900">Ietaupījums (30d)</span>
                <span className="font-bold text-green-900">{formatPrice(savingsMonthCents / 100)}</span>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-green-400 mb-2">Pa kodiem</p>
            {promoBreakdown.length === 0 ? (
              <p className="text-sm text-green-300 italic">Vēl nav izmantotu kodu.</p>
            ) : (
              <ul className="space-y-1">
                {promoBreakdown.map((p) => (
                  <li key={p.code} className="flex items-center justify-between text-sm">
                    <span className="text-green-900 font-mono font-semibold">{p.code}</span>
                    <span className="text-green-700">
                      {p.count}× · {formatPrice(p.savingsCents / 100)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* D12 — Email subscriber stats */}
      <section className="mt-8 rounded-xl border border-teal-200 bg-teal-50 p-5">
        <div className="mb-4">
          <h2 className="text-sm font-bold text-teal-900">E-pasta abonenti</h2>
          <p className="text-xs text-teal-700 mt-0.5">
            Kopā: <strong>{subsTotal}</strong>
            {" · "}Nedēļā: <strong>{subsWeek}</strong>
            {" · "}30d: <strong>{subsMonth}</strong>
            {" · "}MailerLite sinhronizēti: <strong>{subsSynced}</strong>/{subsTotal}
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-teal-400 mb-2">Pa avotiem</p>
            {subsBySource.size === 0 ? (
              <p className="text-sm text-teal-300 italic">Vēl nav abonentu.</p>
            ) : (
              <ul className="space-y-1">
                {[...subsBySource.entries()].sort((a, b) => b[1] - a[1]).map(([src, n]) => (
                  <li key={src} className="flex items-center justify-between text-sm">
                    <span className="text-teal-900">{sourceLabels[src] ?? src}</span>
                    <span className="font-bold text-teal-900">{n}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-teal-400 mb-2">Pēdējie abonenti</p>
            {emailSubs.length === 0 ? (
              <p className="text-sm text-teal-300 italic">Vēl nav abonentu.</p>
            ) : (
              <ul className="space-y-1">
                {emailSubs.slice(0, 10).map((s) => (
                  <li key={s.id} className="flex items-center justify-between text-sm gap-2">
                    <span className="text-teal-900 truncate">{s.email}</span>
                    <span className="shrink-0 text-xs text-teal-600">
                      {sourceLabels[s.source ?? "banner"] ?? s.source}
                      {s.mailerlite_synced && <span className="ml-1 text-green-600">✓ ML</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* G3 expiring soon */}
      <section className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-5">
        <h2 className="text-sm font-bold text-amber-900">⚠ Beidzas tuvākajās 3 dienās ({expiring.length})</h2>
        {expiring.length === 0 ? (
          <p className="mt-2 text-sm text-amber-800/70">Nav neviena produkta, kas beigtos tuvākajās 3 dienās. 🎉</p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {expiring.map((l) => {
              const seller = l.seller_id ? sellerById.get(l.seller_id) : null;
              return (
                <li key={l.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="line-clamp-1 text-amber-900">{l.title}</span>
                  <span className="shrink-0 text-xs text-amber-700">
                    {seller?.farm_name || seller?.name || "—"} · līdz {l.freshness_date}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Kpi({ title, value, sub, tone }: { title: string; value: string; sub?: string; tone?: "brand" | "warn" | "ok" }) {
  const toneCls =
    tone === "brand" ? "border-brand-200 bg-brand-50" :
    tone === "warn" ? "border-amber-200 bg-amber-50" :
    tone === "ok" ? "border-green-200 bg-green-50" :
    "border-gray-100 bg-white";
  return (
    <div className={`rounded-xl border p-4 ${toneCls}`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{title}</p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums text-gray-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

function statusLabel(s: string): string {
  return ({
    pending: "Gaida apmaksu",
    paid: "Apmaksāts",
    processing: "Apstrādē",
    shipped: "Nosūtīts",
    delivered: "Piegādāts",
    cancelled: "Atcelts",
  } as Record<string, string>)[s] ?? s;
}

function listingStatusLabel(s: string): string {
  return ({
    active: "Aktīvs",
    pending: "Gaida apstiprinājumu",
    draft: "Melnraksts",
    rejected: "Atteikts",
    sold_out: "Izpārdots",
    archived: "Arhīvā",
  } as Record<string, string>)[s] ?? s;
}
