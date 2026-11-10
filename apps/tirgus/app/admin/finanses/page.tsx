"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Issue = { entity_type: string; entity_id: string; issue: string };
type Refund = { id: string; order_id: string; amount_cents: number | null; status: string; reason: string; provider_reference: string | null };
type Event = { id: string; entity_type: string; entity_id: string; action: string; actor_id: string | null; reference: string; reason: string; evidence: string; created_at: string };
type Target = { entityId: string; entityType: string; action: "review" | "enqueue" | "complete"; expectedCents?: number | null };

export default function FinancePage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [queue, setQueue] = useState<Refund[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [target, setTarget] = useState<Target | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(0);

  async function request(method: string, body?: object, offsetPage = page) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Nav aktīvas administratora sesijas");
    const res = await fetch(`/api/admin/finance?page=${offsetPage}`, {
      method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error ?? "Finanšu pieprasījums neizdevās");
    return result;
  }
  async function load(offsetPage = page) {
    setBusy(true);
    try {
      const data = await request("GET", undefined, offsetPage);
      setIssues(data.issues); setQueue(data.queue); setEvents(data.events);
    } catch (e) { setMessage(e instanceof Error ? e.message : "Kļūda"); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    const initial = setTimeout(() => void load(page), 0);
    return () => clearTimeout(initial);
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!target) return;
    const fields = new FormData(event.currentTarget);
    setBusy(true); setMessage("");
    try {
      await request("POST", { ...target,
        reason: fields.get("reason"), evidence: fields.get("evidence"), reference: fields.get("reference"),
        amountCents: Number(fields.get("amountCents")),
        externallyRefundedAt: fields.get("externallyRefundedAt")
          ? new Date(String(fields.get("externallyRefundedAt"))).toISOString() : undefined,
        verifiedExternal: fields.get("verifiedExternal") === "on",
      });
      setTarget(null);
      setMessage("Ieraksts saglabāts. Pārskatīšana nemaina vēsturiskos datus; šī lapa neveic naudas pārskaitījumu.");
      await load();
    } catch (e) { setMessage(e instanceof Error ? e.message : "Kļūda"); }
    finally { setBusy(false); }
  }
  const button = "rounded border px-3 py-2 text-sm disabled:opacity-50";
  return <div className="mx-auto max-w-5xl space-y-5 p-6">
    <h1 className="text-2xl font-bold">Finanšu pārskatīšana un atmaksas</h1>
    <p>Vēsturiskā PVN, komisijas un operatora identitāte netiek minēta vai automātiski labota.
      Pasūtījums vispirms jāatceļ pasūtījumu sadaļā, atbrīvojot turētās rezervācijas. Jau izlietots krājums netiek automātiski atjaunots — preču atgriešana jāsaskaņo atsevišķi.
      Atmaksa vispirms jāveic un jāpārbauda ārējā maksājumu sistēmā. Jau izrakstītiem rēķiniem nepieciešams grāmatveža kredītrēķins vai manuāla korekcija.</p>
    {message && <p role="status" className="rounded bg-amber-50 p-3">{message}</p>}
    <div className="flex gap-3">
      <button className={button} disabled={busy || page === 0} onClick={() => setPage(page - 1)}>Iepriekšējā</button>
      <span>Lapa {page + 1} · līdz 100 ierakstiem katrā sadaļā</span>
      <button className={button} disabled={busy || Math.max(issues.length, queue.length, events.length) < 100} onClick={() => setPage(page + 1)}>Nākamā</button>
      <button className={button} disabled={busy} onClick={() => void load()}>Atjaunot</button>
    </div>
    <h2 className="text-xl font-bold">Neatrisinātie datu jautājumi</h2>
    {issues.map((issue) => <div key={`${issue.entity_type}:${issue.entity_id}:${issue.issue}`} className="space-y-2 rounded border bg-white p-3">
      <p>{issue.issue} · {issue.entity_type} <code>{issue.entity_id}</code></p>
      <button className={button} onClick={() => setTarget({ entityId: issue.entity_id, entityType: issue.entity_type, action: "review" })}>Pievienot pārskatīšanas pierādījumus</button>{" "}
      {issue.issue === "refund_review_required" && <button className={button} onClick={() => setTarget({ entityId: issue.entity_id, entityType: "order", action: "enqueue" })}>Pievienot atmaksas rindai</button>}
    </div>)}
    <h2 className="text-xl font-bold">Manuālo atmaksu rinda</h2>
    {queue.map(q => <div key={q.id} className="space-y-2 rounded border bg-white p-3">
      <p><code>{q.order_id}</code> · {q.amount_cents === null ? "Summa nav pierādīta — pabeigšana bloķēta" : `${(q.amount_cents / 100).toFixed(2)} EUR`} · {q.status}</p>
      <p>{q.reason} {q.provider_reference}</p>
      {q.status !== "completed" && <button className={button} disabled={q.amount_cents === null} onClick={() => setTarget({ entityId: q.order_id, entityType: "order", action: "complete", expectedCents: q.amount_cents })}>Reģistrēt jau ārēji izpildītu atmaksu</button>}
    </div>)}
    {target && <form onSubmit={submit} className="space-y-3 rounded border-2 border-amber-500 bg-white p-5">
      <h2 className="font-bold">{target.action} · {target.entityId}</h2>
      <label className="block">Pamatojums (vismaz 10 rakstzīmes)<textarea className="input block w-full" name="reason" required minLength={10} maxLength={4000} /></label>
      <label className="block">Pierādījumi / dokumenta atrašanās vieta<textarea className="input block w-full" name="evidence" required minLength={10} maxLength={4000} /></label>
      <label className="block">Ārējā atsauce / maksājumu sniedzēja atmaksas ID<input className="input block w-full" name="reference" required minLength={3} maxLength={4000} /></label>
      {target.action === "complete" && <>
        <p>Precīzā pasūtījuma summa: {target.expectedCents} centi. Daļējas vai neskaidras atmaksas jāsaskaņo atsevišķi.</p>
        <label className="block">Faktiski atmaksātā summa centos<input className="input block" type="number" name="amountCents" required min={1} step={1} /></label>
        <label className="block">Ārēji izpildītās atmaksas laiks<input className="input block" type="datetime-local" name="externallyRefundedAt" required /></label>
        <label className="block"><input type="checkbox" name="verifiedExternal" required /> Esmu ārējā sistēmā pārbaudījis, ka nauda faktiski atmaksāta, un pārbaudījis precīzo summu un unikālo atsauci.</label>
      </>}
      <button className={button} disabled={busy}>Saglabāt audita ierakstu</button>{" "}
      <button className={button} type="button" onClick={() => setTarget(null)}>Aizvērt</button>
    </form>}
    <h2 className="text-xl font-bold">Audita vēsture</h2>
    {events.map(e => <div key={e.id} className="rounded border bg-white p-3">
      <p>{e.created_at} · {e.actor_id ?? "Sistēma (72h politika)"} · {e.action} · {e.entity_type}:{e.entity_id}</p>
      <p>{e.reference} · {e.reason}</p><p>{e.evidence}</p>
    </div>)}
  </div>;
}
