"use client";

import { useState, useEffect, useRef } from "react";
import {
  Pencil, Check, X, Plus, Trash2, Loader2, CheckCircle, AlertCircle,
  MapPin, Star, Globe, Facebook, Instagram, Youtube,
  Quote, Award, Calendar, Video, Save, Send, FileText, Package, Truck,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { ImageUpload } from "@/components/image-upload";
import {
  SellerLegalSection,
  EMPTY_LEGAL,
  validateLegal,
  type LegalData,
} from "@/components/seller-legal-section";

type Fact = { label: string; value: string };
type Event = { title: string; desc: string };

const SELF_BILLING_VERSION = "1.0";

const LOCKERS = [
  { id: "brivibas",   name: "Brīvības 253",     city: "Rīga",      address: "Brīvības iela 253 / NESTE" },
  { id: "agenskalna", name: "Āgenskalna tirgus", city: "Rīga",      address: "Nometņu iela 64 / Tirgus" },
  { id: "salaspils",  name: "Salaspils",         city: "Salaspils", address: "Zviedru iela 1C / NESTE" },
  { id: "ikskile",    name: "Ikšķile",           city: "Ikšķile",   address: "Daugavas iela 63 / Labumu bode" },
  { id: "tukums",     name: "Tukuma tirgus",     city: "Tukums",    address: "J. Raiņa iela 30 / Tirgus" },
  { id: "dundaga",    name: "Dundagas tirgus",   city: "Dundaga",   address: "Pils 3B / Tirgus" },
];

type Profile = LegalData & {
  id?: string;
  name: string;
  farm_name: string;
  location: string;
  description: string;
  short_desc: string;
  avatar_url: string;
  cover_url: string;
  youtube_video_url: string;
  youtube_channel: string;
  website: string;
  facebook: string;
  instagram: string;
  facts: Fact[];
  milestones: string[];
  events: Event[];
  status: string;
  home_locker_ids: string[];
  courier_pickup_address: string;
};

const EMPTY: Profile = {
  name: "", farm_name: "", location: "", description: "", short_desc: "",
  avatar_url: "", cover_url: "", youtube_video_url: "", youtube_channel: "",
  website: "", facebook: "", instagram: "",
  facts: [], milestones: [], events: [], status: "draft",
  home_locker_ids: [], courier_pickup_address: "",
  ...EMPTY_LEGAL,
};

export function DashboardProfileEditor() {
  const [profile, setProfile] = useState<Profile>(EMPTY);
  const [saved, setSaved] = useState<Profile>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editSection, setEditSection] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState("");

  const isDirty = JSON.stringify(profile) !== JSON.stringify(saved);
  const [saveError, setSaveError] = useState("");
  const [userId, setUserId] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }
      setUserId(user.id);
      const { data } = await supabase.from("sellers").select("*").eq("user_id", user.id).single();
      if (data) {
        const p: Profile = {
          ...EMPTY, ...data,
          facts: data.facts ?? [],
          milestones: data.milestones ?? [],
          events: data.events ?? [],
          home_locker_ids: data.home_locker_ids ?? [],
          courier_pickup_address: data.courier_pickup_address ?? "",
        };
        setProfile(p);
        setSaved(p);
      } else {
        const { data: pr } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
        setProfile((p) => ({ ...p, name: pr?.full_name ?? "" }));
        setSaved((p) => ({ ...p, name: pr?.full_name ?? "" }));
      }
      setLoading(false);
    })();
  }, []);

  async function save() {
    setSaving(true);
    setSaveError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const justAgreed = !saved.self_billing_agreed && profile.self_billing_agreed;
    const payload = {
      ...profile,
      bank_iban: profile.bank_iban?.replace(/\s/g, "").toUpperCase() ?? "",
      vat_number: profile.is_vat_registered ? profile.vat_number?.toUpperCase() : null,
      ...(justAgreed
        ? {
            self_billing_agreed_at: new Date().toISOString(),
            self_billing_agreement_version: SELF_BILLING_VERSION,
          }
        : {}),
      updated_at: new Date().toISOString(),
    };

    if (profile.id) {
      const { error } = await supabase.from("sellers").update(payload).eq("id", profile.id);
      if (error) { setSaveError(error.message); setSaving(false); return; }
    } else {
      const { data, error } = await supabase.from("sellers").insert({ ...payload, user_id: user.id, status: "draft" }).select().single();
      if (error) { setSaveError(error.message); setSaving(false); return; }
      if (data) setProfile((p) => ({ ...p, id: data.id }));
    }
    setSaved({ ...profile });
    setSaving(false);
    setSaveMsg("Saglabāts!");
    setTimeout(() => setSaveMsg(""), 2000);
  }

  async function submit() {
    // Validate: at least one drop-off location must be set
    const hasLocker = profile.home_locker_ids && profile.home_locker_ids.length > 0;
    const hasPickupAddress = !!profile.courier_pickup_address?.trim();
    if (!hasLocker && !hasPickupAddress) {
      setSaveError("Pirms apstiprināšanas obligāti jāatzīmē vismaz viens pakomāts vai jānorāda kurjera saņemšanas adrese sadaļā “Nodošanas vietas”.");
      setEditSection("dropoff");
      return;
    }
    setSaveError("");
    setSubmitting(true);
    await save();
    await supabase.from("sellers").update({ status: "pending" }).eq("id", profile.id);
    setProfile((p) => ({ ...p, status: "pending" }));
    setSaved((p) => ({ ...p, status: "pending" }));
    setSubmitting(false);
    setSaveMsg("Iesniegts apstiprināšanai!");
    setTimeout(() => setSaveMsg(""), 3000);
  }

  function set(field: keyof Profile, value: unknown) {
    setProfile((p) => ({ ...p, [field]: value }));
  }

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 size={24} className="animate-spin text-brand-600" />
    </div>
  );

  const videoId = profile.youtube_video_url?.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1];

  return (
    <div>
      {/* ── STATUS BAR ──────────────────────────────── */}
      <div className="sticky top-16 z-40 border-b border-gray-200 bg-white/95 backdrop-blur-sm shadow-sm">
        <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <StatusBadge status={profile.status} />
              {saveMsg && <span className="text-xs font-medium text-green-600">{saveMsg}</span>}
              {saveError && <span className="text-xs font-medium text-red-600">{saveError}</span>}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={save} disabled={saving || !isDirty}
                className="flex items-center gap-1.5 rounded-full border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Saglabāt
              </button>
              {profile.status !== "approved" && (
                <button onClick={submit} disabled={submitting || profile.status === "pending"}
                  className="btn-primary flex items-center gap-1.5 py-1.5 text-sm disabled:opacity-40">
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  {profile.status === "pending" ? "Gaida apstiprināšanu" : "Iesniegt apstiprināšanai"}
                </button>
              )}
              {profile.status === "approved" && (
                <span className="flex items-center gap-1 text-xs font-medium text-green-600">
                  <CheckCircle size={14} /> Profils ir aktīvs
                </span>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ── HERO ──────────────────────────────────────────── */}
      <EditableSection id="cover" editSection={editSection} setEditSection={setEditSection}
        label="Cover attēls un pamatinfo"
        editContent={
          <div className="space-y-3">
            <ImageUpload
              value={profile.cover_url}
              onChange={(v) => set("cover_url", v)}
              path={`${userId}/cover`}
              label="Cover attēls"
              aspectRatio="wide"
              hint="JPG, PNG vai WebP · maks. 5MB · ieteicamais izmērs 1200×400px"
            />
            <ImageUpload
              value={profile.avatar_url}
              onChange={(v) => set("avatar_url", v)}
              path={`${userId}/avatar`}
              label="Profila attēls / logo"
              aspectRatio="square"
              hint="Kvadrātveida attēls · maks. 5MB"
            />
            <Field label="Vārds, uzvārds *" value={profile.name} onChange={(v) => set("name", v)} placeholder="Jānis Bērziņš" />
            <Field label="Saimniecības nosaukums" value={profile.farm_name} onChange={(v) => set("farm_name", v)} placeholder="Bērziņu saimniecība" />
            <Field label="Atrašanās vieta *" value={profile.location} onChange={(v) => set("location", v)} placeholder="Cēsis, Vidzeme" />
          </div>
        }>
        <div className="relative h-64 w-full sm:h-80"
          style={{ background: profile.cover_url ? `url(${profile.cover_url}) center/cover no-repeat` : "linear-gradient(135deg,#192635 0%,#2d1f45 100%)" }}>
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          {!profile.cover_url && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="rounded-full bg-white/10 px-4 py-2 text-sm text-white/60">+ Pievienot cover attēlu</span>
            </div>
          )}
          <div className="absolute bottom-0 left-0 right-0 px-4 pb-5 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-6xl flex items-end gap-4">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 border-white bg-white shadow-xl sm:h-24 sm:w-24">
                {profile.avatar_url
                  ? <img src={profile.avatar_url} alt="" className="h-full w-full object-contain p-1.5" />
                  : <div className="flex h-full w-full items-center justify-center bg-brand-100 text-2xl font-bold text-brand-600">{profile.name?.[0] ?? "?"}</div>}
              </div>
              <div className="pb-1">
                <h1 className="text-2xl font-extrabold text-white sm:text-3xl drop-shadow-md">
                  {profile.name || <span className="italic text-white/40">Vārds, uzvārds</span>}
                </h1>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/80">
                  {profile.location
                    ? <span className="flex items-center gap-1"><MapPin size={13} />{profile.location}</span>
                    : <span className="italic text-white/30">+ Atrašanās vieta</span>}
                  <span className="flex items-center gap-1"><Star size={13} fill="currentColor" className="text-amber-400" />0.0</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </EditableSection>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">

        {/* Social strip */}
        <EditableSection id="social" editSection={editSection} setEditSection={setEditSection}
          label="Sociālie tīkli"
          editContent={
            <div className="space-y-3">
              <Field label="Mājas lapa" value={profile.website} onChange={(v) => set("website", v)} placeholder="https://tava-saimnieciba.lv" />
              <Field label="Facebook" value={profile.facebook} onChange={(v) => set("facebook", v)} placeholder="https://facebook.com/..." />
              <Field label="Instagram" value={profile.instagram} onChange={(v) => set("instagram", v)} placeholder="https://instagram.com/..." />
              <Field label="YouTube kanāls" value={profile.youtube_channel} onChange={(v) => set("youtube_channel", v)} placeholder="https://youtube.com/@..." />
            </div>
          }>
          <div className="my-4 flex items-center justify-end gap-2">
            {profile.website && <SocialIcon href={profile.website}><Globe size={15} /></SocialIcon>}
            {profile.facebook && <SocialIcon href={profile.facebook}><Facebook size={15} /></SocialIcon>}
            {profile.instagram && <SocialIcon href={profile.instagram}><Instagram size={15} /></SocialIcon>}
            {profile.youtube_channel && <SocialIcon href={profile.youtube_channel}><Youtube size={15} /></SocialIcon>}
            {!profile.website && !profile.facebook && !profile.instagram && (
              <span className="text-xs text-gray-300 italic">+ Pievienot sociālos tīklus</span>
            )}
          </div>
        </EditableSection>

        {/* Legal info — required for invoicing */}
        {(() => {
          const legalErrs = validateLegal(profile);
          const isComplete = legalErrs.length === 0;
          return (
            <div className="my-4">
              {!isComplete && (
                <div className="mb-3 flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold">Juridiskā informācija nav aizpildīta</p>
                    <p className="mt-0.5 text-xs text-amber-700">
                      Lai saņemtu samaksu par pasūtījumiem un mēs varētu izrakstīt
                      rēķinus tavā vārdā, lūdzu aizpildi sekojošo sadaļu.
                    </p>
                  </div>
                </div>
              )}
              <EditableSection
                id="legal"
                editSection={editSection}
                setEditSection={setEditSection}
                label="Juridiskā informācija un bankas konts"
                required={!isComplete}
                editContent={
                  <SellerLegalSection
                    data={profile}
                    onChange={(p) => setProfile((prev) => ({ ...prev, ...p }))}
                  />
                }
              >
                <div>
                  <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400">
                    <FileText size={13} /> Juridiskā informācija
                  </h2>
                  {isComplete ? (
                    <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                      <div className="rounded-xl bg-gray-50 px-3 py-2.5">
                        <p className="text-[10px] uppercase tracking-wider text-gray-400">Juridiskais nosaukums</p>
                        <p className="font-semibold text-gray-900">{profile.legal_name}</p>
                        <p className="text-xs text-gray-500">Reģ. Nr.: {profile.registration_number}</p>
                        {profile.is_vat_registered && (
                          <p className="text-xs text-gray-500">PVN: {profile.vat_number}</p>
                        )}
                      </div>
                      <div className="rounded-xl bg-gray-50 px-3 py-2.5">
                        <p className="text-[10px] uppercase tracking-wider text-gray-400">Banka</p>
                        <p className="font-semibold text-gray-900">{profile.bank_name}</p>
                        <p className="text-xs text-gray-500 font-mono">{profile.bank_iban}</p>
                      </div>
                      <div className="rounded-xl bg-gray-50 px-3 py-2.5 sm:col-span-2">
                        <p className="text-[10px] uppercase tracking-wider text-gray-400">Juridiskā adrese</p>
                        <p className="text-sm text-gray-700 whitespace-pre-line">{profile.legal_address}</p>
                      </div>
                      <div className="flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 px-3 py-2.5 sm:col-span-2 text-xs text-green-700">
                        <CheckCircle size={13} />
                        Self-billing kārtība pieņemta (versija {profile.self_billing_agreement_version ?? "1.0"})
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm italic text-gray-300">
                      + Pievienot juridiskos rekvizītus, bankas kontu un piekrišanu self-billing kārtībai
                    </p>
                  )}
                </div>
              </EditableSection>
            </div>
          );
        })()}

        {/* ── NODOŠANAS VIETAS — pakomāti + kurjera saņemšanas adrese ── */}
        <div className="px-4 py-4 sm:px-6 lg:px-8 mt-4">
          <EditableSection
            id="dropoff"
            editSection={editSection}
            setEditSection={setEditSection}
            label="Nodošanas vietas — pakomāti un kurjera saņemšana"
            required={profile.home_locker_ids.length === 0 && !profile.courier_pickup_address}
            editContent={
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pakomāti, kurus izmanto produktu ielikšanai
                  </label>
                  <p className="text-xs text-gray-500 mb-3">
                    Atzīmē pakomātus, kuros pats vari ielikt produktus. Pircēji redzēs šos pakomātus kā nosūtīšanas vietas.
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {LOCKERS.map((l) => {
                      const active = profile.home_locker_ids.includes(l.id);
                      return (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => {
                            const next = active
                              ? profile.home_locker_ids.filter((id) => id !== l.id)
                              : [...profile.home_locker_ids, l.id];
                            set("home_locker_ids", next);
                          }}
                          className={cn(
                            "flex items-start gap-3 rounded-xl border-2 p-3 text-left transition",
                            active
                              ? "border-brand-400 bg-brand-50"
                              : "border-gray-200 bg-white hover:border-gray-300"
                          )}
                        >
                          <div className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                            active ? "bg-brand-100" : "bg-gray-100"
                          )}>
                            <Package size={16} className={active ? "text-brand-700" : "text-gray-500"} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={cn("font-semibold text-sm", active ? "text-brand-900" : "text-gray-900")}>
                              {l.name}
                            </p>
                            <p className="text-[11px] text-gray-500 truncate">{l.address}</p>
                            <p className="text-[10px] text-gray-400">{l.city}</p>
                          </div>
                          {active && <CheckCircle size={16} className="mt-1 shrink-0 text-brand-600" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Kurjera saņemšanas adrese <span className="text-gray-400 font-normal">(neobligāti)</span>
                  </label>
                  <p className="text-xs text-gray-500 mb-3">
                    Ja vēlies, lai kurjers paņem produktus tieši no tevis. Ja atstāj tukšu, kurjers paņems no tava izvēlētā pakomāta vai juridiskās adreses.
                  </p>
                  <textarea
                    value={profile.courier_pickup_address}
                    onChange={(e) => set("courier_pickup_address", e.target.value)}
                    placeholder="Piem., &quot;Brīvības iela 100, Rīga, LV-1011&quot; vai &quot;Sazināties iepriekš par precīzu adresi&quot;"
                    rows={2}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
                  />
                </div>
              </div>
            }
          >
            <div>
              <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400">
                <Truck size={13} /> Nodošanas vietas
              </h2>
              {profile.home_locker_ids.length > 0 || profile.courier_pickup_address ? (
                <div className="mt-3 space-y-2">
                  {profile.home_locker_ids.length > 0 && (
                    <div className="rounded-xl bg-gray-50 px-3 py-2.5">
                      <p className="text-[10px] uppercase tracking-wider text-gray-400">
                        <Package size={10} className="inline mr-1" /> Pakomāti ({profile.home_locker_ids.length})
                      </p>
                      <p className="text-sm text-gray-700 mt-0.5">
                        {profile.home_locker_ids
                          .map((id) => LOCKERS.find((l) => l.id === id)?.name ?? id)
                          .join(", ")}
                      </p>
                    </div>
                  )}
                  {profile.courier_pickup_address && (
                    <div className="rounded-xl bg-gray-50 px-3 py-2.5">
                      <p className="text-[10px] uppercase tracking-wider text-gray-400">
                        <Truck size={10} className="inline mr-1" /> Kurjera saņemšanas adrese
                      </p>
                      <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-line">
                        {profile.courier_pickup_address}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="mt-3 text-sm italic text-gray-300">
                  + Norādi, kuros pakomātos liksi produktus vai kurjera saņemšanas adresi
                </p>
              )}
            </div>
          </EditableSection>
        </div>

        <div className="grid gap-10 lg:grid-cols-5 mt-4">

          {/* LEFT col */}
          <div className="space-y-6 lg:col-span-2">

            {/* Bio */}
            <EditableSection id="bio" editSection={editSection} setEditSection={setEditSection}
              label="Par ražotāju"
              editContent={
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Īss apraksts (Google SEO, max 160) *</label>
                    <input value={profile.short_desc} onChange={(e) => set("short_desc", e.target.value)}
                      className="input mt-1" maxLength={160} placeholder="Pircēji redzēs Google meklēšanā..." />
                    <p className="mt-1 text-xs text-gray-400">{profile.short_desc.length}/160</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Pilns apraksts *</label>
                    <textarea value={profile.description} onChange={(e) => set("description", e.target.value)}
                      className="input mt-1 min-h-[120px] resize-y" placeholder="Pastāsti par sevi..." />
                  </div>
                </div>
              }>
              <div>
                <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">Par ražotāju</h2>
                {profile.description
                  ? <p className="mt-3 text-sm leading-7 text-gray-600">{profile.description}</p>
                  : <p className="mt-3 text-sm italic text-gray-300">+ Pievienot aprakstu par sevi un saimniecību...</p>}
              </div>
            </EditableSection>

            {/* Facts */}
            <EditableSection id="facts" editSection={editSection} setEditSection={setEditSection}
              label="Fakti"
              editContent={
                <div className="space-y-2">
                  {profile.facts.map((f, i) => (
                    <div key={i} className="flex gap-2">
                      <input value={f.label} onChange={(e) => { const fs = [...profile.facts]; fs[i] = { ...fs[i], label: e.target.value }; set("facts", fs); }}
                        className="input w-28 shrink-0 text-xs" placeholder="Nosaukums" />
                      <input value={f.value} onChange={(e) => { const fs = [...profile.facts]; fs[i] = { ...fs[i], value: e.target.value }; set("facts", fs); }}
                        className="input flex-1 text-xs" placeholder="Vērtība" />
                      <button onClick={() => set("facts", profile.facts.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                    </div>
                  ))}
                  <button onClick={() => set("facts", [...profile.facts, { label: "", value: "" }])}
                    className="flex items-center gap-1 text-xs text-brand-600 hover:underline">
                    <Plus size={12} /> Pievienot faktu
                  </button>
                </div>
              }>
              <div>
                <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">Fakti</h2>
                {profile.facts.length > 0
                  ? <dl className="mt-3 space-y-2">
                    {profile.facts.map((f, i) => (
                      <div key={i} className="flex gap-3 rounded-xl bg-gray-50 px-3 py-2.5 text-sm">
                        <dt className="w-28 shrink-0 font-semibold text-gray-500">{f.label}</dt>
                        <dd className="text-gray-800">{f.value}</dd>
                      </div>
                    ))}
                  </dl>
                  : <p className="mt-3 text-sm italic text-gray-300">+ Pievienot faktus (dibināts, sertifikāti, utt.)</p>}
              </div>
            </EditableSection>

            {/* Milestones */}
            <EditableSection id="milestones" editSection={editSection} setEditSection={setEditSection}
              label="Sasniegumi"
              editContent={
                <div className="space-y-2">
                  {profile.milestones.map((m, i) => (
                    <div key={i} className="flex gap-2">
                      <input value={m} onChange={(e) => { const ms = [...profile.milestones]; ms[i] = e.target.value; set("milestones", ms); }}
                        className="input flex-1 text-xs" placeholder="Sasniegums..." />
                      <button onClick={() => set("milestones", profile.milestones.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                    </div>
                  ))}
                  <button onClick={() => set("milestones", [...profile.milestones, ""])}
                    className="flex items-center gap-1 text-xs text-brand-600 hover:underline">
                    <Plus size={12} /> Pievienot sasniegumu
                  </button>
                </div>
              }>
              <div>
                <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400"><Award size={13} /> Sasniegumi</h2>
                {profile.milestones.length > 0
                  ? <ul className="mt-3 space-y-3">
                    {profile.milestones.map((m, i) => (
                      <li key={i} className="flex gap-3 text-sm text-gray-600">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-[#192635]"
                          style={{ background: "linear-gradient(135deg,#53F3A4,#AD47FF)" }}>{i + 1}</span>
                        <span className="leading-relaxed">{m}</span>
                      </li>
                    ))}
                  </ul>
                  : <p className="mt-3 text-sm italic text-gray-300">+ Pievienot sasniegumus un interesantus faktus...</p>}
              </div>
            </EditableSection>

            {/* Events */}
            <EditableSection id="events" editSection={editSection} setEditSection={setEditSection}
              label="Notikumi"
              editContent={
                <div className="space-y-3">
                  {profile.events.map((ev, i) => (
                    <div key={i} className="space-y-1 rounded-lg bg-gray-50 p-3">
                      <div className="flex gap-2">
                        <input value={ev.title} onChange={(e) => { const es = [...profile.events]; es[i] = { ...es[i], title: e.target.value }; set("events", es); }}
                          className="input flex-1 text-xs font-semibold" placeholder="Nosaukums" />
                        <button onClick={() => set("events", profile.events.filter((_, j) => j !== i))} className="text-red-400"><Trash2 size={14} /></button>
                      </div>
                      <textarea value={ev.desc} onChange={(e) => { const es = [...profile.events]; es[i] = { ...es[i], desc: e.target.value }; set("events", es); }}
                        className="input w-full text-xs" placeholder="Apraksts..." />
                    </div>
                  ))}
                  <button onClick={() => set("events", [...profile.events, { title: "", desc: "" }])}
                    className="flex items-center gap-1 text-xs text-brand-600 hover:underline">
                    <Plus size={12} /> Pievienot notikumu
                  </button>
                </div>
              }>
              <div>
                <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400"><Calendar size={13} /> Notikumi</h2>
                {profile.events.length > 0
                  ? <div className="mt-3 space-y-3">
                    {profile.events.map((ev, i) => (
                      <div key={i} className="rounded-2xl border border-brand-100 bg-brand-50/50 p-4">
                        <p className="text-sm font-bold text-brand-800">{ev.title}</p>
                        <p className="mt-1 text-xs leading-relaxed text-gray-600">{ev.desc}</p>
                      </div>
                    ))}
                  </div>
                  : <p className="mt-3 text-sm italic text-gray-300">+ Pievienot tirgu datumus, degustācijas...</p>}
              </div>
            </EditableSection>
          </div>

          {/* RIGHT col */}
          <div className="space-y-8 lg:col-span-3">

            {/* Video */}
            <EditableSection id="video" editSection={editSection} setEditSection={setEditSection}
              label="Video"
              editContent={
                <div className="space-y-3">
                  <Field label="YouTube video URL" value={profile.youtube_video_url} onChange={(v) => set("youtube_video_url", v)} placeholder="https://www.youtube.com/watch?v=..." />
                </div>
              }>
              <div>
                <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
                  <Video size={13} /> Video
                </h2>
                {videoId
                  ? <div className="overflow-hidden rounded-2xl shadow-md"><div className="relative aspect-video w-full">
                    <iframe src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen className="absolute inset-0 h-full w-full" />
                  </div></div>
                  : <div className="flex h-48 items-center justify-center rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50">
                    <div className="text-center">
                      <Video size={32} className="mx-auto text-amber-400" />
                      <p className="mt-2 text-sm font-semibold text-amber-700">Pievienot YouTube video</p>
                      <p className="text-xs text-amber-500">Klikšķini uz ✏️ lai pievienotu saiti</p>
                    </div>
                  </div>}
              </div>
            </EditableSection>

            {/* Quote */}
            <EditableSection id="quote" editSection={editSection} setEditSection={setEditSection}
              label="Citāts"
              editContent={
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Citāts</label>
                    <textarea value={(profile as Record<string, unknown>).quote_text as string ?? ""}
                      onChange={(e) => set("quote_text" as keyof Profile, e.target.value)}
                      className="input mt-1 min-h-[80px] resize-y" placeholder="Tava filozofija vai moto..." />
                  </div>
                  <Field label="Autors" value={(profile as Record<string, unknown>).quote_author as string ?? ""}
                    onChange={(v) => set("quote_author" as keyof Profile, v)} placeholder="Tavs vārds vai saimniecības nosaukums" />
                </div>
              }>
              <div>
                {(profile as Record<string, unknown>).quote_text
                  ? <div className="relative rounded-2xl bg-[#192635] px-6 py-5 text-white overflow-hidden">
                    <div className="absolute -top-2 -left-1 opacity-20"><Quote size={64} /></div>
                    <p className="relative text-base font-medium leading-relaxed text-white/90 italic">
                      "{(profile as Record<string, unknown>).quote_text as string}"
                    </p>
                    <p className="mt-3 text-sm font-semibold"
                      style={{ background: "linear-gradient(90deg,#53F3A4,#AD47FF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                      — {(profile as Record<string, unknown>).quote_author as string}
                    </p>
                  </div>
                  : <p className="text-sm italic text-gray-300">+ Pievienot citātu / filozofiju...</p>}
              </div>
            </EditableSection>

          </div>
        </div>
      </div>
    </div>
  );
}

// ── EDITABLE SECTION WRAPPER ──────────────────────────────────────────────────
function EditableSection({ id, children, editContent, label, editSection, setEditSection, required }: {
  id: string; children: React.ReactNode; editContent: React.ReactNode;
  label: string; editSection: string | null; setEditSection: (s: string | null) => void; required?: boolean;
}) {
  const isEditing = editSection === id;
  return (
    <div className={cn("group relative rounded-xl transition", isEditing ? "ring-2 ring-brand-400" : "hover:ring-1 hover:ring-gray-200")}>
      {/* Edit toggle */}
      <button onClick={() => setEditSection(isEditing ? null : id)}
        className={cn(
          "absolute right-2 top-2 z-10 flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition shadow-sm",
          isEditing ? "bg-gray-800 text-white" : "bg-white/90 text-gray-600 border border-gray-200",
          required && !isEditing && "opacity-100 bg-amber-100 text-amber-700 border-amber-300"
        )}>
        {isEditing ? <><X size={11} /> Aizvērt</> : <><Pencil size={11} /> {required ? "Obligāts!" : "Rediģēt"}</>}
      </button>

      {/* Content view */}
      <div className={cn(isEditing && "opacity-30 pointer-events-none")}>{children}</div>

      {/* Edit form */}
      {isEditing && (
        <div className="mt-3 rounded-xl bg-gray-50 border border-gray-200 p-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">{label}</p>
          {editContent}
          <button onClick={() => setEditSection(null)}
            className="mt-4 flex items-center gap-1 rounded-full bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-700">
            <Check size={12} /> Gatavs
          </button>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="input mt-1" placeholder={placeholder} />
    </div>
  );
}

function SocialIcon({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-900 transition">
      {children}
    </a>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; class: string }> = {
    draft: { label: "Melnraksts", class: "bg-gray-100 text-gray-600" },
    pending: { label: "Gaida apstiprināšanu", class: "bg-amber-100 text-amber-700" },
    approved: { label: "Apstiprināts", class: "bg-green-100 text-green-700" },
    rejected: { label: "Noraidīts", class: "bg-red-100 text-red-700" },
    suspended: { label: "Apturēts", class: "bg-gray-200 text-gray-600" },
  };
  const s = map[status] ?? map.draft;
  return <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", s.class)}>{s.label}</span>;
}
