"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cookie, X, ChevronDown } from "lucide-react";
import {
  CONSENT_STORAGE_KEY,
  CONSENT_VERSION,
  CONSENT_OPEN_EVENT,
  CONSENT_CHANGED_EVENT,
  type Consent,
} from "@/lib/cookie-consent";

type Category = {
  key: "essential" | "functional" | "analytics" | "marketing";
  title: string;
  description: string;
  required?: boolean;
};

const CATEGORIES: Category[] = [
  {
    key: "essential",
    title: "Būtiskās",
    description:
      "Nepieciešamas vietnes pamata darbībai — autentifikācija, grozs, valodas izvēle. Bez šīm vietne nedarbosies.",
    required: true,
  },
  {
    key: "functional",
    title: "Funkcionālās",
    description:
      "Uzlabo lietošanas pieredzi — push paziņojumu abonements, izvēles iegaumēšana (piem., izvēlētais pakomāts).",
  },
  {
    key: "analytics",
    title: "Analītika",
    description:
      "Anonimizēta statistika par vietnes lietošanu, lai mēs varētu uzlabot funkcionalitāti. Pašlaik nelietojam, bet rezervējam šo izvēli nākotnei.",
  },
  {
    key: "marketing",
    title: "Mārketings",
    description:
      "Mērķtiecīgas reklāmas un atbilstošs saturs. Pašlaik nelietojam.",
  },
];

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState<Pick<Consent, "functional" | "analytics" | "marketing">>({
    functional: false,
    analytics: false,
    marketing: false,
  });

  useEffect(() => {
    // Show banner if no consent recorded or version mismatch
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) {
      setVisible(true);
    } else {
      try {
        const parsed = JSON.parse(raw) as Consent;
        if (parsed.version !== CONSENT_VERSION) {
          setVisible(true);
        } else {
          setDraft({
            functional: parsed.functional,
            analytics: parsed.analytics,
            marketing: parsed.marketing,
          });
        }
      } catch {
        setVisible(true);
      }
    }

    // Listen for footer button to re-open settings
    const onOpen = () => {
      setVisible(true);
      setExpanded(true);
    };
    window.addEventListener(CONSENT_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, onOpen);
  }, []);

  function save(consent: Pick<Consent, "functional" | "analytics" | "marketing">) {
    const next: Consent = {
      version: CONSENT_VERSION,
      essential: true,
      functional: consent.functional,
      analytics: consent.analytics,
      marketing: consent.marketing,
      decidedAt: new Date().toISOString(),
    };
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT, { detail: next }));
    setVisible(false);
    setExpanded(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="cookie-title"
      aria-describedby="cookie-desc"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white shadow-2xl"
    >
      <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6 sm:py-5">
        {/* Collapsed state — quick choices */}
        {!expanded && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex items-start gap-3 sm:flex-1">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50">
                <Cookie size={18} className="text-brand-600" />
              </div>
              <div className="min-w-0">
                <p id="cookie-title" className="font-extrabold text-gray-900">
                  Sīkdatnes
                </p>
                <p id="cookie-desc" className="mt-0.5 text-xs leading-relaxed text-gray-500">
                  Lietojam sīkdatnes vietnes darbībai un uzlabotai pieredzei.{" "}
                  <Link href="/privatums" className="text-brand-600 hover:underline">
                    Lasīt vairāk
                  </Link>
                  .
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 sm:shrink-0">
              <button
                onClick={() => setExpanded(true)}
                className="rounded-full border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Pielāgot
              </button>
              <button
                onClick={() => save({ functional: false, analytics: false, marketing: false })}
                className="rounded-full border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Tikai būtiskās
              </button>
              <button
                onClick={() => save({ functional: true, analytics: true, marketing: true })}
                className="rounded-full px-4 py-2 text-xs font-bold text-[#192635] hover:brightness-110"
                style={{ background: "linear-gradient(90deg,#53F3A4,#AD47FF)" }}
              >
                Pieņemt visu
              </button>
            </div>
          </div>
        )}

        {/* Expanded state — detailed toggles */}
        {expanded && (
          <div>
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50">
                  <Cookie size={16} className="text-brand-600" />
                </div>
                <div>
                  <p className="font-extrabold text-gray-900">Sīkdatņu iestatījumi</p>
                  <p className="text-xs text-gray-500">
                    Izvēlies, kuras sīkdatnes vēlies pieņemt
                  </p>
                </div>
              </div>
              <button
                onClick={() => setExpanded(false)}
                className="text-gray-400 hover:text-gray-700"
                aria-label="Atpakaļ"
              >
                <ChevronDown size={18} />
              </button>
            </div>

            <div className="max-h-[60vh] space-y-2 overflow-y-auto">
              {CATEGORIES.map((cat) => {
                const enabled = cat.required ? true : draft[cat.key as keyof typeof draft];
                return (
                  <label
                    key={cat.key}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 transition ${
                      cat.required ? "border-gray-100 bg-gray-50" : enabled ? "border-brand-200 bg-brand-50/30" : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={enabled}
                      disabled={cat.required}
                      onChange={(e) => {
                        if (cat.required) return;
                        setDraft((d) => ({ ...d, [cat.key]: e.target.checked }));
                      }}
                      className="mt-0.5 h-4 w-4 accent-brand-600 disabled:opacity-60"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-gray-900">{cat.title}</p>
                        {cat.required && (
                          <span className="rounded-full bg-gray-200 px-1.5 py-0 text-[9px] font-bold text-gray-600">
                            VIENMĒR IESLĒGTAS
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs leading-relaxed text-gray-500">
                        {cat.description}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <Link href="/privatums" className="text-xs text-brand-600 hover:underline">
                Pilna privātuma politika →
              </Link>
              <div className="flex gap-2">
                <button
                  onClick={() => save({ functional: false, analytics: false, marketing: false })}
                  className="rounded-full border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Tikai būtiskās
                </button>
                <button
                  onClick={() => save(draft)}
                  className="rounded-full px-4 py-2 text-xs font-bold text-[#192635] hover:brightness-110"
                  style={{ background: "linear-gradient(90deg,#53F3A4,#AD47FF)" }}
                >
                  Saglabāt izvēli
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
