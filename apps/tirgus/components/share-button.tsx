"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Facebook, MessageCircle, Share2 } from "lucide-react";

type Props = {
  title: string;
  sellerName: string;
  price: number;
  unit: string;
  /** Override URL (defaults to current window.location.href in browser) */
  url?: string;
};

export function ShareButton({ title, sellerName, price, unit, url }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hasNative, setHasNative] = useState(false);

  useEffect(() => {
    setHasNative(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  const shareText = `${title} no ${sellerName} — €${price.toFixed(2)}/${unit}. Atrasts tirgus.izipizi.lv:`;

  function shareUrl(): string {
    if (url) return url;
    if (typeof window !== "undefined") return window.location.href;
    return "https://tirgus.izipizi.lv";
  }

  async function handleClick() {
    if (hasNative) {
      try {
        await navigator.share({ title, text: shareText, url: shareUrl() });
      } catch {
        // user dismissed share sheet — no-op
      }
      return;
    }
    setOpen((v) => !v);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked — silently ignore
    }
  }

  const waHref = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl()}`)}`;
  const fbHref = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl())}`;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        aria-label="Dalies ar produktu"
        className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
      >
        <Share2 size={14} />
        Dalies
      </button>

      {open && !hasNative && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute right-0 top-full z-50 mt-1.5 w-56 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-lg">
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
              onClick={() => setOpen(false)}
            >
              <MessageCircle size={16} className="text-green-600" />
              WhatsApp
            </a>
            <a
              href={fbHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
              onClick={() => setOpen(false)}
            >
              <Facebook size={16} className="text-blue-600" />
              Facebook
            </a>
            <button
              type="button"
              onClick={handleCopy}
              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              {copied ? (
                <>
                  <Check size={16} className="text-green-600" />
                  Nokopēts!
                </>
              ) : (
                <>
                  <Copy size={16} className="text-gray-500" />
                  Kopēt saiti
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
