"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Heart, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

type State = "loading" | "anon" | "not-following" | "following";

async function ensurePushSubscription(): Promise<void> {
  if (!("PushManager" in window) || !("serviceWorker" in navigator)) return;
  if (Notification.permission === "denied") return;

  const reg = await navigator.serviceWorker.register("/sw.js");
  const existing = await reg.pushManager.getSubscription();
  if (existing) return;

  const permission = Notification.permission === "granted"
    ? "granted"
    : await Notification.requestPermission();
  if (permission !== "granted") return;

  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapid) return;

  const padding = "=".repeat((4 - (vapid.length % 4)) % 4);
  const b64 = (vapid + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const applicationServerKey = Uint8Array.from(
    [...raw].map((c) => c.charCodeAt(0)),
  ).buffer as ArrayBuffer;

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey,
  });
  const { p256dh, auth } = sub.toJSON().keys as { p256dh: string; auth: string };
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  await fetch("/api/push/subscribe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ endpoint: sub.endpoint, p256dh, auth }),
  });
}

export function FollowSellerButton({
  sellerId,
  sellerName,
  className = "",
}: {
  sellerId: string;
  sellerName: string;
  className?: string;
}) {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setState("anon");
        return;
      }
      const { data } = await supabase
        .from("seller_followers")
        .select("user_id")
        .eq("user_id", user.id)
        .eq("seller_id", sellerId)
        .maybeSingle();
      setState(data ? "following" : "not-following");
    }
    load();
  }, [sellerId]);

  async function toggle() {
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // Send anonymous user to login, then come back here
        window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
        return;
      }

      if (state === "following") {
        await supabase.from("seller_followers").delete()
          .eq("user_id", user.id).eq("seller_id", sellerId);
        setState("not-following");
      } else {
        await supabase.from("seller_followers")
          .insert({ user_id: user.id, seller_id: sellerId });
        setState("following");
        // Best-effort: enable push so the follow actually delivers notifications.
        // If permission denied, follow still works (in-app bell will show).
        ensurePushSubscription().catch(() => {});
      }
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading") {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs text-gray-400 ${className}`}>
        <Loader2 size={12} className="animate-spin" />
      </span>
    );
  }

  if (state === "anon") {
    return (
      <button
        onClick={() => {
          window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
        }}
        className={`inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-100 ${className}`}
        title={`Pieslēdzies, lai sekotu ${sellerName}`}
      >
        <Heart size={12} /> Sekot
      </button>
    );
  }

  if (state === "following") {
    return (
      <button
        onClick={toggle}
        disabled={busy}
        className={`inline-flex items-center gap-1.5 rounded-full border border-brand-300 bg-brand-100 px-3 py-1.5 text-xs font-semibold text-brand-800 transition hover:bg-brand-200 disabled:opacity-50 ${className}`}
        title={`Pārtraukt sekot ${sellerName}`}
      >
        {busy ? <Loader2 size={12} className="animate-spin" /> : <Bell size={12} />}
        Sekoju
      </button>
    );
  }

  // not-following
  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-100 disabled:opacity-50 ${className}`}
      title={`Sekot ${sellerName} un saņemt paziņojumus par jauniem produktiem`}
    >
      {busy ? <Loader2 size={12} className="animate-spin" /> : <Heart size={12} />}
      Sekot ražotājam
    </button>
  );
}

// Small status pill — used on browser-blocked / unsupported scenarios
export function PushBlockedPill({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs text-gray-400 ${className}`}>
      <BellOff size={12} /> Paziņojumi bloķēti pārlūkā
    </span>
  );
}
