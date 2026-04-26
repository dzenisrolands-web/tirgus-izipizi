"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { fetchDropById } from "@/lib/hot-drops/queries";
import { DropForm } from "@/components/hot-drops/DropForm";
import type { HotDrop } from "@/lib/hot-drops/types";

export default function EditDropPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [drop, setDrop] = useState<HotDrop | null>(null);
  const [sellerId, setSellerId] = useState("");
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }
      const { data: seller } = await supabase
        .from("sellers").select("id").eq("user_id", user.id).single();
      if (!seller) { router.replace("/dashboard"); return; }

      const data = await fetchDropById(id);
      if (!data || data.user_id !== user.id || data.status !== "active") {
        router.replace("/dashboard/karstie-piradzini");
        return;
      }
      setUserId(user.id);
      setSellerId(seller.id);
      setDrop(data);
      setLoading(false);
    })();
  }, [id, router]);

  if (loading) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 size={24} className="animate-spin text-orange-400" />
    </div>
  );

  if (!drop) return null;

  return <DropForm sellerId={sellerId} userId={userId} initial={drop} />;
}
