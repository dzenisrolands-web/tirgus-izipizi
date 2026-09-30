"use client";

import { useState, useEffect } from "react";
import { MessageSquarePlus, X, Send, CheckCircle, Loader2 } from "lucide-react";

type Phase = "closed" | "open" | "sending" | "done" | "error";

export function FeedbackWidget() {
  const [phase, setPhase] = useState<Phase>("closed");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [pageUrl, setPageUrl] = useState("");

  // Capture current URL client-side
  useEffect(() => {
    setPageUrl(window.location.href);
  }, [phase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setPhase("sending");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim(), email: email.trim() || null, page_url: pageUrl }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setPhase("done");
      setMessage("");
      setEmail("");
      // Auto-close after 3s
      setTimeout(() => setPhase("closed"), 3000);
    } catch {
      setPhase("error");
    }
  }

  return (
    <>
      {/* Floating trigger button — sits above mobile bottom nav */}
      {phase === "closed" && (
        <button
          onClick={() => setPhase("open")}
          className="fixed bottom-20 right-4 z-50 flex items-center gap-2 rounded-full bg-[#192635] px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:scale-[1.03] hover:shadow-xl md:bottom-16"
        >
          <MessageSquarePlus size={18} />
          Pamanīji kļūdu?
        </button>
      )}

      {/* Feedback panel */}
      {phase !== "closed" && (
        <div className="fixed bottom-20 right-4 z-50 w-[320px] max-w-[calc(100vw-2rem)] rounded-2xl border border-gray-200 bg-white shadow-2xl md:bottom-16">
          {/* Header */}
          <div className="flex items-center justify-between rounded-t-2xl bg-[#192635] px-4 py-3">
            <div className="flex items-center gap-2">
              <MessageSquarePlus size={16} className="text-[#53F3A4]" />
              <p className="text-sm font-semibold text-white">Pamanīji kļūdu?</p>
            </div>
            <button
              onClick={() => { setPhase("closed"); setMessage(""); setEmail(""); }}
              className="text-gray-400 hover:text-white transition"
            >
              <X size={16} />
            </button>
          </div>

          {phase === "done" ? (
            <div className="flex flex-col items-center gap-2 px-5 py-8 text-center">
              <CheckCircle size={32} className="text-green-500" />
              <p className="font-semibold text-gray-900">Paldies!</p>
              <p className="text-sm text-gray-500">Mēs to izlabōsim pēc iespējas ātrāk.</p>
            </div>
          ) : phase === "error" ? (
            <div className="flex flex-col items-center gap-3 px-5 py-8 text-center">
              <p className="text-2xl">⚠️</p>
              <p className="font-semibold text-gray-900">Neizdevās nosūtīt</p>
              <p className="text-sm text-gray-500">Lūdzu sazinieties tieši: birojs@izipizi.lv</p>
              <button
                onClick={() => setPhase("open")}
                className="mt-1 text-xs text-brand-600 hover:underline">
                Mēģināt vēlreiz
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Apraksti kļūdu *
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  className="mt-1 input w-full resize-none text-sm"
                  placeholder="Piem.: Nevar pievienot grozam. Lapa rāda kļūdu pēc..."
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  E-pasts (neobligāti)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 input w-full text-sm"
                  placeholder="tavs@epasts.lv"
                />
              </div>
              <p className="text-[10px] text-gray-400 truncate">
                Lapa: {pageUrl.replace(/^https?:\/\/[^/]+/, "") || "/"}
              </p>
              <button
                type="submit"
                disabled={phase === "sending" || !message.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#192635] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#243647] disabled:opacity-50"
              >
                {phase === "sending"
                  ? <><Loader2 size={14} className="animate-spin" /> Sūta...</>
                  : <><Send size={14} /> Nosūtīt</>}
              </button>
            </form>
          )}
        </div>
      )}
    </>
  );
}
