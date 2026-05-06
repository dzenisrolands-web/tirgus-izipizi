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
      const type = searchParams.get("type");
      const tokenHash = searchParams.get("token_hash");

      // Password recovery flow
      if (type === "recovery" && tokenHash) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
        if (!error) { router.replace("/update-password"); return; }
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/login"); return; }

      // Role from signup URL (?role=buyer|seller) wins on first login —
      // sets the canonical role for users who came in via Google OAuth
      // and have no profile row yet.
      const requestedRole = searchParams.get("role");
      const { data: existingProfile } = await supabase
        .from("profiles").select("role").eq("id", session.user.id).single();

      let effectiveRole = existingProfile?.role;
      if (!effectiveRole) {
        const newRole = requestedRole === "seller" ? "seller" : "buyer";
        await supabase.from("profiles").upsert({ id: session.user.id, role: newRole });
        effectiveRole = newRole;
      }

      const next = searchParams.get("next");
      if (next) { router.replace(next); return; }

      if (effectiveRole === "super_admin") router.replace("/admin");
      else if (effectiveRole === "seller") router.replace("/dashboard");
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
