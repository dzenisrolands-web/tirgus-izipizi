"use client";

import { useState } from "react";
import { Mail, Eye, EyeOff, Send, Loader2, CheckCircle, ShoppingBag, UserPlus, Bell, FileText } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Template = {
  id: string;
  name: string;
  icon: React.ReactNode;
  when: string;
  to: string;
  subject: string;
  color: string;
};

const TEMPLATES: Template[] = [
  {
    id: "order-buyer",
    name: "Pasūtījuma apstiprinājums (pircējam)",
    icon: <ShoppingBag size={16} />,
    when: "Automātiski pēc veiksmīgas apmaksas",
    to: "Pircēja e-pasts",
    subject: "Pasūtījums TRG-2026XXXX-XXXX apmaksāts — tirgus.izipizi.lv",
    color: "bg-green-50 border-green-200 text-green-800",
  },
  {
    id: "order-seller",
    name: "Jauns pasūtījums (pārdevējam)",
    icon: <Bell size={16} />,
    when: "Automātiski pēc veiksmīgas apmaksas",
    to: "Pārdevēja sellers.email",
    subject: "Jauns pasūtījums TRG-2026XXXX-XXXX — tirgus.izipizi.lv",
    color: "bg-blue-50 border-blue-200 text-blue-800",
  },
  {
    id: "order-admin",
    name: "Admin kopija",
    icon: <FileText size={16} />,
    when: "Automātiski pēc veiksmīgas apmaksas",
    to: "tirgus@izipizi.lv",
    subject: "[Admin] Jauns pasūtījums TRG-2026XXXX · 25.50€",
    color: "bg-gray-50 border-gray-200 text-gray-700",
  },
  {
    id: "seller-reminder",
    name: "Atgādinājums pārdevējam",
    icon: <Mail size={16} />,
    when: "Manuāli no admin paneļa (\"Sūtīt atgādinājumu\")",
    to: "Pārdevēja auth konta e-pasts",
    subject: "Aizpildi trūkstošo informāciju — tirgus.izipizi.lv",
    color: "bg-amber-50 border-amber-200 text-amber-800",
  },
  {
    id: "invitation",
    name: "Uzaicinājums pievienoties",
    icon: <UserPlus size={16} />,
    when: "Manuāli no admin paneļa (\"Sūtīt uzaicinājumu\")",
    to: "Jebkurš potenciālā ražotāja e-pasts",
    subject: "Uzaicinājums pievienoties tirgus.izipizi.lv",
    color: "bg-purple-50 border-purple-200 text-purple-800",
  },
];

export default function AdminEmailTemplatesPage() {
  const [openPreview, setOpenPreview] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [loadingPreview, setLoadingPreview] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; ok: boolean; msg: string } | null>(null);

  async function loadPreview(templateId: string) {
    if (previews[templateId]) {
      setOpenPreview(openPreview === templateId ? null : templateId);
      return;
    }
    setLoadingPreview(templateId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/admin/email-preview?template=${templateId}`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      const data = await res.json();
      if (data.html) {
        setPreviews((p) => ({ ...p, [templateId]: data.html }));
        setOpenPreview(templateId);
      }
    } catch {}
    setLoadingPreview(null);
  }

  async function sendTest(templateId: string) {
    if (!testEmail.trim()) return;
    setSendingTest(templateId);
    setTestResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/admin/email-preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ template: templateId, to: testEmail.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        setTestResult({ id: templateId, ok: true, msg: `Nosūtīts uz ${testEmail}` });
      } else {
        setTestResult({ id: templateId, ok: false, msg: data.error ?? "Kļūda" });
      }
    } catch {
      setTestResult({ id: templateId, ok: false, msg: "Tīkla kļūda" });
    }
    setSendingTest(null);
    setTimeout(() => setTestResult(null), 5000);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">E-pasta šabloni</h1>
        <p className="mt-1 text-sm text-gray-500">
          Visi e-pasti, kas tiek sūtīti no platformas. Priekšskatījums ar piemēra datiem.
        </p>
      </div>

      {/* Test email input */}
      <div className="mb-6 flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4">
        <Mail size={16} className="text-gray-400 shrink-0" />
        <input
          type="email"
          value={testEmail}
          onChange={(e) => setTestEmail(e.target.value)}
          placeholder="Testa e-pasts nosūtīšanai..."
          className="flex-1 text-sm outline-none placeholder-gray-400"
        />
        <p className="text-xs text-gray-400 shrink-0">Ievadi, lai sūtītu testa vēstuli</p>
      </div>

      <div className="space-y-4">
        {TEMPLATES.map((t) => {
          const isOpen = openPreview === t.id;
          return (
            <div key={t.id} className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
              {/* Header */}
              <div className="flex items-start gap-4 p-5">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${t.color}`}>
                  {t.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900">{t.name}</p>
                  <p className="mt-0.5 text-xs text-gray-500">{t.when}</p>
                  <div className="mt-2 space-y-1">
                    <p className="text-xs text-gray-400">
                      <span className="font-semibold text-gray-500">Kam:</span> {t.to}
                    </p>
                    <p className="text-xs text-gray-400">
                      <span className="font-semibold text-gray-500">Temats:</span>{" "}
                      <span className="font-mono">{t.subject}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {testEmail.includes("@") && (
                    <button
                      onClick={() => sendTest(t.id)}
                      disabled={sendingTest === t.id}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100 transition disabled:opacity-50"
                    >
                      {sendingTest === t.id ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                      Sūtīt testu
                    </button>
                  )}
                  <button
                    onClick={() => loadPreview(t.id)}
                    disabled={loadingPreview === t.id}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200 transition"
                  >
                    {loadingPreview === t.id ? (
                      <Loader2 size={11} className="animate-spin" />
                    ) : isOpen ? (
                      <EyeOff size={11} />
                    ) : (
                      <Eye size={11} />
                    )}
                    {isOpen ? "Slēpt" : "Priekšskatījums"}
                  </button>
                </div>
              </div>

              {/* Test result */}
              {testResult && testResult.id === t.id && (
                <div className={`px-5 py-2 text-xs ${testResult.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>
                  {testResult.ok ? "✓ " : "✗ "}{testResult.msg}
                </div>
              )}

              {/* Preview iframe */}
              {isOpen && previews[t.id] && (
                <div className="border-t border-gray-100 bg-gray-50 p-4">
                  <iframe
                    srcDoc={previews[t.id]}
                    title={t.name}
                    className="w-full rounded-xl border border-gray-200 bg-white"
                    style={{ height: t.id === "invitation" ? 900 : 600 }}
                    sandbox="allow-same-origin"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-8 rounded-xl border border-gray-100 bg-gray-50 p-5 text-xs text-gray-500 space-y-1">
        <p className="font-semibold text-gray-700">Piezīmes</p>
        <p>• Šabloni atrodas failā <span className="font-mono">lib/email.ts</span> — lai mainītu tekstu vai dizainu, rediģē šo failu.</p>
        <p>• Uzaicinājuma šablons ir atsevišķs pilns HTML — atšķirībā no pārējiem, kas lieto kopīgo <span className="font-mono">brandedEmailLayout()</span>.</p>
        <p>• E-pasti tiek sūtīti caur <strong>Resend</strong> API. Sūtītāja adrese: <span className="font-mono">EMAIL_FROM</span> env mainīgais.</p>
      </div>
    </div>
  );
}
