"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, ChevronRight, ChevronLeft, Loader2, Store, ImageIcon, Video, Link2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const STEPS = ["Pamatinfo", "Profils", "Video", "Sociālie"];

export function OnboardingForm() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

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
  });

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function canNext() {
    if (step === 0) return form.name.trim() && form.location.trim();
    if (step === 1) return form.description.trim() && form.short_desc.trim();
    if (step === 2) return form.youtube_video_url.trim();
    return true;
  }

  async function handleSubmit() {
    setError("");
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nav pieslēgies");

      const { error } = await supabase.from("sellers").insert({
        user_id: user.id,
        ...form,
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
            <Field label="Profila foto URL (avatārs)" value={form.avatar_url} onChange={(v) => set("avatar_url", v)} placeholder="https://..." />
            <Field label="Cover attēla URL" value={form.cover_url} onChange={(v) => set("cover_url", v)} placeholder="https://..." />
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
