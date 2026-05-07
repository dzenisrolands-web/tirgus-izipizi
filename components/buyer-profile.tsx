"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShoppingBag, Gift, Settings, LogOut, ChevronRight,
  Loader2, Package, MapPin, Bell,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Stats = {
  orderCount: number;
  pendingCount: number;
};

export function BuyerProfile() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>({ orderCount: 0, pendingCount: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login?next=/profils");
        return;
      }
      setEmail(user.email ?? "");
      // Show first name only, in greeting. Order of preference:
      //   1. user_metadata.first_name (set by our buyer signup form)
      //   2. user_metadata.full_name (set by Google OAuth) → first token
      //   3. user_metadata.name → first token
      // No email fallback — "dzenis.rolands" greeting feels robotic.
      const meta = user.user_metadata ?? {};
      const candidate =
        (typeof meta.first_name === "string" && meta.first_name) ||
        (typeof meta.full_name === "string" && meta.full_name.split(" ")[0]) ||
        (typeof meta.name === "string" && meta.name.split(" ")[0]) ||
        null;
      setFirstName(candidate ? candidate.trim() : null);

      // Pull buyer's order count by their email (buyer-side queries by email,
      // not by user_id, since guest checkouts use email only).
      const userEmail = user.email ?? "";
      const [
        { count: orderCount },
        { count: pendingCount },
      ] = await Promise.all([
        supabase.from("orders").select("*", { count: "exact", head: true }).eq("buyer_email", userEmail),
        supabase.from("orders").select("*", { count: "exact", head: true })
          .eq("buyer_email", userEmail).in("status", ["pending", "paid", "processing", "shipped"]),
      ]);
      setStats({
        orderCount: orderCount ?? 0,
        pendingCount: pendingCount ?? 0,
      });
      setLoading(false);
    }
    load();
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 size={20} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 to-white">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        {/* Welcome card */}
        <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-brand-100">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-700 text-2xl font-extrabold">
              {(firstName?.charAt(0) ?? email.charAt(0) ?? "?").toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">
                Pircēja konts
              </p>
              <h1 className="mt-0.5 truncate text-xl font-extrabold text-gray-900">
                {firstName ? `Sveiks, ${firstName}!` : "Sveiks!"}
              </h1>
              <p className="truncate text-xs text-gray-500">{email}</p>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Stat
              icon={<Package size={16} />}
              value={stats.orderCount}
              label="Pasūtījumi"
              tone="blue"
            />
            <Stat
              icon={<ShoppingBag size={16} />}
              value={stats.pendingCount}
              label="Aktīvi"
              tone="amber"
            />
          </div>
        </div>

        {/* Action cards */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <NavCard
            href="/profils/pasutijumi"
            icon={<Package size={18} className="text-brand-700" />}
            title="Mani pasūtījumi"
            desc="Skati pasūtījumu vēsturi un statusus"
            badge={stats.pendingCount > 0 ? stats.pendingCount : undefined}
          />
          <NavCard
            href="/cart"
            icon={<ShoppingBag size={18} className="text-amber-600" />}
            title="Mans grozs"
            desc="Pabeidz pirkumu vai pārbaudi saturu"
          />
          <NavCard
            href="#"
            icon={<Gift size={18} className="text-purple-600" />}
            title="Mani bonusi"
            desc="Drīz: bezmaksas sūtījumi, atlaides un dāvanas"
            disabled
          />
          <NavCard
            href="/catalog"
            icon={<Package size={18} className="text-green-600" />}
            title="Atrast produktus"
            desc="Pārlūko visus Latvijas ražotāju produktus"
          />
        </div>

        {/* Quick actions */}
        <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">
            Konts
          </h2>
          <div className="mt-3 space-y-1">
            <button
              type="button"
              disabled
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-gray-400 transition"
              title="Drīz būs pieejams"
            >
              <Settings size={16} />
              <span className="flex-1">Personīgā informācija</span>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold">Drīz</span>
            </button>
            <button
              type="button"
              disabled
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-gray-400 transition"
              title="Drīz būs pieejams"
            >
              <Bell size={16} />
              <span className="flex-1">Paziņojumu iestatījumi</span>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold">Drīz</span>
            </button>
            <button
              type="button"
              disabled
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-gray-400 transition"
              title="Drīz būs pieejams"
            >
              <MapPin size={16} />
              <span className="flex-1">Saglabātās adreses</span>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold">Drīz</span>
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-red-600 transition hover:bg-red-50"
            >
              <LogOut size={16} />
              <span className="flex-1">Iziet</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon, value, label, tone,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  tone: "blue" | "amber";
}) {
  const palette = {
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
  }[tone];
  return (
    <div className="rounded-2xl bg-gray-50 p-3 text-center">
      <div className={`mx-auto flex h-7 w-7 items-center justify-center rounded-lg ${palette}`}>
        {icon}
      </div>
      <p className="mt-1.5 text-lg font-extrabold text-gray-900">{value}</p>
      <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500">{label}</p>
    </div>
  );
}

function NavCard({
  href, icon, title, desc, badge, disabled,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  badge?: number;
  disabled?: boolean;
}) {
  const inner = (
    <>
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-50">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-bold text-gray-900">{title}</p>
          {badge !== undefined && (
            <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold text-brand-700">
              {badge}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-gray-500">{desc}</p>
      </div>
      <ChevronRight size={16} className="shrink-0 text-gray-300" />
    </>
  );

  if (disabled) {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-white p-4 opacity-60 ring-1 ring-gray-100" title="Drīz būs pieejams">
        {inner}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-gray-100 transition hover:ring-brand-300 hover:shadow-sm"
    >
      {inner}
    </Link>
  );
}
