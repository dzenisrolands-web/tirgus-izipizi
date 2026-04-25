"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { ProductForm } from "@/components/product-form";

export default function JaunsProduktisPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const { data: seller } = await supabase
        .from("sellers").select("status").eq("user_id", user.id).single();
      if (!seller || seller.status !== "approved") {
        router.replace("/dashboard");
      } else {
        setReady(true);
      }
    });
  }, [router]);

  if (!ready) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 size={24} className="animate-spin text-gray-400" />
    </div>
  );

  return <ProductForm />;
}
