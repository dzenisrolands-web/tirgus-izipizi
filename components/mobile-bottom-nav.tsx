"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Home, Grid2X2, ShoppingCart, User, Sparkles } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { AISearchDialog } from "./ai-search-dialog";

export function MobileBottomNav() {
  const pathname = usePathname();
  const { count } = useCart();
  const [userHref, setUserHref] = useState("/login");
  const [aiOpen, setAiOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserHref("/dashboard");
    });
  }, []);

  // Close AI dialog on navigation
  useEffect(() => { setAiOpen(false); }, [pathname]);

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
      <AISearchDialog open={aiOpen} onClose={() => setAiOpen(false)} />

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

          {/* AI assistant — center hero button */}
          <button
            onClick={() => setAiOpen(true)}
            className="flex flex-col items-center pb-1 active:scale-90 transition-transform"
            aria-label="AI asistents">
            <div className="flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-transform active:scale-95"
              style={{ background: "linear-gradient(135deg, #53F3A4, #AD47FF)" }}>
              <Sparkles size={20} strokeWidth={2.4} className="text-[#192635]" />
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
