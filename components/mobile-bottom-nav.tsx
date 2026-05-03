"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Home, Grid2X2, Search, ShoppingCart, User, X, ArrowRight } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { count } = useCart();
  const [userHref, setUserHref] = useState("/login");
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserHref("/dashboard");
    });
  }, []);

  useEffect(() => {
    if (searchOpen) setTimeout(() => inputRef.current?.focus(), 80);
    else setQuery("");
  }, [searchOpen]);

  useEffect(() => { setSearchOpen(false); }, [pathname]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/catalog?q=${encodeURIComponent(query.trim())}`);
      setSearchOpen(false);
    }
  }

  if (pathname.startsWith("/dashboard") || pathname.startsWith("/admin")) return null;

  const leftItems = [
    { href: "/",        icon: Home,    label: "Sākums" },
    { href: "/catalog", icon: Grid2X2, label: "Katalogs" },
  ];
  const rightItems = [
    { href: "/cart",  icon: ShoppingCart, label: "Grozs",  badge: count },
    { href: userHref, icon: User,         label: userHref === "/dashboard" ? "Profils" : "Ieiet" },
  ];

  return (
    <>
      {/* Search overlay */}
      {searchOpen && (
        <div className="fixed inset-0 z-[60] flex flex-col md:hidden">
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setSearchOpen(false)} />
          <div className="animate-slide-up rounded-t-3xl bg-white px-5 pb-8 pt-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-base font-extrabold text-gray-900">Meklēt</p>
              <button onClick={() => setSearchOpen(false)}
                className="rounded-full p-1.5 hover:bg-gray-100 active:scale-90 transition-transform">
                <X size={18} className="text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSearch} action="/catalog" method="get" className="relative">
              <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={inputRef}
                name="q"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Meklēt produktus, ražotājus..."
                enterKeyHint="search"
                autoComplete="off"
                className="input w-full rounded-2xl pl-10 pr-12 py-3 text-base"
              />
              {query.trim() && (
                <button type="submit"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-[#192635] p-1.5 transition active:scale-90">
                  <ArrowRight size={14} className="text-white" />
                </button>
              )}
            </form>
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Populāri</p>
              <div className="flex flex-wrap gap-2">
                {["Pelmeņi", "Saldējums", "Siers", "Gaļa", "Dārzeņi", "Austeres"].map(s => (
                  <button key={s}
                    onClick={() => { router.push(`/catalog?q=${encodeURIComponent(s)}`); setSearchOpen(false); }}
                    className="rounded-full bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200 active:scale-95 transition-transform">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-100 bg-white/95 backdrop-blur-sm md:hidden">
        <div className="grid grid-cols-5 items-end pb-1">
          {leftItems.map(({ href, icon: Icon, label }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <NavItem key={href} href={href} label={label} active={active}>
                <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
              </NavItem>
            );
          })}

          {/* Search — center hero button */}
          <button
            onClick={() => setSearchOpen(true)}
            className="flex flex-col items-center pb-1 active:scale-90 transition-transform"
            aria-label="Meklēt">
            <div className="flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-transform active:scale-95"
              style={{ background: "linear-gradient(135deg, #53F3A4, #AD47FF)" }}>
              <Search size={20} strokeWidth={2.2} className="text-[#192635]" />
            </div>
          </button>

          {rightItems.map(({ href, icon: Icon, label, badge }) => {
            const active = pathname.startsWith(href) && href !== "/login";
            return (
              <NavItem key={href} href={href} label={label} active={active} badge={badge}>
                <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
              </NavItem>
            );
          })}
        </div>
      </nav>
    </>
  );
}

function NavItem({ href, label, active, badge, children }: {
  href: string; label: string; active: boolean; badge?: number; children: React.ReactNode;
}) {
  return (
    <Link href={href}
      className={cn(
        "flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-all active:scale-90",
        active ? "text-[#192635]" : "text-gray-400"
      )}>
      <div className={cn(
        "relative flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-200",
        active ? "bg-[#192635]/10" : ""
      )}>
        {children}
        {badge != null && badge > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold"
            style={{ backgroundColor: "#53F3A4", color: "#192635" }}>
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </div>
      {label}
    </Link>
  );
}
