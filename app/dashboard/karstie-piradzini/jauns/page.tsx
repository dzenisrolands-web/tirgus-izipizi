"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { DropForm } from "@/components/hot-drops/DropForm";

export default function JaunsDropsPage() {
  const router = useRouter();
  const [sellerId, setSellerId] = useState("");
  const [userId, setUserId] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }
      const { data: seller } = await supabase
        .from("sellers").select("id, status").eq("user_id", user.id).single();
      if (!seller || seller.status !== "approved") {
        router.replace("/dashboard");
        return;
      }
      setUserId(user.id);
      setSellerId(seller.id);
      setReady(true);
    })();
  }, [router]);

  if (!ready) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 size={24} className="animate-spin text-orange-400" />
    </div>
  );

  return <DropForm sellerId={sellerId} userId={userId} />;
}
