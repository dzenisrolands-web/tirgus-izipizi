"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Flame, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { DropForm } from "@/components/keriens/DropForm";

const MAX_ACTIVE_DROPS = 4;

export default function JaunsDropsPage() {
  const router = useRouter();
  const [sellerId, setSellerId] = useState("");
  const [userId, setUserId] = useState("");
  const [sellerName, setSellerName] = useState("");
  const [activeCount, setActiveCount] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }

      const { data: seller } = await supabase
        .from("sellers").select("id, status, name").eq("user_id", user.id).single();
      if (!seller || seller.status !== "approved") {
        router.replace("/dashboard");
        return;
      }

      const { count } = await supabase
        .from("hot_drops")
        .select("id", { count: "exact", head: true })
        .eq("seller_id", seller.id)
        .eq("status", "active");

      setUserId(user.id);
      setSellerId(seller.id);
      setSellerName(seller.name ?? "");
      setActiveCount(count ?? 0);
      setReady(true);
    })();
  }, [router]);

  if (!ready) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 size={24} className="animate-spin text-orange-400" />
    </div>
  );

  if (activeCount >= MAX_ACTIVE_DROPS) {
    return (
      <div className="mx-auto max-w-lg px-6 py-20 text-center">
        <div className="flex justify-center mb-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-100">
            <AlertTriangle size={28} className="text-orange-500" />
          </div>
        </div>
        <h1 className="text-xl font-extrabold text-gray-900">Limits sasniegts</h1>
        <p className="mt-2 text-sm text-gray-500">
          Tev jau ir <strong>{activeCount}</strong> aktīvi ķērieni.
          Maksimums ir <strong>{MAX_ACTIVE_DROPS}</strong>. Pagaidi, kamēr kāds beidzas vai
          izdzēs esošo, lai pievienotu jaunu.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/dashboard/keriens"
            className="inline-flex items-center gap-2 rounded-xl bg-[#192635] px-5 py-2.5 text-sm font-bold text-white hover:opacity-90 transition">
            <Flame size={14} /> Mani ķērieni
          </Link>
        </div>
      </div>
    );
  }

  return (
    <DropForm
      sellerId={sellerId}
      userId={userId}
      sellerName={sellerName}
      activeCount={activeCount}
      maxDrops={MAX_ACTIVE_DROPS}
    />
  );
}
