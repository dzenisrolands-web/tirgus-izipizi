"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Suspense } from "react";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function handle() {
      try {
        const type = searchParams.get("type");
        const tokenHash = searchParams.get("token_hash");

        // Password recovery
        if (type === "recovery" && tokenHash) {
          const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
          if (error) throw error;
          router.replace("/update-password");
          return;
        }

        // Magic link / email invite
        if ((type === "magiclink" || type === "invite") && tokenHash) {
          const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as "magiclink" | "invite" });
          if (error) throw error;
        }

        // OAuth PKCE — exchange code for session
        let user = null;
        const code = searchParams.get("code");
        if (code) {
          const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
          // Use user directly from the exchange response — avoids getUser() race condition
          user = exchangeData.session?.user ?? null;
        }

        // For non-PKCE flows (magic link, invite) — get user from storage
        if (!user) {
          const { data, error: userError } = await supabase.auth.getUser();
          if (userError) throw new Error(`Session error: ${userError.message}`);
          user = data.user;
        }

        if (!user) throw new Error("Nav sesijas. Lūdzu mēģini vēlreiz.");

        // Ensure profile exists with correct role.
        // If no profile yet, create one (buyer by default, seller if ?role=seller).
        // NEVER downgrade an existing role.
        const requestedRole = searchParams.get("role");
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        let effectiveRole = existingProfile?.role;
        if (!effectiveRole) {
          const newRole = requestedRole === "seller" ? "seller" : "buyer";
          // Grant 1 free delivery credit to new buyers
          await supabase
            .from("profiles")
            .upsert({
              id: user.id,
              role: newRole,
              ...(newRole === "buyer" ? { free_delivery_credits: 1 } : {}),
            }, { onConflict: "id" });
          effectiveRole = newRole;
        }

        // Redirect — admin is via direct URL only, never auto-redirect
        const next = searchParams.get("next");
        if (next) { router.replace(next); return; }
        router.replace("/");

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[auth/callback] error:", msg);
        setErrorMsg(msg);
      }
    }
    handle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (errorMsg) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-sm text-red-600 max-w-sm">
          Pieslēgšanās kļūda: {errorMsg}
        </p>
        <a href="/login" className="text-sm font-semibold text-brand-600 underline">
          Atpakaļ uz pieslēgšanos
        </a>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 size={24} className="animate-spin text-gray-400" />
    </div>
  );
}

export default function AuthCallbackPage() {
  return <Suspense><CallbackHandler /></Suspense>;
}
