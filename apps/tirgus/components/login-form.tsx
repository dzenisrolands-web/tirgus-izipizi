"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabase";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForgot, setShowForgot] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const [forgotSent, setForgotSent] = useState(false);

  async function handleGoogle() {
    setGoogleLoading(true);
    const callbackUrl = next
      ? `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`
      : `${location.origin}/auth/callback`;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl },
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (next) { router.push(next); router.refresh(); return; }
      // Always land on homepage after login — admin is via direct URL only
      router.push("/");
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Invalid login credentials")) setError("Nepareizs e-pasts vai parole");
      else if (msg.includes("Email not confirmed")) setError("E-pasts nav apstiprināts — pārbaudi savas iesūtni");
      else setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!email) { setForgotError("Ievadi e-pastu"); return; }
    setForgotError("");
    setForgotLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${location.origin}/auth/callback`,
      });
      if (error) throw error;
      setForgotSent(true);
    } catch (err: unknown) {
      setForgotError(err instanceof Error ? err.message : "Kļūda");
    } finally {
      setForgotLoading(false);
    }
  }

  if (showForgot) {
    if (forgotSent) {
      return (
        <div className="mt-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-2xl">
            ✉️
          </div>
          <h2 className="mt-4 text-lg font-extrabold text-gray-900">Pārbaudi e-pastu!</h2>
          <p className="mt-2 text-sm text-gray-500">
            Ja <strong>{email}</strong> ir reģistrēts, nosūtījām tām paroles atjaunošanas saiti.
          </p>
          <button
            type="button"
            onClick={() => { setShowForgot(false); setForgotSent(false); }}
            className="mt-5 font-medium text-brand-600 hover:underline text-sm"
          >
            Atpakaļ uz pieslēgšanos
          </button>
        </div>
      );
    }
    return (
      <div className="mt-6">
        <h2 className="text-lg font-extrabold text-gray-900">Aizmirsi paroli?</h2>
        <p className="mt-1 text-sm text-gray-500">
          Ievadi savu e-pastu — nosūtīsim saiti paroles atjaunošanai.
        </p>
        <form onSubmit={handleForgotPassword} className="mt-4 space-y-3">
          {forgotError && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{forgotError}</div>}
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="input w-full" placeholder="E-pasts" required autoFocus />
          <button type="submit" disabled={forgotLoading} className="btn-primary w-full py-2.5 flex items-center justify-center gap-2">
            {forgotLoading && <Loader2 size={16} className="animate-spin" />}
            Sūtīt atjaunošanas saiti
          </button>
        </form>
        <button
          type="button"
          onClick={() => { setShowForgot(false); setForgotError(""); }}
          className="mt-4 block w-full text-center text-sm font-medium text-gray-500 hover:text-gray-700"
        >
          Atpakaļ uz pieslēgšanos
        </button>
      </div>
    );
  }

  return (
    <>
        {/* Google */}
        <button onClick={handleGoogle} disabled={googleLoading}
          className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl border border-gray-300 bg-white py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition disabled:opacity-50">
          {googleLoading
            ? <Loader2 size={18} className="animate-spin" />
            : <svg viewBox="0 0 24 24" className="h-5 w-5"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          }
          Turpināt ar Google
        </button>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-xs text-gray-400">vai</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="input w-full" placeholder="E-pasts" required />
          <div className="relative">
            <input type={showPass ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
              className="input w-full pr-10" placeholder="Parole" required />
            <button type="button" onClick={() => setShowPass(!showPass)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => { setShowForgot(true); setForgotError(""); }}
              className="text-xs font-medium text-gray-500 hover:text-brand-600"
            >
              Aizmirsi paroli?
            </button>
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 flex items-center justify-center gap-2">
            {loading && <Loader2 size={16} className="animate-spin" />}
            Pieslēgties
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-gray-500">
          Nav konta?{" "}
          <Link href="/register" className="font-medium text-brand-600 hover:underline">Reģistrēties</Link>
        </p>
    </>
  );
}
