"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Suspense } from "react";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    async function handle() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/login"); return; }

      const next = searchParams.get("next");
      if (next) { router.replace(next); return; }

      const { data: profile } = await supabase
        .from("profiles").select("role").eq("id", session.user.id).single();
      const role = profile?.role ?? "buyer";
      if (role === "super_admin") router.replace("/admin");
      else if (role === "seller") router.replace("/dashboard");
      else router.replace("/");
    }
    handle();
  }, []);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 size={24} className="animate-spin text-gray-400" />
    </div>
  );
}

export default function AuthCallbackPage() {
  return <Suspense><CallbackHandler /></Suspense>;
}
