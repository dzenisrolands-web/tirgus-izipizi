"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { AISearchDialog } from "./ai-search-dialog";

export function AISearch() {
  const [open, setOpen] = useState(false);
  const [seedQuery, setSeedQuery] = useState<string | undefined>(undefined);

  function openWith(q?: string) {
    setSeedQuery(q?.trim() || undefined);
    setOpen(true);
  }

  return (
    <>
      {/* The "search bar" — actually a button styled as an upgraded search input.
          Bigger, gradient ring, sparkle icon → signals AI-powered. */}
      <button
        type="button"
        onClick={() => openWith()}
        className="group relative flex w-full max-w-xl items-center gap-3 rounded-full bg-white px-4 py-2.5 text-left text-sm text-gray-500 shadow-sm transition hover:shadow-md"
        style={{
          backgroundImage:
            "linear-gradient(white,white), linear-gradient(90deg,#53F3A4,#AD47FF)",
          backgroundOrigin: "border-box",
          backgroundClip: "padding-box, border-box",
          border: "1.5px solid transparent",
        }}
        aria-label="Atvērt AI asistentu"
      >
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-transform group-hover:scale-110"
          style={{ background: "linear-gradient(135deg, #53F3A4, #AD47FF)" }}
        >
          <Sparkles size={14} className="text-[#192635]" strokeWidth={2.6} />
        </span>
        <span className="flex-1 truncate">
          <span className="hidden sm:inline">Jautā AI asistentam — atrod produktu, atbild jautājumus...</span>
          <span className="sm:hidden">Jautā AI asistentam...</span>
        </span>
        <span className="hidden shrink-0 rounded-md border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-mono text-[10px] text-gray-500 sm:inline-block">
          AI
        </span>
      </button>

      <AISearchDialog
        open={open}
        onClose={() => setOpen(false)}
        initialQuery={seedQuery}
      />
    </>
  );
}
