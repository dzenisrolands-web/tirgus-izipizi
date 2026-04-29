"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

type State = "loading" | "unsupported" | "denied" | "subscribed" | "unsubscribed";

async function registerSW(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch {
    return null;
  }
}

function urlBase64ToUint8Array(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0))).buffer as ArrayBuffer;
}

export function PushSubscribeButton({ className = "" }: { className?: string }) {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!("PushManager" in window) || !("serviceWorker" in navigator)) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    registerSW().then(async (reg) => {
      if (!reg) { setState("unsupported"); return; }
      const existing = await reg.pushManager.getSubscription();
      setState(existing ? "subscribed" : "unsubscribed");
    });
  }, []);

  async function subscribe() {
    setBusy(true);
    try {
      const reg = await registerSW();
      if (!reg) return;

      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setState("denied"); return; }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ),
      });

      const { p256dh, auth } = sub.toJSON().keys as { p256dh: string; auth: string };
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setState("unsubscribed"); return; }

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ endpoint: sub.endpoint, p256dh, auth }),
      });

      setState("subscribed");
    } finally {
      setBusy(false);
    }
  }

  async function unsubscribe() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (!sub) { setState("unsubscribed"); return; }

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
      }
      await sub.unsubscribe();
      setState("unsubscribed");
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading") return null;
  if (state === "unsupported") return null;

  if (state === "denied") {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs text-gray-400 ${className}`}>
        <BellOff size={12} /> Bloķēts pārlūkā
      </span>
    );
  }

  if (state === "subscribed") {
    return (
      <button onClick={unsubscribe} disabled={busy}
        className={`inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-100 transition ${className}`}>
        {busy ? <Loader2 size={12} className="animate-spin" /> : <Bell size={12} />}
        Paziņojumi ieslēgti
      </button>
    );
  }

  return (
    <button onClick={subscribe} disabled={busy}
      className={`inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-600 hover:bg-orange-100 transition ${className}`}>
      {busy ? <Loader2 size={12} className="animate-spin" /> : <Bell size={12} />}
      Paziņojumi par jauniem drops
    </button>
  );
}
