"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Eye, EyeOff, CheckCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";

function UpdatePasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Wait for Supabase to process the recovery token from the URL hash
    supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    // Also check if session already exists (user arrived via recovery link)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { setError("Parolei jābūt vismaz 8 rakstzīmes"); return; }
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setDone(true);
    setTimeout(() => router.replace("/login"), 2000);
  }

  if (done) return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4">
      <div className="max-w-sm text-center">
        <CheckCircle size={40} className="mx-auto text-green-500" />
        <h1 className="mt-4 text-xl font-extrabold text-gray-900">Parole atjaunināta!</h1>
        <p className="mt-2 text-sm text-gray-500">Novirza uz pieslēgšanos...</p>
      </div>
    </div>
  );

  if (!ready) return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center">
      <Loader2 size={24} className="animate-spin text-gray-400" />
    </div>
  );

  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-2xl font-extrabold text-gray-900">Jauna parole</h1>
        <p className="mt-1 text-center text-sm text-gray-500">Ievadi savu jauno paroli</p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          <div className="relative">
            <input
              type={showPass ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input w-full pr-10"
              placeholder="Jaunā parole (min. 8 rakstzīmes)"
              required
            />
            <button type="button" onClick={() => setShowPass(!showPass)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <button type="submit" disabled={loading}
            className="btn-primary w-full py-2.5 flex items-center justify-center gap-2">
            {loading && <Loader2 size={16} className="animate-spin" />}
            Saglabāt paroli
          </button>
        </form>
      </div>
    </div>
  );
}

export default function UpdatePasswordPage() {
  return <Suspense><UpdatePasswordForm /></Suspense>;
}
