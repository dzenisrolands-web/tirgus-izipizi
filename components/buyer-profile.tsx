"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShoppingBag, Heart, Gift, Settings, LogOut, ChevronRight,
  Loader2, Package, MapPin, Bell,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Stats = {
  orderCount: number;
  pendingCount: number;
  followingCount: number;
};

export function BuyerProfile() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [stats, setStats] = useState<Stats>({ orderCount: 0, pendingCount: 0, followingCount: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login?next=/profils");
        return;
      }
      setEmail(user.email ?? "");
      setName(user.user_metadata?.name ?? user.email?.split("@")[0] ?? "");

      // Pull buyer's order count by their email (buyer-side queries by email,
      // not by user_id, since guest checkouts use email only).
      const userEmail = user.email ?? "";
      const [
        { count: orderCount },
        { count: pendingCount },
        { count: followingCount },
      ] = await Promise.all([
        supabase.from("orders").select("*", { count: "exact", head: true }).eq("buyer_email", userEmail),
        supabase.from("orders").select("*", { count: "exact", head: true })
          .eq("buyer_email", userEmail).in("status", ["pending", "paid", "processing", "shipped"]),
        supabase.from("seller_followers").select("*", { count: "exact", head: true }).eq("user_id", user.id),
      ]);
      setStats({
        orderCount: orderCount ?? 0,
        pendingCount: pendingCount ?? 0,
        followingCount: followingCount ?? 0,
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
              {name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">
                Pircēja konts
              </p>
              <h1 className="mt-0.5 truncate text-xl font-extrabold text-gray-900">
                Sveiks, {name}!
              </h1>
              <p className="truncate text-xs text-gray-500">{email}</p>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-6 grid grid-cols-3 gap-3">
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
            <Stat
              icon={<Heart size={16} />}
              value={stats.followingCount}
              label="Sekoju"
              tone="pink"
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
            href="/razotaji"
            icon={<Heart size={18} className="text-pink-500" />}
            title="Sekoju ražotājiem"
            desc="Saņem paziņojumus par jauniem produktiem"
            badge={stats.followingCount > 0 ? stats.followingCount : undefined}
          />
          <NavCard
            href="#"
            icon={<Gift size={18} className="text-purple-600" />}
            title="Mani bonusi"
            desc="Drīz: bezmaksas sūtījumi, atlaides un dāvanas"
            disabled
          />
          <NavCard
            href="/cart"
            icon={<ShoppingBag size={18} className="text-amber-600" />}
            title="Mans grozs"
            desc="Pabeidz pirkumu vai pārbaudi saturu"
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
  tone: "blue" | "amber" | "pink";
}) {
  const palette = {
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
    pink: "bg-pink-50 text-pink-700",
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
