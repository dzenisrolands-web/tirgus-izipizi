"use client";

import { useState, useRef } from "react";
import { Upload, Loader2, X, ImageIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  path: string;
  label: string;
  aspectRatio?: "square" | "wide";
  hint?: string;
}

export function ImageUpload({ value, onChange, path, label, aspectRatio = "wide", hint }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) { setError("Tikai attēlu faili (JPG, PNG, WebP)"); return; }
    if (file.size > 5 * 1024 * 1024) { setError("Fails pārāk liels — maks. 5MB"); return; }

    setUploading(true);
    setError("");

    const ext = file.name.split(".").pop() ?? "jpg";
    const filePath = `${path}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("seller")
      .upload(filePath, file, { upsert: true });

    if (uploadError) { setError(uploadError.message); setUploading(false); return; }

    const { data } = supabase.storage.from("seller").getPublicUrl(filePath);
    onChange(data.publicUrl + "?t=" + Date.now());
    setUploading(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>

      {value ? (
        <div className="relative group">
          <div className={`overflow-hidden rounded-xl bg-gray-100 ${aspectRatio === "square" ? "h-24 w-24" : "h-36 w-full"}`}>
            <img src={value} alt="" className="h-full w-full object-cover" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-xl bg-black/50 opacity-0 group-hover:opacity-100 transition">
            <button type="button" onClick={() => inputRef.current?.click()}
              className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-100">
              <Upload size={11} /> Mainīt
            </button>
            <button type="button" onClick={() => onChange("")}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-red-500 hover:bg-red-50">
              <X size={12} />
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()}
          onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 py-8 transition hover:border-brand-400 hover:bg-brand-50/30">
          {uploading
            ? <Loader2 size={22} className="animate-spin text-brand-500" />
            : <ImageIcon size={22} className="text-gray-300" />}
          <div className="text-center">
            <p className="text-sm font-medium text-gray-600">
              {uploading ? "Augšupielādē..." : "Klikšķini vai velc attēlu"}
            </p>
            {hint && <p className="mt-0.5 text-xs text-gray-400">{hint}</p>}
          </div>
        </button>
      )}

      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}

      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp"
        className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
    </div>
  );
}
