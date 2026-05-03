"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, Send, X, Loader2, ArrowUpRight } from "lucide-react";
import Link from "next/link";

type Message = {
  role: "user" | "model";
  content: string;
};

const SUGGESTIONS = [
  "Ko jūs pārdodat?",
  "Meklēju sieru",
  "Cik maksā piegāde?",
  "Kā nopirkt?",
  "Kā kļūt par pārdevēju?",
];

export function AISearchDialog({
  open,
  onClose,
  initialQuery,
}: {
  open: boolean;
  onClose: () => void;
  initialQuery?: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentInitialRef = useRef(false);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
    else {
      sentInitialRef.current = false;
    }
  }, [open]);

  useEffect(() => {
    if (open && initialQuery && !sentInitialRef.current) {
      sentInitialRef.current = true;
      void send(initialQuery);
    }
  }, [open, initialQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamingText]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    const next: Message[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setLoading(true);
    setStreamingText("");
    setActiveTool(null);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      if (!res.body) {
        setMessages([...next, { role: "model", content: "Asistents pašlaik nav pieejams." }]);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let acc = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        // SSE frames separated by blank line
        let idx;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const frame = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const eventLine = frame.split("\n").find((l) => l.startsWith("event: "));
          const dataLine = frame.split("\n").find((l) => l.startsWith("data: "));
          if (!eventLine || !dataLine) continue;
          const eventName = eventLine.slice(7).trim();
          const data = dataLine.slice(6);
          if (eventName === "tool") {
            const parsed = JSON.parse(data) as { name: string };
            setActiveTool(toolLabel(parsed.name));
          } else if (eventName === "token") {
            const chunk = JSON.parse(data) as string;
            acc += chunk;
            setStreamingText(acc);
          } else if (eventName === "done") {
            setMessages((prev) => [...prev, { role: "model", content: acc }]);
            setStreamingText("");
            setActiveTool(null);
          } else if (eventName === "error") {
            const e = JSON.parse(data) as { message: string };
            setMessages((prev) => [...prev, { role: "model", content: `Kļūda: ${e.message}` }]);
            setStreamingText("");
            setActiveTool(null);
          }
        }
      }
    } catch {
      setMessages((prev) => [...prev, { role: "model", content: "Savienojums neizdevās. Pamēģini vēlreiz." }]);
    } finally {
      setLoading(false);
      setActiveTool(null);
    }
  }

  function reset() {
    setMessages([]);
    setStreamingText("");
    setInput("");
    setActiveTool(null);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/40 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6">
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-label="Aizvērt"
      />
      <div className="relative flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-[85vh] sm:max-h-[720px] sm:w-full sm:max-w-2xl sm:rounded-3xl">
        {/* Header */}
        <div
          className="flex items-center gap-3 border-b border-gray-100 px-5 py-4"
          style={{ background: "linear-gradient(90deg, rgba(83,243,164,0.08), rgba(173,71,255,0.08))" }}
        >
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full shadow-sm"
            style={{ background: "linear-gradient(135deg, #53F3A4, #AD47FF)" }}
          >
            <Sparkles size={18} className="text-[#192635]" strokeWidth={2.5} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-extrabold text-gray-900">Tirgus AI asistents</p>
            <p className="text-[11px] text-gray-500">Palīdzu atrast produktus un atbildu jautājumus</p>
          </div>
          {messages.length > 0 && (
            <button
              onClick={reset}
              className="rounded-full px-3 py-1 text-xs font-semibold text-gray-500 hover:bg-gray-100"
            >
              Sākt no jauna
            </button>
          )}
          <button onClick={onClose} aria-label="Aizvērt" className="rounded-full p-1.5 hover:bg-gray-100">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4">
          {messages.length === 0 && !streamingText && (
            <div className="flex flex-col items-center justify-center gap-4 pt-12">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg"
                style={{ background: "linear-gradient(135deg, #53F3A4, #AD47FF)" }}
              >
                <Sparkles size={28} className="text-[#192635]" strokeWidth={2.5} />
              </div>
              <div className="text-center">
                <p className="text-base font-extrabold text-gray-900">Ko meklē šodien?</p>
                <p className="mt-1 text-sm text-gray-500">Palīdzēšu atrast produktu, atbildēšu uz jautājumiem.</p>
              </div>
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => void send(s)}
                    className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:border-gray-300 hover:bg-gray-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <MessageBubble key={i} role={m.role} content={m.content} />
          ))}
          {streamingText && <MessageBubble role="model" content={streamingText} streaming />}
          {loading && !streamingText && (
            <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
              <Loader2 size={14} className="animate-spin" />
              <span>{activeTool ?? "Domā..."}</span>
            </div>
          )}
        </div>

        {/* Input */}
        <form
          className="border-t border-gray-100 bg-white p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <div className="relative flex items-center">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Jautā jebko..."
              enterKeyHint="send"
              autoComplete="off"
              disabled={loading}
              className="w-full rounded-full border border-gray-200 bg-gray-50 px-5 py-3 pr-14 text-sm text-gray-900 placeholder-gray-400 focus:border-purple-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-200/50"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-white transition disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, #53F3A4, #AD47FF)" }}
              aria-label="Sūtīt"
            >
              <Send size={15} className="text-[#192635]" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MessageBubble({ role, content, streaming }: { role: "user" | "model"; content: string; streaming?: boolean }) {
  const isUser = role === "user";
  return (
    <div className={`mb-3 flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={
          isUser
            ? "max-w-[80%] rounded-2xl rounded-br-md bg-[#192635] px-4 py-2.5 text-sm text-white"
            : "max-w-[90%] rounded-2xl rounded-bl-md bg-gray-100 px-4 py-2.5 text-sm leading-relaxed text-gray-900"
        }
      >
        <FormattedText text={content} />
        {streaming && <span className="ml-0.5 inline-block h-3 w-0.5 animate-pulse bg-gray-500 align-middle" />}
      </div>
    </div>
  );
}

// Render text with [label](url) → React Link, **bold** → <strong>, line breaks
function FormattedText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1">
      {lines.map((line, i) => (
        <div key={i}>
          {line.length === 0 ? <br /> : renderInline(line)}
        </div>
      ))}
    </div>
  );
}

function renderInline(line: string): React.ReactNode {
  // Pattern: [label](url) or **bold**
  const tokens: Array<string | React.ReactNode> = [];
  let remaining = line;
  let key = 0;
  while (remaining.length) {
    const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);
    const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
    const linkIdx = linkMatch ? remaining.indexOf(linkMatch[0]) : -1;
    const boldIdx = boldMatch ? remaining.indexOf(boldMatch[0]) : -1;
    const candidates = [linkIdx, boldIdx].filter((i) => i >= 0);
    if (candidates.length === 0) {
      tokens.push(remaining);
      break;
    }
    const next = Math.min(...candidates);
    if (next > 0) tokens.push(remaining.slice(0, next));
    if (next === linkIdx && linkMatch) {
      const [, label, url] = linkMatch;
      tokens.push(
        <Link
          key={key++}
          href={normalizeHref(url)}
          className="inline-flex items-center gap-0.5 font-bold text-[#192635] underline decoration-purple-300 underline-offset-2 hover:text-purple-700"
        >
          {label}
          <ArrowUpRight size={11} />
        </Link>,
      );
      remaining = remaining.slice(next + linkMatch[0].length);
    } else if (next === boldIdx && boldMatch) {
      tokens.push(
        <strong key={key++} className="font-bold">
          {boldMatch[1]}
        </strong>,
      );
      remaining = remaining.slice(next + boldMatch[0].length);
    } else {
      tokens.push(remaining);
      break;
    }
  }
  return <>{tokens}</>;
}

function normalizeHref(url: string): string {
  // Strip the public BASE_URL so internal links use Next routing
  return url.replace(/^https?:\/\/tirgus\.izipizi\.lv/, "") || "/";
}

function toolLabel(name: string): string {
  switch (name) {
    case "search_products":
      return "Meklē produktus...";
    case "get_product":
      return "Skatās produkta detaļas...";
    case "list_categories":
      return "Apskatās kategorijas...";
    case "get_help_topic":
      return "Atrod info...";
    default:
      return "Strādā...";
  }
}
