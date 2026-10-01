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

  function submit() {
    const value = text.trim();
    if (!value) {
      openWith();
    } else {
      openWith(value);
      setText("");
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  }

  // Note: deliberately NOT a <form>. iOS Safari with React 19 has shown
  // submit-without-preventDefault behaviour that reloaded the page before
  // onSubmit could fire. Using a plain <div> + button onClick + input
  // onKeyDown removes any chance of a native submit.
  return (
    <>
      <div
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
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Jautā AI asistentam..."
          enterKeyHint="send"
          autoComplete="off"
          inputMode="search"
          className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none"
        />

        {text.trim() ? (
          <button
            type="button"
            onClick={submit}
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
      </div>

      <AISearchDialog
        open={open}
        onClose={() => setOpen(false)}
        initialQuery={seedQuery}
      />
    </>
  );
}
