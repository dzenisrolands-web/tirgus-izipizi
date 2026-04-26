"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, User, Package, ShoppingBag,
  Menu, X, LogOut, ChevronRight,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { NotificationsBell } from "@/components/notifications-bell";

const NAV = [
  { href: "/dashboard",           label: "Kopsavilkums", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/profils",   label: "Profils",       icon: User },
  { href: "/dashboard/produkti",  label: "Produkti",      icon: Package },
  { href: "/dashboard/pasutijumi",label: "Pasūtījumi",    icon: ShoppingBag },
];

function SidebarContent({
  pathname, email, onClose, onLogout,
}: {
  pathname: string; email: string;
  onClose: () => void; onLogout: () => void;
}) {
  return (
    <div className="flex h-full flex-col bg-white">
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-gray-100 px-5">
        <Link href="/" onClick={onClose} className="flex items-center gap-1.5">
          <span className="text-sm font-extrabold text-gray-900">tirgus.izipizi.lv</span>
        </Link>
        <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 md:hidden">
          <X size={18} />
        </button>
      </div>

      <div className="px-3 pt-3 pb-1">
        <p className="px-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Pārdevējs</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-3">
        {NAV.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link key={href} href={href} onClick={onClose}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                active
                  ? "bg-[#192635] text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <Icon size={16} />
              {label}
              {active && <ChevronRight size={14} className="ml-auto opacity-60" />}
            </Link>
          );
        })}
      </nav>

      {/* User / logout */}
      <div className="border-t border-gray-100 p-3 space-y-1">
        <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-700 truncate">{email}</p>
            <p className="text-[11px] text-gray-400">Pārdevēja konts</p>
          </div>
          <NotificationsBell />
        </div>
        <button onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition">
          <LogOut size={15} />
          Iziet
        </button>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [email, setEmail] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push("/login"); return; }
      setEmail(data.user.email ?? "");
    });
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="hidden md:fixed md:inset-y-0 md:left-0 md:flex md:w-56 md:flex-col border-r border-gray-100 z-30">
        <SidebarContent pathname={pathname} email={email} onClose={() => {}} onLogout={handleLogout} />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64">
            <SidebarContent pathname={pathname} email={email} onClose={() => setMobileOpen(false)} onLogout={handleLogout} />
          </aside>
        </div>
      )}

      {/* Content */}
      <div className="flex flex-1 flex-col md:ml-56">
        {/* Mobile topbar */}
        <div className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-gray-100 bg-white px-4 md:hidden">
          <button onClick={() => setMobileOpen(true)} className="rounded-lg p-1.5 text-gray-600 hover:bg-gray-100">
            <Menu size={20} />
          </button>
          <p className="flex-1 text-sm font-bold text-gray-900">
            {NAV.find(n => n.exact ? pathname === n.href : pathname.startsWith(n.href))?.label ?? "Dashboard"}
          </p>
          <NotificationsBell />
        </div>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
