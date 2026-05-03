"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, ChevronRight, ChevronLeft, Loader2, Store, ImageIcon, Video, Link2, Upload, X, FileText, Truck, Package } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { SellerLegalSection, EMPTY_LEGAL, validateLegal, type LegalData } from "@/components/seller-legal-section";

const STEPS = ["Pamatinfo", "Profils", "Video", "Sociālie", "Nodošana", "Juridiskā info"];
const SELF_BILLING_VERSION = "1.0";

const LOCKERS = [
  { id: "brivibas",   name: "Brīvības 253",     city: "Rīga",      address: "Brīvības iela 253 / NESTE" },
  { id: "agenskalna", name: "Āgenskalna tirgus", city: "Rīga",      address: "Nometņu iela 64 / Tirgus" },
  { id: "salaspils",  name: "Salaspils",         city: "Salaspils", address: "Zviedru iela 1C / NESTE" },
  { id: "ikskile",    name: "Ikšķile",           city: "Ikšķile",   address: "Daugavas iela 63 / Labumu bode" },
  { id: "tukums",     name: "Tukuma tirgus",     city: "Tukums",    address: "J. Raiņa iela 30 / Tirgus" },
  { id: "dundaga",    name: "Dundagas tirgus",   city: "Dundaga",   address: "Pils 3B / Tirgus" },
];

