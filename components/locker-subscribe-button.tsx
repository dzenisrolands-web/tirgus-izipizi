"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";

export function LockerSubscribeButton({
  lockerId,
  className = "",
  size = "sm",
}: {
  lockerId: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [showLoginNudge, setShowLoginNudge] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      setAuthed(!!session);
      if (!session) {
        setSubscribed(false);
        return;
      }
      const res = await fetch("/api/locker-subscriptions", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        setSubscribed(false);
        return;
      }
      const { subscriptions } = await res.json();
      if (cancelled) return;
      const has = subscriptions?.some((s: { locker_id: string }) => s.locker_id === lockerId);
      setSubscribed(!!has);
    })();
    return () => { cancelled = true; };
  }, [lockerId]);

  async function toggle() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setShowLoginNudge(true);
      setTimeout(() => setShowLoginNudge(false), 3000);
      return;
    }
    setLoading(true);
    try {
      if (subscribed) {
        await fetch(`/api/locker-subscriptions?lockerId=${encodeURIComponent(lockerId)}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        setSubscribed(false);
      } else {
        await fetch("/api/locker-subscriptions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ lockerId, pushEnabled: true }),
        });
        setSubscribed(true);
      }
    } finally {
      setLoading(false);
    }
  }

  if (subscribed === null) {
    return (
      <div className={`inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-400 ${className}`}>
        <Loader2 size={11} className="animate-spin" />
      </div>
    );
  }

  const padding = size === "md" ? "px-4 py-1.5" : "px-3 py-1";
  const text = size === "md" ? "text-sm" : "text-xs";
  const iconSize = size === "md" ? 13 : 11;

  return (
    <div className="relative inline-flex">
      <button
        onClick={toggle}
        disabled={loading}
        className={`inline-flex items-center gap-1 rounded-full font-semibold transition disabled:opacity-50 ${padding} ${text} ${
          subscribed
            ? "bg-brand-100 text-brand-700 hover:bg-brand-200"
            : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
        } ${className}`}
        title={subscribed ? "Atrakstīties no šī pakomāta" : "Saņemt paziņojumus par šo pakomātu"}
      >
        {loading ? (
          <Loader2 size={iconSize} className="animate-spin" />
        ) : subscribed ? (
          <><Check size={iconSize} /> Abonēts</>
        ) : (
          <><Bell size={iconSize} /> Saņemt paziņojumus</>
        )}
      </button>
      {showLoginNudge && (
        <div className="absolute right-0 top-full z-10 mt-1 whitespace-nowrap rounded-lg bg-gray-900 px-3 py-1.5 text-[10px] text-white shadow-lg">
          Pieslēdzies, lai abonētu →{" "}
          <a href="/login" className="underline">Pieslēgties</a>
        </div>
      )}
    </div>
  );
}
