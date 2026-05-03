"use client";

import { useState } from "react";
import { Sparkles, ArrowRight } from "lucide-react";
import { AISearchDialog } from "./ai-search-dialog";

export function AISearch() {
  const [open, setOpen] = useState(false);
  const [seedQuery, setSeedQuery] = useState<string | undefined>(undefined);
  const [text, setText] = useState("");

  function openWith(q?: string) {
    setSeedQuery(q?.trim() || undefined);
    setOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value) {
      // Empty submit → open dialog with no seed (shows suggestions)
      openWith();
    } else {
      openWith(value);
      setText("");
    }
  }

  return (
    <>
      {/* Real input form — taps focus the field directly so the mobile
          keyboard opens immediately. Submit (Enter / Send button) opens
          the AI dialog with the typed query as the first message. */}
      <form
        onSubmit={handleSubmit}
        className="group relative flex w-full max-w-xl items-center gap-2 rounded-full bg-white px-3 py-1.5 shadow-sm transition focus-within:shadow-md hover:shadow-md"
        style={{
          backgroundImage: "linear-gradient(white,white), linear-gradient(90deg,#53F3A4,#AD47FF)",
          backgroundOrigin: "border-box",
          backgroundClip: "padding-box, border-box",
          border: "1.5px solid transparent",
        }}
      >
        <button
          type="button"
          onClick={() => openWith()}
          aria-label="Atvērt AI asistentu"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-transform active:scale-90 group-focus-within:scale-110"
          style={{ background: "linear-gradient(135deg, #53F3A4, #AD47FF)" }}
        >
          <Sparkles size={14} className="text-[#192635]" strokeWidth={2.6} />
        </button>

        <input
          type="text"
          name="q"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Jautā AI asistentam..."
          enterKeyHint="send"
          autoComplete="off"
          className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none"
        />

        {text.trim() ? (
          <button
            type="submit"
            aria-label="Sūtīt"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#192635] text-white transition active:scale-90"
          >
            <ArrowRight size={13} />
          </button>
        ) : (
          <span className="hidden shrink-0 rounded-md border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-mono text-[10px] text-gray-500 sm:inline-block">
            AI
          </span>
        )}
      </form>

      <AISearchDialog
        open={open}
        onClose={() => setOpen(false)}
        initialQuery={seedQuery}
      />
    </>
  );
}
