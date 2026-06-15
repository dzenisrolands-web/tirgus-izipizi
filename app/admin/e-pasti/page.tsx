"use client";

import { useState, useEffect } from "react";
import {
  Mail, Eye, EyeOff, Send, Loader2, Save, Pencil, X,
  ShoppingBag, UserPlus, Bell, FileText, CheckCircle, RotateCcw,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type DbTemplate = {
  id: string;
  subject: string;
  body_html: string;
  variables: string[];
  updated_at: string;
};

const TEMPLATE_META: Record<string, { name: string; icon: React.ReactNode; when: string; to: string; color: string }> = {
  "order-buyer": {
    name: "Pasūtījuma apstiprinājums (pircējam)",
    icon: <ShoppingBag size={16} />,
    when: "Automātiski pēc apmaksas",
    to: "Pircēja e-pasts",
    color: "bg-green-50 border-green-200 text-green-800",
  },
  "order-seller": {
    name: "Jauns pasūtījums (pārdevējam)",
    icon: <Bell size={16} />,
    when: "Automātiski pēc apmaksas",
    to: "Pārdevēja sellers.email",
    color: "bg-blue-50 border-blue-200 text-blue-800",
  },
  "order-admin": {
    name: "Admin kopija",
    icon: <FileText size={16} />,
    when: "Automātiski pēc apmaksas",
    to: "tirgus@izipizi.lv",
    color: "bg-gray-50 border-gray-200 text-gray-700",
  },
  "order-processing": {
    name: "Ražotājs apstiprināja (pircējam)",
    icon: <ShoppingBag size={16} />,
    when: "Kad statuss mainās uz Apstrādē",
    to: "Pircēja e-pasts",
    color: "bg-blue-50 border-blue-200 text-blue-800",
  },
  "order-shipped": {
    name: "Pasūtījums gatavs saņemšanai (pircējam)",
    icon: <Bell size={16} />,
    when: "Kad statuss mainās uz Nosūtīts",
    to: "Pircēja e-pasts",
    color: "bg-green-50 border-green-200 text-green-800",
  },
  "order-delivered": {
    name: "Pasūtījums saņemts (pircējam)",
    icon: <CheckCircle size={16} />,
    when: "Kad statuss mainās uz Piegādāts",
    to: "Pircēja e-pasts",
    color: "bg-gray-50 border-gray-200 text-gray-700",
  },
  "seller-reminder": {
    name: "Atgādinājums pārdevējam",
    icon: <Mail size={16} />,
    when: "Manuāli no admin paneļa",
    to: "Pārdevēja auth e-pasts",
    color: "bg-amber-50 border-amber-200 text-amber-800",
  },
  invitation: {
    name: "Uzaicinājums pievienoties",
    icon: <UserPlus size={16} />,
    when: "Manuāli no admin paneļa",
    to: "Potenciālā ražotāja e-pasts",
    color: "bg-purple-50 border-purple-200 text-purple-800",
  },
};

export default function AdminEmailTemplatesPage() {
  const [templates, setTemplates] = useState<DbTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ id: string; ok: boolean; msg: string } | null>(null);
  const [openPreview, setOpenPreview] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [loadingPreview, setLoadingPreview] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; ok: boolean; msg: string } | null>(null);

  async function loadTemplates() {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/admin/email-templates", {
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
    });
    const data = await res.json();
    setTemplates(data.templates ?? []);
    setLoading(false);
  }

  useEffect(() => { loadTemplates(); }, []);

  function startEdit(t: DbTemplate) {
    setEditing(t.id);
    setEditSubject(t.subject);
    setEditBody(t.body_html);
  }

  function cancelEdit() { setEditing(null); }

  async function saveTemplate(id: string) {
    setSaving(true);
    setSaveMsg(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/admin/email-templates", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ id, subject: editSubject, body_html: editBody }),
      });
      const data = await res.json();
      if (data.ok) {
        setSaveMsg({ id, ok: true, msg: "Saglabāts!" });
        setEditing(null);
        await loadTemplates();
        setPreviews((p) => { const n = { ...p }; delete n[id]; return n; });
      } else {
        setSaveMsg({ id, ok: false, msg: data.error ?? "Kļūda" });
      }
    } catch {
      setSaveMsg({ id, ok: false, msg: "Tīkla kļūda" });
    }
    setSaving(false);
    setTimeout(() => setSaveMsg(null), 4000);
  }

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
      setTestResult({ id: templateId, ok: data.ok ?? false, msg: data.ok ? `Nosūtīts uz ${testEmail}` : (data.error ?? "Kļūda") });
    } catch {
      setTestResult({ id: templateId, ok: false, msg: "Tīkla kļūda" });
    }
    setSendingTest(null);
    setTimeout(() => setTestResult(null), 5000);
  }

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 size={24} className="animate-spin text-gray-400" /></div>;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">E-pasta šabloni</h1>
        <p className="mt-1 text-sm text-gray-500">
          Rediģē tekstu tiešsaistē — izmaiņas stājas spēkā uzreiz.
          Lieto <code className="rounded bg-gray-100 px-1 py-0.5 text-xs font-mono">{"{{mainīgais}}"}</code> dinamiskiem laukiem.
        </p>
      </div>

      <div className="mb-6 flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4">
        <Mail size={16} className="text-gray-400 shrink-0" />
        <input type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)}
          placeholder="Testa e-pasts nosūtīšanai..." className="flex-1 text-sm outline-none placeholder-gray-400" />
      </div>

      <div className="space-y-4">
        {templates.map((t) => {
          const meta = TEMPLATE_META[t.id];
          const isEditing = editing === t.id;
          const isPreview = openPreview === t.id;
          if (!meta) return null;

          return (
            <div key={t.id} className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
              <div className="flex items-start gap-4 p-5">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${meta.color}`}>{meta.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900">{meta.name}</p>
                  <p className="mt-0.5 text-xs text-gray-500">{meta.when} · {meta.to}</p>
                  <p className="mt-1 text-xs text-gray-400"><span className="font-semibold text-gray-500">Temats:</span> <span className="font-mono">{t.subject}</span></p>
                  <p className="mt-0.5 text-[10px] text-gray-300">Mainīgie: {t.variables.map(v => `{{${v}}}`).join(", ")} · Atjaunots: {new Date(t.updated_at).toLocaleDateString("lv-LV")}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {testEmail.includes("@") && (
                    <button onClick={() => sendTest(t.id)} disabled={sendingTest === t.id}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100 transition disabled:opacity-50">
                      {sendingTest === t.id ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />} Testu
                    </button>
                  )}
                  <button onClick={() => loadPreview(t.id)} disabled={loadingPreview === t.id}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200 transition">
                    {loadingPreview === t.id ? <Loader2 size={11} className="animate-spin" /> : isPreview ? <EyeOff size={11} /> : <Eye size={11} />}
                    {isPreview ? "Slēpt" : "Skats"}
                  </button>
                  <button onClick={() => isEditing ? cancelEdit() : startEdit(t)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${isEditing ? "bg-red-50 text-red-600 hover:bg-red-100" : "bg-amber-50 text-amber-700 hover:bg-amber-100"}`}>
                    {isEditing ? <X size={11} /> : <Pencil size={11} />} {isEditing ? "Atcelt" : "Rediģēt"}
                  </button>
                </div>
              </div>

              {(testResult?.id === t.id || saveMsg?.id === t.id) && (
                <div className={`px-5 py-2 text-xs ${(testResult?.id === t.id ? testResult.ok : saveMsg!.ok) ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>
                  {(testResult?.id === t.id ? (testResult.ok ? "✓ " : "✗ ") + testResult.msg : (saveMsg!.ok ? "✓ " : "✗ ") + saveMsg!.msg)}
                </div>
              )}

              {isEditing && (
                <div className="border-t border-gray-100 bg-amber-50/30 p-5 space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Temats</label>
                    <input value={editSubject} onChange={(e) => setEditSubject(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-brand-300 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Ķermenis (HTML)</label>
                    <textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={16}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-mono leading-relaxed focus:ring-2 focus:ring-brand-300 outline-none resize-y" />
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => saveTemplate(t.id)} disabled={saving}
                      className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700 transition disabled:opacity-50">
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Saglabāt
                    </button>
                    <button onClick={cancelEdit} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Atcelt</button>
                  </div>
                </div>
              )}

              {isPreview && previews[t.id] && (
                <div className="border-t border-gray-100 bg-gray-50 p-4">
                  <iframe srcDoc={previews[t.id]} title={meta.name}
                    className="w-full rounded-xl border border-gray-200 bg-white"
                    style={{ height: t.id === "invitation" ? 900 : 600 }} sandbox="allow-same-origin" />
                </div>
              )}
            </div>
          );
        })}

        {templates.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center">
            <p className="text-sm text-gray-500">Nav šablonu datubāzē. Palaid migrāciju <code className="font-mono">0024_email_templates.sql</code></p>
          </div>
        )}
      </div>

      <div className="mt-8 rounded-xl border border-gray-100 bg-gray-50 p-5 text-xs text-gray-500 space-y-1">
        <p className="font-semibold text-gray-700">Kā tas strādā</p>
        <p>• Šabloni glabājas datubāzē — izmaiņas stājas spēkā uzreiz, bez deploja.</p>
        <p>• Ja šablons nav atrasts DB, sistēma lieto iebūvēto versiju kā fallback.</p>
        <p>• Mainīgie (<code className="font-mono">{"{{buyerName}}"}</code> u.c.) tiek aizstāti nosūtīšanas brīdī.</p>
      </div>
    </div>
  );
}
