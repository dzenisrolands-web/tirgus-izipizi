import { supabase } from "@/lib/supabase";
import { formatPrice } from "@/lib/utils";
import { OrdersTimeline } from "./orders-timeline";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Pre-launch commission rate is per-product (5–20%) but the field is not
// yet stored on listings. Use 10% as a working estimate until the per-product
// rate column ships. TODO(post-launch): replace with COALESCE(commission_pct, 10).
const ESTIMATED_COMMISSION_PCT = 0.1;

type OrderRow = {
  id: string;
  status: string;
  total_cents: number;
  items: Array<{ id?: string; title?: string; quantity?: number; price?: number }> | null;
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

type SellerRow = { id: string; name: string; farm_name: string | null };

function startOfDayISO(daysAgo = 0): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

export default async function StatistikaPage() {
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
  ] = await Promise.all([
    // Paid orders in the last ~50 days (covers month timeline + revenue stats)
    supabase
      .from("orders")
      .select("id, status, total_cents, items, paid_at, created_at")
      .or(`paid_at.gte.${fortyNineDaysAgo},and(status.eq.paid,paid_at.is.null)`)
      .order("paid_at", { ascending: false }),
    // All orders (any status) for the status split
    supabase.from("orders").select("status", { count: "exact", head: false }),
    // All listings — for status counts
    supabase.from("listings").select("id, title, status, seller_id, freshness_date"),
    // Seller name lookup
    supabase.from("sellers").select("id, name, farm_name"),
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

  // D6 — estimated commission earned in last 30 days (10% placeholder)
  const commissionMonth = Math.round(gmvMonth * ESTIMATED_COMMISSION_PCT);

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
        <Kpi title="Šodien" value={`${ordersToday.length}`} sub="pasūtījumi" />
        <Kpi title="Nedēļa" value={`${ordersWeek.length}`} sub="pasūtījumi" />
        <Kpi title="Mēnesis" value={`${ordersMonth.length}`} sub="pasūtījumi" />
        <Kpi title="GMV / 30d" value={formatPrice(gmvMonth / 100)} sub={`vid. ${formatPrice(aovMonth / 100)}/pas.`} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi title="Komisija (~10%)" value={formatPrice(commissionMonth / 100)} sub="aplēse pēdējās 30d" tone="brand" />
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
