"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Users, Package, ShoppingBag, UserCheck,
  Menu, X, LogOut, ChevronRight, ShieldCheck, Star, BarChart3, UserCog,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin",                      label: "Kopsavilkums",        icon: LayoutDashboard, exact: true },
  { href: "/admin/statistika",           label: "Statistika",          icon: BarChart3 },
  { href: "/admin/razotaji",             label: "Ražotāji",            icon: Users },
  { href: "/admin/produkti",             label: "Produkti",            icon: Package },
  { href: "/admin/nedelas-piedavajums",  label: "Nedēļas piedāvājums", icon: Star },
  { href: "/admin/pasutijumi",           label: "Pasūtījumi",          icon: ShoppingBag },
  { href: "/admin/pirceji",              label: "Pircēji",             icon: UserCheck },
  { href: "/admin/komanda",              label: "Komanda",             icon: UserCog },
];

function SidebarContent({
  pathname, email, pendingCount, pendingProducts, onClose, onLogout,
}: {
  pathname: string; email: string; pendingCount: number; pendingProducts: number;
  onClose: () => void; onLogout: () => void;
}) {
  return (
    <div className="flex h-full flex-col bg-[#192635]">
      <div className="flex h-16 items-center justify-between border-b border-white/10 px-5">
        <Link href="/" onClick={onClose} className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-brand-400" />
          <span className="text-sm font-extrabold text-white">Admin</span>
        </Link>
        <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-white/10 md:hidden">
          <X size={18} />
        </button>
      </div>

      <div className="px-3 pt-3 pb-1">
        <p className="px-2 text-[10px] font-semibold uppercase tracking-widest text-gray-500">Pārvaldība</p>
      </div>

      <nav className="flex-1 space-y-0.5 px-3">
        {NAV.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          const showBadge = (href === "/admin/razotaji" && pendingCount > 0) ||
                            (href === "/admin/produkti" && pendingProducts > 0);
          return (
            <Link key={href} href={href} onClick={onClose}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                active
                  ? "bg-brand-400/20 text-brand-300"
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              )}
            >
              <Icon size={16} />
              {label}
              {showBadge && (
                <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">
                  {href === "/admin/produkti" ? pendingProducts : pendingCount}
                </span>
              )}
              {active && !showBadge && <ChevronRight size={14} className="ml-auto opacity-60" />}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3 space-y-1">
        <div className="rounded-xl bg-white/5 px-3 py-2">
          <p className="text-xs font-medium text-gray-300 truncate">{email}</p>
          <p className="text-[11px] text-gray-500">Super Admin</p>
        </div>
        <button onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-gray-400 hover:bg-white/5 hover:text-white transition">
          <LogOut size={15} />
          Iziet
        </button>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingProducts, setPendingProducts] = useState(0);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push("/login"); return; }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();
      if (profile?.role !== "super_admin") { router.push("/"); return; }
      setEmail(data.user.email ?? "");
    });
    async function fetchPending() {
      const [{ count: sellers }, { count: products }] = await Promise.all([
        supabase.from("sellers").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("listings").select("*", { count: "exact", head: true }).eq("status", "pending_review"),
      ]);
      setPendingCount((sellers ?? 0) + (products ?? 0));
      setPendingProducts(products ?? 0);
    }
    fetchPending();
    const interval = setInterval(fetchPending, 30000);
    return () => clearInterval(interval);
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="hidden md:fixed md:inset-y-0 md:left-0 md:flex md:w-56 md:flex-col z-30">
        <SidebarContent pathname={pathname} email={email} pendingCount={pendingCount} pendingProducts={pendingProducts} onClose={() => {}} onLogout={handleLogout} />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64">
            <SidebarContent pathname={pathname} email={email} pendingCount={pendingCount} pendingProducts={pendingProducts} onClose={() => setMobileOpen(false)} onLogout={handleLogout} />
          </aside>
        </div>
      )}

      <div className="flex flex-1 flex-col md:ml-56">
        <div className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-gray-100 bg-white px-4 md:hidden">
          <button onClick={() => setMobileOpen(true)} className="rounded-lg p-1.5 text-gray-600 hover:bg-gray-100">
            <Menu size={20} />
          </button>
          <p className="text-sm font-bold text-gray-900">Admin</p>
        </div>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
