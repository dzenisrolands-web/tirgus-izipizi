"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, User, Package, ShoppingBag,
  Menu, X, LogOut, ChevronRight, Lock, Clock, CheckCircle, AlertCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { NotificationsBell } from "@/components/notifications-bell";

// Routes that require approved status to access
const GATED_ROUTES = [
  "/dashboard/produkti",
  "/dashboard/pasutijumi",
  "/dashboard/rekini",
  "/dashboard/keriens",
];

const NAV = [
  { href: "/dashboard",            label: "Kopsavilkums", icon: LayoutDashboard, exact: true, gated: false },
  { href: "/dashboard/profils",    label: "Profils",       icon: User,            gated: false },
  { href: "/dashboard/produkti",   label: "Produkti",      icon: Package,         gated: true },
  { href: "/dashboard/pasutijumi", label: "Pasūtījumi",    icon: ShoppingBag,     gated: true },
];

function SidebarContent({
  pathname, email, onClose, onLogout, approved,
}: {
  pathname: string; email: string;
  onClose: () => void; onLogout: () => void;
  approved: boolean;
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
        {NAV.map(({ href, label, icon: Icon, exact, gated }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          const locked = gated && !approved;
          return (
            <Link key={href} href={locked ? "/dashboard/profils" : href} onClick={onClose}
              title={locked ? "Pieejams pēc profila apstiprināšanas" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                active && !locked
                  ? "bg-[#192635] text-white shadow-sm"
                  : locked
                  ? "cursor-not-allowed text-gray-300"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <Icon size={16} />
              {label}
              {locked
                ? <Lock size={12} className="ml-auto opacity-50" />
                : active && <ChevronRight size={14} className="ml-auto opacity-60" />
              }
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

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [sellerStatus, setSellerStatus] = useState<"draft" | "pending" | "approved" | "rejected" | null>(null);
  const [missingCount, setMissingCount] = useState(0);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setEmail(user.email ?? "");

      const { data: seller } = await supabase
        .from("sellers")
        .select("status, name, description, legal_name, registration_number, bank_iban, legal_address, self_billing_agreed, home_locker_ids, courier_pickup_address")
        .eq("user_id", user.id)
        .single();

      if (!seller) {
        // No seller profile record yet — user hasn't completed onboarding
        setSellerStatus("draft");
        setMissingCount(-1); // sentinel: profile doesn't exist yet
        return;
      }

      setSellerStatus(seller.status ?? "draft");

      // Count missing required fields
      let missing = 0;
      if (!seller.description || seller.description.length < 20) missing++;
      if (!seller.legal_name || !seller.registration_number) missing++;
      if (!seller.bank_iban) missing++;
      if (!seller.legal_address) missing++;
      if (!seller.self_billing_agreed) missing++;
      const hasLocation = (seller.home_locker_ids?.length ?? 0) > 0 || !!seller.courier_pickup_address?.trim();
      if (!hasLocation) missing++;
      setMissingCount(missing);
    })();
  }, [router, pathname]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const approved = sellerStatus === "approved";
  const isGatedRoute = GATED_ROUTES.some(r => pathname.startsWith(r));

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="hidden md:fixed md:inset-y-0 md:left-0 md:flex md:w-56 md:flex-col border-r border-gray-100 z-30">
        <SidebarContent pathname={pathname} email={email} approved={approved} onClose={() => {}} onLogout={handleLogout} />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64">
            <SidebarContent pathname={pathname} email={email} approved={approved} onClose={() => setMobileOpen(false)} onLogout={handleLogout} />
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

        {/* Onboarding status banner (non-approved sellers) */}
        {sellerStatus && sellerStatus !== "approved" && (
          <div className={`border-b px-4 py-3 text-sm ${
            sellerStatus === "rejected"
              ? "border-red-200 bg-red-50"
              : sellerStatus === "pending"
              ? "border-amber-200 bg-amber-50"
              : "border-blue-200 bg-blue-50"
          }`}>
            <div className="mx-auto max-w-3xl flex items-center gap-3">
              {sellerStatus === "pending" ? (
                <Clock size={16} className="shrink-0 text-amber-600" />
              ) : sellerStatus === "rejected" ? (
                <AlertCircle size={16} className="shrink-0 text-red-600" />
              ) : (
                <CheckCircle size={16} className="shrink-0 text-blue-600" />
              )}
              <div className="flex-1">
                {sellerStatus === "pending" ? (
                  <span className="text-amber-800">
                    <strong>Gaida apstiprinājumu</strong> — izskatīsim 1–2 darba dienu laikā.
                    Tikmēr vari papildināt{" "}
                    <Link href="/dashboard/profils" className="font-semibold underline">profilu</Link>.
                  </span>
                ) : sellerStatus === "rejected" ? (
                  <span className="text-red-800">
                    <strong>Pieteikums noraidīts</strong> — sazinies ar mums:
                    {" "}<a href="mailto:tirgus@izipizi.lv" className="font-semibold underline">tirgus@izipizi.lv</a>
                  </span>
                ) : (
                  <span className="text-blue-800">
                    {missingCount === -1 ? (
                      // No seller record yet
                      <>
                        <strong>Izveido savu profilu</strong> — aizpildi nepieciešamo informāciju, lai sāktu pārdot.
                        {" "}<Link href="/dashboard/profils" className="font-semibold underline">Sākt →</Link>
                      </>
                    ) : missingCount > 0 ? (
                      // Profile exists but incomplete
                      <>
                        <strong>Profils nepilnīgs</strong> — vēl trūkst {missingCount} obligāt{missingCount === 1 ? "s lauks" : "ie lauki"}.
                        {" "}<Link href="/dashboard/profils" className="font-semibold underline">Aizpildīt tagad →</Link>
                      </>
                    ) : (
                      // All fields filled, submit for approval
                      <>
                        <strong>Profils gatavs!</strong> Iesniedz to apstiprināšanai, lai sāktu pievienot produktus.
                        {" "}<Link href="/dashboard/profils" className="font-semibold underline">Iesniegt →</Link>
                      </>
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Gate — block access to produkti/pasutijumi/rekini if not approved */}
        {isGatedRoute && !approved ? (
          <div className="flex flex-1 items-center justify-center p-8">
            <div className="max-w-sm rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
                <Lock size={24} className="text-gray-400" />
              </div>
              <h2 className="mt-4 text-lg font-bold text-gray-900">Sadaļa slēgta</h2>
              <p className="mt-2 text-sm text-gray-500">
                {sellerStatus === "pending"
                  ? "Šī sadaļa kļūst pieejama pēc tam, kad admins apstiprina tavu profilu (1–2 darba dienas)."
                  : "Lai piekļūtu pie produktiem un pasūtījumiem, vispirms aizpildi profilu un iesniedz to apstiprināšanai."
                }
              </p>
              <Link
                href="/dashboard/profils"
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#192635] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#243647] transition"
              >
                {sellerStatus === "pending" ? "Skatīt profilu" : "Aizpildīt profilu"}
                <ChevronRight size={14} />
              </Link>
            </div>
          </div>
        ) : (
          <main className="flex-1">{children}</main>
        )}
      </div>
    </div>
  );
}
