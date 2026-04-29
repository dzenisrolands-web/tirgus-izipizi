"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Flame, Clock, Package, X, Loader2, Eye } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { fetchSellerDrops, cancelDrop } from "@/lib/hot-drops/queries";
import { availableQuantity } from "@/lib/hot-drops/types";
import { cn } from "@/lib/utils";
import type { HotDrop, DropStatus } from "@/lib/hot-drops/types";

const STATUS_MAP: Record<DropStatus, { label: string; cls: string }> = {
  active:    { label: "Aktīvs 🔥",   cls: "bg-orange-100 text-orange-700" },
  expired:   { label: "Beidzies",    cls: "bg-gray-100 text-gray-500" },
  sold_out:  { label: "Izpārdots ✅", cls: "bg-green-100 text-green-700" },
  cancelled: { label: "Atcelts",     cls: "bg-red-100 text-red-500" },
};

function formatExpiry(drop: HotDrop): string {
  const ms = new Date(drop.expires_at).getTime() - Date.now();
  if (ms <= 0) return "Beidzies";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 48) return `${Math.floor(h / 24)} dienas`;
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

export default function DashboardDropsPage() {
  const [drops, setDrops] = useState<HotDrop[]>([]);
  const [loading, setLoading] = useState(true);
  const [sellerId, setSellerId] = useState("");
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: seller } = await supabase
        .from("sellers").select("id").eq("user_id", user.id).single();
      if (!seller) { setLoading(false); return; }
      setSellerId(seller.id);
      const data = await fetchSellerDrops(seller.id);
      setDrops(data);
      setLoading(false);
    })();
  }, []);

  async function handleCancel(id: string) {
    setCancelling(id);
    await cancelDrop(id);
    setDrops((p) => p.map((d) => d.id === id ? { ...d, status: "cancelled" } : d));
    setCancelling(null);
    setConfirmCancel(null);
  }

  const active = drops.filter((d) => d.status === "active");
  const past   = drops.filter((d) => d.status !== "active");

  if (loading) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 size={24} className="animate-spin text-orange-400" />
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-gray-900">
            <Flame size={22} className="text-orange-500" /> Sludinājumu dēlis
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {active.length} aktīvi · {past.length} iepriekšējie
          </p>
        </div>
        <Link href="/dashboard/keriens/jauns"
          className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Jauns ķēriens
        </Link>
      </div>

      {drops.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-orange-200 bg-orange-50/30 p-16 text-center">
          <Flame size={40} className="mx-auto text-orange-300" />
          <p className="mt-3 font-semibold text-gray-900">Vēl nav neviena ķēriena</p>
          <p className="mt-1 text-sm text-gray-500">Izmet savu pirmo partiju — pircēji redzēs uzreiz</p>
          <Link href="/dashboard/keriens/jauns"
            className="btn-primary mt-5 inline-flex items-center gap-2">
            <Plus size={15} /> Izveidot pirmo
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {active.length > 0 && (
            <div>
              <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-400">Aktīvie</h2>
              <DropList drops={active} confirmCancel={confirmCancel}
                setConfirmCancel={setConfirmCancel} cancelling={cancelling}
                onCancel={handleCancel} />
            </div>
          )}
          {past.length > 0 && (
            <div>
              <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-400">Iepriekšējie</h2>
              <DropList drops={past} confirmCancel={confirmCancel}
                setConfirmCancel={setConfirmCancel} cancelling={cancelling}
                onCancel={handleCancel} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DropList({ drops, confirmCancel, setConfirmCancel, cancelling, onCancel }: {
  drops: HotDrop[];
  confirmCancel: string | null;
  setConfirmCancel: (id: string | null) => void;
  cancelling: string | null;
  onCancel: (id: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      <div className="divide-y divide-gray-50">
        {drops.map((drop) => {
          const st = STATUS_MAP[drop.status];
          const avail = availableQuantity(drop);
          const isActive = drop.status === "active";
          return (
            <div key={drop.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition">
              {/* Cover or placeholder */}
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-orange-100 to-amber-50">
                {drop.cover_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={drop.cover_image_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Package size={18} className="text-orange-300" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-semibold text-gray-900">{drop.title}</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
                  <span>€{(drop.price_cents / 100).toFixed(2)} / {drop.unit}</span>
                  <span>{avail} no {drop.total_quantity} pieejami</span>
                  {isActive && (
                    <span className="flex items-center gap-1 text-orange-600">
                      <Clock size={10} /> {formatExpiry(drop)}
                    </span>
                  )}
                </div>
              </div>

              <span className={cn("hidden sm:inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold", st.cls)}>
                {st.label}
              </span>

              <div className="flex items-center gap-1 shrink-0">
                <Link href={`/keriens/${drop.id}`} target="_blank"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
                  title="Skatīt publiski">
                  <Eye size={14} />
                </Link>
                {isActive && (
                  <>
                    <Link href={`/dashboard/keriens/${drop.id}/edit`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
                      title="Rediģēt">
                      <Flame size={14} />
                    </Link>
                    {confirmCancel === drop.id ? (
                      <div className="flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-2 py-1">
                        <span className="text-xs font-medium text-red-700 mr-1">Atcelt?</span>
                        <button onClick={() => onCancel(drop.id)} disabled={cancelling === drop.id}
                          className="flex h-6 w-6 items-center justify-center rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-40">
                          {cancelling === drop.id ? <Loader2 size={10} className="animate-spin" /> : <span className="text-xs font-bold">Jā</span>}
                        </button>
                        <button onClick={() => setConfirmCancel(null)}
                          className="flex h-6 w-6 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-200">
                          <X size={11} />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmCancel(drop.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition"
                        title="Atcelt drop">
                        <X size={14} />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
