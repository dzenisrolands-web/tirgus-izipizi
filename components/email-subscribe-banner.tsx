"use client";

import { useState, useEffect } from "react";
import { Mail, Check, X } from "lucide-react";

const DISMISS_KEY = "email_subscribe_dismissed_v1";
const SUBSCRIBED_KEY = "email_subscribed_v1";

/**
 * Floating email subscribe banner.
 * Shows at the bottom of the page. Dismissible + remembers subscription.
 */
export function EmailSubscribeBanner() {
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(DISMISS_KEY);
      const subscribed = localStorage.getItem(SUBSCRIBED_KEY);
      if (!dismissed && !subscribed) {
        // Show after 5 seconds
        const timer = setTimeout(() => setVisible(true), 5000);
        return () => clearTimeout(timer);
      }
    } catch {}
  }, []);

  function dismiss() {
    setVisible(false);
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch {}
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), source: "banner" }),
      });
      const data = await res.json();
      if (data.ok) {
        setStatus("done");
        try { localStorage.setItem(SUBSCRIBED_KEY, "1"); } catch {}
        setTimeout(() => setVisible(false), 3000);
      } else {
        setStatus("error");
        setErrorMsg(data.error ?? "Kļūda");
      }
    } catch {
      setStatus("error");
      setErrorMsg("Tīkla kļūda");
    }
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-40 mx-auto max-w-lg md:bottom-6">
      <div className="relative rounded-2xl border border-brand-200 bg-white p-5 shadow-xl">
        {/* Close button */}
        <button
          onClick={dismiss}
          className="absolute right-3 top-3 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        >
          <X size={14} />
        </button>

        {status === "done" ? (
          <div className="flex items-center gap-3 text-green-700">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
              <Check size={18} />
            </div>
            <div>
              <p className="font-bold">Paldies! Esi pierakstīts.</p>
              <p className="text-xs text-green-600">Drīz saņemsi jaunumus no tirgus.izipizi.lv</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{ background: "linear-gradient(135deg, #53F3A4, #AD47FF)" }}>
                <Mail size={18} className="text-[#192635]" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Saņem jaunumus e-pastā</p>
                <p className="text-xs text-gray-500">
                  Jauni ražotāji, produkti, akcijas — tieši tavā inboksā.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tavs@epasts.lv"
                className="input flex-1 text-sm"
                required
              />
              <button
                type="submit"
                disabled={status === "loading"}
                className="shrink-0 rounded-xl px-4 py-2 text-xs font-bold text-[#192635] transition hover:opacity-80 disabled:opacity-50"
                style={{ background: "linear-gradient(90deg, #53F3A4, #AD47FF)" }}
              >
                {status === "loading" ? "..." : "Pierakstīties"}
              </button>
            </form>

            {errorMsg && (
              <p className="mt-2 text-xs text-red-600">{errorMsg}</p>
            )}

            <p className="mt-2 text-[10px] text-gray-400">
              Pierakstoties, tu piekrīti saņemt e-pasta jaunumus. Vari atrakstīties jebkurā brīdī.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
