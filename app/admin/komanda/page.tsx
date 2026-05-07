"use client";

import { useEffect, useState } from "react";
import {
  ShieldCheck, UserPlus, Mail, Loader2, Trash2,
  CheckCircle, XCircle, AlertCircle, User,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type TeamMember = {
  id: string;
  email: string;
  created_at: string;
  is_self: boolean;
};

export default function AdminTeamPage() {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setMsg({ tone: "err", text: "Nav sesijas — pārlogojies." });
        return;
      }
      const res = await fetch("/api/admin/team", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json() as { ok?: boolean; team?: TeamMember[]; error?: string };
      if (!res.ok || !json.ok) {
        setMsg({ tone: "err", text: json.error ?? "Neizdevās ielādēt komandu" });
        return;
      }
      setTeam(json.team ?? []);
    } catch (err) {
      setMsg({ tone: "err", text: err instanceof Error ? err.message : "Tīkla kļūda" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviting(true);
    setMsg(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { setMsg({ tone: "err", text: "Nav sesijas" }); return; }
      const res = await fetch("/api/admin/team", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: inviteEmail }),
      });
      const json = await res.json() as { ok?: boolean; mode?: string; email?: string; error?: string };
      if (!res.ok || !json.ok) {
        setMsg({ tone: "err", text: json.error ?? "Neizdevās uzaicināt" });
        return;
      }
      setMsg({
        tone: "ok",
        text: json.mode === "invited"
          ? `Uzaicinājums nosūtīts uz ${json.email} — pēc apstiprināšanas tas saņems super-admin piekļuvi`
          : `${json.email} jau bija konts — paaugstināts par super-admin`,
      });
      setInviteEmail("");
      await load();
    } catch (err) {
      setMsg({ tone: "err", text: err instanceof Error ? err.message : "Tīkla kļūda" });
    } finally {
      setInviting(false);
    }
  }

  async function remove(userId: string, email: string) {
    if (!confirm(`Tiešām noņemt super-admin piekļuvi lietotājam ${email}?\n\nViņa konts paliek, bet zaudē /admin piekļuvi.`)) return;
    setRemovingId(userId);
    setMsg(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { setMsg({ tone: "err", text: "Nav sesijas" }); return; }
      const res = await fetch("/api/admin/team", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId }),
      });
      const json = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setMsg({ tone: "err", text: json.error ?? "Neizdevās noņemt" });
        return;
      }
      setMsg({ tone: "ok", text: `Super-admin piekļuve noņemta lietotājam ${email}` });
      await load();
    } catch (err) {
      setMsg({ tone: "err", text: err instanceof Error ? err.message : "Tīkla kļūda" });
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">Komanda</h1>
            <p className="mt-0.5 text-sm text-gray-500">Pārvaldi super-admin piekļuvi kolēģiem</p>
          </div>
        </div>
      </div>

      {/* Invite form */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900">
          <UserPlus size={16} className="text-brand-600" />
          Pievienot kolēģi
        </h2>
        <p className="mt-1 text-xs text-gray-500">
          Ievadi e-pastu un kolēģis saņems uzaicinājumu izveidot kontu vai, ja tāds jau ir, tiks paaugstināts.
        </p>

        <form onSubmit={invite} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="kolegs@example.com"
              className="w-full rounded-xl border border-gray-200 px-9 py-2.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
              disabled={inviting}
            />
          </div>
          <button
            type="submit"
            disabled={inviting || !inviteEmail}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#192635] px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {inviting ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
            {inviting ? "Sūta..." : "Sūtīt uzaicinājumu"}
          </button>
        </form>

        {msg && (
          <div className={`mt-3 rounded-xl border px-4 py-3 text-sm ${
            msg.tone === "ok"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}>
            {msg.tone === "ok"
              ? <CheckCircle size={14} className="-mt-0.5 mr-1.5 inline" />
              : <XCircle size={14} className="-mt-0.5 mr-1.5 inline" />}
            {msg.text}
          </div>
        )}
      </div>

      {/* Team list */}
      <div className="mt-8">
        <h2 className="mb-3 text-sm font-bold text-gray-900">
          Esošie super-admin lietotāji
          <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-600">
            {team.length}
          </span>
        </h2>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={20} className="animate-spin text-gray-400" />
          </div>
        ) : team.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-10 text-center">
            <AlertCircle size={28} className="mx-auto text-gray-300" />
            <p className="mt-3 text-sm text-gray-500">Vēl nav neviena super-admin lietotāja</p>
          </div>
        ) : (
          <div className="space-y-2">
            {team.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-gray-100 bg-white px-5 py-4 shadow-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                    <User size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">
                      {m.email}
                      {m.is_self && (
                        <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold text-brand-700">
                          tu pats
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-400">
                      Pievienots: {new Date(m.created_at).toLocaleDateString("lv-LV")}
                    </p>
                  </div>
                </div>

                {!m.is_self && (
                  <button
                    onClick={() => remove(m.id, m.email)}
                    disabled={removingId === m.id}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                    title="Noņemt super-admin piekļuvi"
                  >
                    {removingId === m.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    Noņemt
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="mt-6 text-xs text-gray-400">
        Drošības piezīme: noņemot super-admin piekļuvi, lietotāja konts netiek izdzēsts —
        viņš zaudē tikai pieeju /admin sadaļai.
      </p>
    </div>
  );
}