export function OnboardingForm() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  async function uploadImage(file: File, field: "avatar_url" | "cover_url", setUploading: (v: boolean) => void) {
    if (!file.type.startsWith("image/")) { setError("Lūdzu izvēlies attēla failu"); return; }
    if (file.size > 5 * 1024 * 1024) { setError("Attēls nedrīkst pārsniegt 5 MB"); return; }
    setUploading(true); setError("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nav pieslēdzies");
      const ext = file.name.split(".").pop();
      const prefix = field === "avatar_url" ? "avatar" : "cover";
      const path = `${user.id}/${prefix}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("product-images").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      set(field, data.publicUrl);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Kļūda augšupielādējot");
    } finally {
      setUploading(false);
    }
  }

  const [form, setForm] = useState({
    name: "",
    farm_name: "",
    location: "",
    description: "",
    short_desc: "",
    avatar_url: "",
    cover_url: "",
    youtube_video_url: "",
    website: "",
    facebook: "",
    instagram: "",
    youtube_channel: "",
    home_locker_ids: [] as string[],
    courier_pickup_address: "",
    ...EMPTY_LEGAL,
  });

  function toggleLocker(id: string) {
    setForm((f) => ({
      ...f,
      home_locker_ids: f.home_locker_ids.includes(id)
        ? f.home_locker_ids.filter((x) => x !== id)
        : [...f.home_locker_ids, id],
    }));
  }

  function set(field: string, value: string | boolean) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function patchLegal(patch: Partial<LegalData>) {
    setForm((f) => ({ ...f, ...patch }));
  }

  function canNext() {
    if (step === 0) return form.name.trim() && form.location.trim();
    if (step === 1) return form.description.trim() && form.short_desc.trim();
    if (step === 2) return form.youtube_video_url.trim();
    if (step === 4) return form.home_locker_ids.length > 0 || !!form.courier_pickup_address.trim();
    if (step === 5) return validateLegal(form).length === 0;
    return true;
  }

  async function handleSubmit() {
    setError("");
    if (form.home_locker_ids.length === 0 && !form.courier_pickup_address.trim()) {
      setError("Atzīmē vismaz vienu pakomātu vai norādi kurjera saņemšanas adresi sadaļā “Nodošana”.");
      setStep(4);
      return;
    }
    const legalErrors = validateLegal(form);
    if (legalErrors.length > 0) {
      setError(legalErrors[0]);
      setStep(5);
      return;
    }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nav pieslēgies");

      const { error } = await supabase.from("sellers").insert({
        user_id: user.id,
        ...form,
        bank_iban: form.bank_iban.replace(/\s/g, "").toUpperCase(),
        vat_number: form.is_vat_registered ? form.vat_number.toUpperCase() : null,
        self_billing_agreed: true,
        self_billing_agreed_at: new Date().toISOString(),
        self_billing_agreement_version: SELF_BILLING_VERSION,
        status: "pending",
      });
      if (error) throw error;
      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Kļūda saglabājot");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4">
        <div className="max-w-md text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-100">
            <CheckCircle size={32} className="text-brand-600" />
          </div>
          <h1 className="mt-4 text-2xl font-extrabold text-gray-900">Paldies!</h1>
          <p className="mt-2 text-gray-500">
            Tavs profils ir iesniegts apstiprināšanai. Mēs to izskatīsim 1–2 darba dienu laikā
            un informēsim tevi pa e-pastu.
          </p>
          <button onClick={() => router.push("/")} className="btn-primary mt-6">
            Atpakaļ uz sākumu
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-extrabold text-gray-900">Izveido savu ražotāja profilu</h1>
        <p className="mt-1 text-sm text-gray-500">Solis {step + 1} no {STEPS.length}</p>
      </div>

      {/* Step indicators */}
      <div className="mb-8 flex items-center justify-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition",
              i < step ? "bg-brand-600 text-white" :
              i === step ? "bg-[#192635] text-white" :
              "bg-gray-100 text-gray-400"
            )}>
              {i < step ? <CheckCircle size={14} /> : i + 1}
            </div>
            <span className={cn("hidden text-xs sm:block", i === step ? "font-semibold text-gray-900" : "text-gray-400")}>
              {s}
            </span>
            {i < STEPS.length - 1 && <div className="h-px w-6 bg-gray-200" />}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        {step === 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-4">
              <Store size={16} className="text-brand-600" /> Pamatinformācija
            </div>
            <Field label="Tavs vārds, uzvārds *" value={form.name} onChange={(v) => set("name", v)} placeholder="Jānis Bērziņš" />
            <Field label="Saimniecības / uzņēmuma nosaukums" value={form.farm_name} onChange={(v) => set("farm_name", v)} placeholder="Bērziņu saimniecība" />
            <Field label="Atrašanās vieta *" value={form.location} onChange={(v) => set("location", v)} placeholder="Cēsis, Vidzeme" />
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-4">
              <ImageIcon size={16} className="text-brand-600" /> Profila apraksts un attēli
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Īss apraksts (SEO) *</label>
              <input value={form.short_desc} onChange={(e) => set("short_desc", e.target.value)}
                className="input mt-1" placeholder="Maks. 160 rakstzīmes — parādīsies Google meklēšanā" maxLength={160} />
              <p className="mt-1 text-xs text-gray-400">{form.short_desc.length}/160</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Pilns apraksts *</label>
              <textarea value={form.description} onChange={(e) => set("description", e.target.value)}
                className="input mt-1 min-h-[120px] resize-y" placeholder="Pastāsti par sevi, saimniecību, ražošanas procesu..." />
            </div>
            {/* Avatar upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Profila foto (avatārs)</label>
              <input ref={avatarRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f, "avatar_url", setUploadingAvatar); }} />
              {form.avatar_url ? (
                <div className="mt-2 flex items-center gap-3">
                  <img src={form.avatar_url} alt="Avatar" className="h-14 w-14 rounded-full object-cover border border-gray-200" />
                  <div className="flex flex-col gap-1">
                    <button type="button" onClick={() => avatarRef.current?.click()} disabled={uploadingAvatar}
                      className="flex items-center gap-1.5 text-sm text-brand-600 hover:underline">
                      <Upload size={13} /> Nomainīt
                    </button>
                    <button type="button" onClick={() => set("avatar_url", "")} className="text-xs text-gray-400 hover:text-red-500">
                      <X size={11} className="inline mr-1" />Noņemt
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => avatarRef.current?.click()} disabled={uploadingAvatar}
                  className="mt-2 flex items-center gap-2 rounded-xl border-2 border-dashed border-gray-200 px-4 py-3 text-sm text-gray-500 hover:border-gray-300 hover:bg-gray-50 transition disabled:opacity-50 w-full">
                  {uploadingAvatar ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} className="text-gray-400" />}
                  {uploadingAvatar ? "Augšupielādē..." : "Augšupielādēt profila foto"}
                </button>
              )}
            </div>

            {/* Cover upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Cover attēls (fona bilde)</label>
              <input ref={coverRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f, "cover_url", setUploadingCover); }} />
              {form.cover_url ? (
                <div className="mt-2 relative h-28 w-full overflow-hidden rounded-xl border border-gray-200">
                  <img src={form.cover_url} alt="Cover" className="h-full w-full object-cover" />
                  <div className="absolute right-2 top-2 flex gap-1.5">
                    <button type="button" onClick={() => coverRef.current?.click()} disabled={uploadingCover}
                      className="rounded-full bg-white/90 p-1.5 shadow hover:bg-white">
                      <Upload size={13} className="text-gray-600" />
                    </button>
                    <button type="button" onClick={() => set("cover_url", "")}
                      className="rounded-full bg-white/90 p-1.5 shadow hover:bg-white">
                      <X size={13} className="text-gray-600" />
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => coverRef.current?.click()} disabled={uploadingCover}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 py-6 text-sm text-gray-500 hover:border-gray-300 hover:bg-gray-50 transition disabled:opacity-50">
                  {uploadingCover ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={18} className="text-gray-300" />}
                  {uploadingCover ? "Augšupielādē..." : "Augšupielādēt fona bildi (1200×400 ieteicams)"}
                </button>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-4">
              <Video size={16} className="text-brand-600" /> Video par sevi *
            </div>
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
              Video ir <strong>obligāts</strong> — tas palīdz pircējiem iepazīt tevi un uzticēties tavam produktam.
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">YouTube video URL *</label>
              <input value={form.youtube_video_url} onChange={(e) => set("youtube_video_url", e.target.value)}
                className="input mt-1" placeholder="https://www.youtube.com/watch?v=..." required />
              <p className="mt-1 text-xs text-gray-400">Ieliec saiti uz YouTube video, kurā stāsti par sevi vai saimniecību</p>
            </div>
            {form.youtube_video_url && (() => {
              const match = form.youtube_video_url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
              if (!match) return <p className="text-xs text-red-500">Nepareizs YouTube URL formāts</p>;
              return (
                <div className="overflow-hidden rounded-xl shadow">
                  <div className="relative aspect-video">
                    <iframe src={`https://www.youtube.com/embed/${match[1]}`}
                      className="absolute inset-0 h-full w-full" allowFullScreen />
                  </div>
                </div>
              );
            })()}
            <Field label="YouTube kanāls (neobligāti)" value={form.youtube_channel} onChange={(v) => set("youtube_channel", v)} placeholder="https://www.youtube.com/@tavs-kanals" />
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-4">
              <Link2 size={16} className="text-brand-600" /> Sociālie tīkli (neobligāti)
            </div>
            <Field label="Mājas lapa" value={form.website} onChange={(v) => set("website", v)} placeholder="https://tava-saimnieciba.lv" />
            <Field label="Facebook" value={form.facebook} onChange={(v) => set("facebook", v)} placeholder="https://facebook.com/..." />
            <Field label="Instagram" value={form.instagram} onChange={(v) => set("instagram", v)} placeholder="https://instagram.com/..." />
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-4">
              <Truck size={16} className="text-brand-600" /> Nodošanas vietas *
            </div>
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
              No šejienes pircēji saņems tavus produktus un tiks aprēķināta piegādes cena. <strong>Obligāti — vismaz viens pakomāts vai kurjera adrese.</strong>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pakomāti, kuros liksi produktus
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                {LOCKERS.map((l) => {
                  const active = form.home_locker_ids.includes(l.id);
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => toggleLocker(l.id)}
                      className={cn(
                        "flex items-start gap-2.5 rounded-xl border-2 p-2.5 text-left transition",
                        active ? "border-brand-400 bg-brand-50" : "border-gray-200 bg-white hover:border-gray-300"
                      )}
                    >
                      <div className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                        active ? "bg-brand-100" : "bg-gray-100"
                      )}>
                        <Package size={14} className={active ? "text-brand-700" : "text-gray-500"} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={cn("font-semibold text-xs", active ? "text-brand-900" : "text-gray-900")}>
                          {l.name}
                        </p>
                        <p className="text-[10px] text-gray-500 truncate">{l.address}</p>
                        <p className="text-[10px] text-gray-400">{l.city}</p>
                      </div>
                      {active && <CheckCircle size={14} className="mt-1 shrink-0 text-brand-600" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Vai kurjera saņemšanas adrese
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Ja kurjers brauc pie tevis paņemt produktus, ievadi adresi. Vari aizpildīt arī papildus pakomātam.
              </p>
              <textarea
                value={form.courier_pickup_address}
                onChange={(e) => set("courier_pickup_address", e.target.value)}
                placeholder="Piem., Brīvības iela 100, Rīga, LV-1011"
                rows={2}
                className="input w-full"
              />
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-4">
              <FileText size={16} className="text-brand-600" /> Juridiskā informācija
            </div>
            <SellerLegalSection data={form} onChange={patchLegal} />
          </div>
        )}

        {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      </div>

      {/* Navigation */}
      <div className="mt-6 flex items-center justify-between">
        <button onClick={() => setStep((s) => s - 1)} disabled={step === 0}
          className="flex items-center gap-1 rounded-full border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-30">
          <ChevronLeft size={16} /> Atpakaļ
        </button>

        {step < STEPS.length - 1 ? (
          <button onClick={() => setStep((s) => s + 1)} disabled={!canNext()}
            className="btn-primary flex items-center gap-1 disabled:opacity-50">
            Tālāk <ChevronRight size={16} />
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={loading || !canNext()}
            className="btn-primary flex items-center gap-2 disabled:opacity-50">
            {loading && <Loader2 size={16} className="animate-spin" />}
            Iesniegt apstiprināšanai
          </button>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)}
        className="input mt-1" placeholder={placeholder} />
    </div>
  );
}
