"use client";

import { useEffect, useState } from "react";
import { MessageSquarePlus, Check, Eye, Loader2, ExternalLink, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";

async function getToken(): Promise<string | null> {
  // getUser() makes a network call to verify/refresh the token — more reliable
  // than getSession() which only reads from local storage.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

type Feedback = {
  id: string;
  message: string;
  email: string | null;
  page_url: string | null;
  user_agent: string | null;
  status: "new" | "seen" | "done";
  notes: string | null;
  created_at: string;
};

const statusCfg = {
  new:  { label: "Jauns",       cls: "bg-red-100 text-red-700" },
  seen: { label: "Apskatīts",   cls: "bg-amber-100 text-amber-700" },
  done: { label: "Izlabots",    cls: "bg-green-100 text-green-700" },
};

export default function AdminFeedbackPage() {
  const [items, setItems] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "new" | "seen" | "done">("all");
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const token = await getToken();
      if (!token) {
        setLoadError("Nav aktīvas sesijas. Lūdzu, piesakies vēlreiz.");
        setLoading(false);
        return;
      }
      const res = await fetch("/api/admin/feedback", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setLoadError(`API kļūda ${res.status}: ${data?.error ?? "nezināms"}`);
        setItems([]);
      } else if (!Array.isArray(data)) {
        setLoadError(`Negaidīts API atbildes formāts: ${JSON.stringify(data)}`);
        setItems([]);
      } else {
        setItems(data as Feedback[]);
      }
    } catch (e) {
      console.error("[feedback] load error:", e);
      setLoadError(e instanceof Error ? e.message : "Nezināma kļūda");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function setStatus(id: string, status: Feedback["status"]) {
    setUpdating(id);
    try {
      const token = await getToken();
      await fetch("/api/admin/feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ id, status }),
      });
      setItems((prev) => prev.map((i) => i.id === id ? { ...i, status } : i));
    } finally {
      setUpdating(null);
    }
  }

  const visible = filter === "all" ? items : items.filter((i) => i.status === filter);
  const newCount = items.filter((i) => i.status === "new").length;

  if (loading) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 size={24} className="animate-spin text-gray-400" />
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
            <MessageSquarePlus size={22} className="text-brand-600" />
            Kļūdu ziņojumi
            {newCount > 0 && (
              <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
                {newCount} jauni
              </span>
            )}
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">{items.length} kopā</p>
        </div>
        <button onClick={load}
          className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
          <RefreshCw size={14} /> Atjaunināt
        </button>
      </div>

      {loadError && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <strong>Kļūda ielādējot:</strong> {loadError}
        </div>
      )}

      {/* Filter tabs */}
      <div className="mb-5 flex gap-2 border-b border-gray-200 pb-1">
        {(["all", "new", "seen", "done"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`rounded-t-lg px-3 py-1.5 text-xs font-semibold transition ${
              filter === f
                ? "bg-[#192635] text-white"
                : "text-gray-500 hover:text-gray-900"
            }`}>
            {f === "all" ? "Visi" : statusCfg[f].label}
            <span className="ml-1.5 text-[10px] opacity-60">
              {f === "all" ? items.length : items.filter((i) => i.status === f).length}
            </span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
          <MessageSquarePlus size={36} className="mx-auto text-gray-300" />
          <p className="mt-3 font-semibold text-gray-900">Nav ziņojumu</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((item) => {
            const sc = statusCfg[item.status];
            const path = item.page_url ? item.page_url.replace(/^https?:\/\/[^/]+/, "") : null;
            return (
              <div key={item.id}
                className={`rounded-2xl border bg-white p-5 shadow-sm ${
                  item.status === "new" ? "border-red-200" : "border-gray-100"
                }`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Meta row */}
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-gray-400">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${sc.cls}`}>
                        {sc.label}
                      </span>
                      <span>{new Date(item.created_at).toLocaleString("lv-LV")}</span>
                      {item.email && (
                        <a href={`mailto:${item.email}`} className="text-brand-600 hover:underline">
                          {item.email}
                        </a>
                      )}
                      {path && (
                        <a href={item.page_url!} target="_blank" rel="noopener"
                          className="flex items-center gap-0.5 text-gray-400 hover:text-brand-600">
                          {path} <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                    {/* Message */}
                    <p className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed">
                      {item.message}
                    </p>
                  </div>

                  {/* Action buttons */}
                  <div className="flex shrink-0 flex-col gap-1">
                    {item.status === "new" && (
                      <button onClick={() => setStatus(item.id, "seen")} disabled={updating === item.id}
                        className="flex items-center gap-1 rounded-lg bg-amber-100 px-2.5 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-200 disabled:opacity-50">
                        {updating === item.id ? <Loader2 size={11} className="animate-spin" /> : <Eye size={11} />}
                        Apskatīts
                      </button>
                    )}
                    {item.status !== "done" && (
                      <button onClick={() => setStatus(item.id, "done")} disabled={updating === item.id}
                        className="flex items-center gap-1 rounded-lg bg-green-100 px-2.5 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-200 disabled:opacity-50">
                        {updating === item.id ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                        Izlabots
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
