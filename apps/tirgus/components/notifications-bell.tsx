"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Notification = {
  id: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
};

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const unread = items.filter((n) => !n.read).length;

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("id,title,message,read,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setItems(data ?? []);
  }

  async function handleOpen() {
    const opening = !open;
    setOpen(opening);
    if (opening && unread > 0) {
      const ids = items.filter((n) => !n.read).map((n) => n.id);
      await supabase.from("notifications").update({ read: true }).in("id", ids);
      setItems((ns) => ns.map((n) => ({ ...n, read: true })));
    }
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={handleOpen}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 transition">
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-10 left-0 z-50 w-80 rounded-2xl border border-gray-200 bg-white shadow-xl md:bottom-auto md:left-auto md:right-0 md:top-10">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <p className="text-sm font-bold text-gray-900">Paziņojumi</p>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          </div>
          {items.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-400">Nav paziņojumu</div>
          ) : (
            <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
              {items.map((n) => (
                <div key={n.id} className={`px-4 py-3 transition ${n.read ? "opacity-50" : "bg-brand-50/40"}`}>
                  <p className="text-xs font-bold text-gray-900">{n.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-gray-600">{n.message}</p>
                  <p className="mt-1 text-[10px] text-gray-400">
                    {new Date(n.created_at).toLocaleDateString("lv-LV", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
