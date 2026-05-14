"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Home, Grid2X2, ShoppingCart, User, Search } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export function MobileBottomNav() {
  const pathname = usePathname();
  const { count } = useCart();
  const [userHref, setUserHref] = useState("/login");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserHref("/dashboard");
    });
  }, []);

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

        {/* Search — center button */}
        <NavItem href="/catalog" label="Meklēt" active={false}>
          <Search size={20} strokeWidth={1.8} />
        </NavItem>

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
