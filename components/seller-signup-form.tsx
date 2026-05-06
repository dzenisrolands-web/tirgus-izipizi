"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Store, ArrowLeft, Truck, Percent, Shield } from "lucide-react";
import { supabase } from "@/lib/supabase";

export function SellerSignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleGoogle() {
    setGoogleLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/auth/callback?role=seller&next=/dashboard/onboarding`,
      },
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Parolei jābūt vismaz 8 rakstzīmes");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { role: "seller" },
          emailRedirectTo: `${location.origin}/auth/callback?role=seller&next=/dashboard/onboarding`,
        },
      });
      if (error) throw error;
      setDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Kļūda");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-[#192635] px-4">
        <div className="max-w-sm rounded-3xl bg-white p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-3xl">
            ✉️
          </div>
          <h1 className="mt-5 text-2xl font-extrabold text-gray-900">Pārbaudi e-pastu!</h1>
          <p className="mt-3 text-sm text-gray-500">
            Nosūtījām apstiprinājuma saiti uz <strong>{email}</strong>.<br />
            Pēc apstiprināšanas tiks izveidots tavs ražotāja profils.
          </p>
          <Link href="/login" className="btn-primary mt-6 inline-block">
            Pieslēgties
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#192635]">
      <div className="mx-auto max-w-md px-4 py-10 sm:py-14">
        <Link
          href="/register"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white"
        >
          <ArrowLeft size={14} /> Atpakaļ uz izvēli
        </Link>

        <div className="rounded-3xl bg-white p-7 shadow-2xl">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#192635] text-brand-400">
            <Store size={22} />
          </div>
          <h1 className="mt-4 text-2xl font-extrabold text-gray-900">Pieteikties kā ražotājs</h1>
          <p className="mt-2 text-sm text-gray-500">
            Sāc pārdot savus produktus caur izipizi pakomātu tīklu visā Latvijā.
          </p>

          {/* Google */}
          <button
            onClick={handleGoogle}
            disabled={googleLoading}
            className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl border border-gray-300 bg-white py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
          >
            {googleLoading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <svg viewBox="0 0 24 24" className="h-5 w-5">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            Turpināt ar Google
          </button>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs text-gray-400">vai e-pasts</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {error && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            )}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input w-full"
              placeholder="E-pasts"
              required
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input w-full"
              placeholder="Parole (min. 8 rakstzīmes)"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex w-full items-center justify-center gap-2 py-2.5"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              Pieteikties
            </button>
          </form>

          <p className="mt-3 text-center text-xs text-gray-400">
            Pēc apstiprinājuma — saimniecības info un nodošanas vieta.
          </p>

          <p className="mt-5 text-center text-sm text-gray-500">
            Jau ir konts?{" "}
            <Link href="/login" className="font-medium text-brand-600 hover:underline">
              Pieslēgties
            </Link>
          </p>
        </div>

        {/* Trust signals */}
        <div className="mt-6 grid gap-2.5">
          <div className="flex items-start gap-3 rounded-xl bg-white/5 px-4 py-3 backdrop-blur">
            <Percent size={16} className="mt-0.5 shrink-0 text-brand-400" />
            <div>
              <p className="text-sm font-semibold text-white">Komisija tikai no pārdošanas</p>
              <p className="text-xs text-gray-400">Bez abonēšanas. Maksā tikai tad, kad pārdod.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl bg-white/5 px-4 py-3 backdrop-blur">
            <Truck size={16} className="mt-0.5 shrink-0 text-brand-400" />
            <div>
              <p className="text-sm font-semibold text-white">3 piegādes veidi</p>
              <p className="text-xs text-gray-400">Pakomāts 24/7, kurjers vai ekspres piegāde.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl bg-white/5 px-4 py-3 backdrop-blur">
            <Shield size={16} className="mt-0.5 shrink-0 text-brand-400" />
            <div>
              <p className="text-sm font-semibold text-white">Droši maksājumi</p>
              <p className="text-xs text-gray-400">Paysera maksājumu sistēma — droša un uzticama.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
