"use client";

import { useState } from "react";
import { Search, MapPin, AlertCircle, CheckCircle, Truck, Zap, X } from "lucide-react";
import { lookupPostalCode, type LookupResult } from "@/lib/postal-zones";

const ZONE_COLORS: Record<number, { bg: string; border: string; text: string; badge: string }> = {
  0: { bg: "bg-green-50", border: "border-green-200", text: "text-green-700", badge: "bg-green-500" },
  1: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", badge: "bg-blue-500" },
  2: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", badge: "bg-amber-500" },
  3: { bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-700", badge: "bg-purple-500" },
};

export function PostalZoneLookup() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<LookupResult | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) {
      setResult(null);
      return;
    }
    setResult(lookupPostalCode(input));
  }

  function clear() {
    setInput("");
    setResult(null);
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50">
          <Search size={16} className="text-brand-700" />
        </div>
        <div>
          <h3 className="font-bold text-gray-900">Pārbaudi savu pasta indeksu</h3>
          <p className="text-xs text-gray-500">Ieraksti, lai uzzinātu zonu un cenu</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="LV-1050 vai 1050"
            inputMode="numeric"
            maxLength={8}
            className="input w-full pr-8 font-mono text-base tracking-wider"
            aria-label="Pasta indekss"
          />
          {input && (
            <button
              type="button"
              onClick={clear}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
              aria-label="Notīrīt"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <button
          type="submit"
          className="btn-primary flex items-center gap-1.5 px-4 py-2"
          disabled={!input.trim()}
        >
          <Search size={14} /> Pārbaudīt
        </button>
      </form>

      {/* Result */}
      {result && (
        <div className="mt-4">
          {result.found ? <FoundResult result={result} /> : <NotFoundResult result={result} />}
        </div>
      )}

      {/* Quick examples */}
      {!result && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-gray-500">
          <span>Mēģini:</span>
          {["1050", "2167", "5001"].map((code) => (
            <button
              key={code}
              onClick={() => {
                setInput(code);
                setResult(lookupPostalCode(code));
              }}
              className="rounded-full bg-gray-100 px-2.5 py-0.5 font-mono hover:bg-gray-200 transition"
            >
              {code}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FoundResult({ result }: { result: Extract<LookupResult, { found: true }> }) {
  const c = ZONE_COLORS[result.zone];
  const p = result.pricing;
  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} p-4`}>
      <div className="flex items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${c.badge} text-base font-extrabold text-white`}>
          {result.zone}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <CheckCircle size={14} className={c.text} />
            <p className={`font-bold ${c.text}`}>
              LV-{result.code} pieder Zonai {result.zone}
            </p>
          </div>
          <p className="mt-0.5 text-sm font-semibold text-gray-900">{p.area}</p>
          <p className="text-xs text-gray-500">{p.cities}</p>
        </div>
      </div>

      {/* Prices */}
      <div className="mt-4 space-y-2">
        <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm">
          <Truck size={14} className="text-gray-500" />
          <span className="flex-1 text-gray-700">Standarta kurjers</span>
          <span className="font-mono font-bold text-gray-900">
            {p.singleTemp.toFixed(2)} €
          </span>
          <span className="text-xs text-gray-400">/ {p.dualTemp.toFixed(2)} €</span>
        </div>
        {p.expressSingle && p.expressDual ? (
          <div className="flex items-center gap-2 rounded-lg bg-yellow-50 px-3 py-2 text-sm">
            <Zap size={14} className="text-yellow-600" />
            <span className="flex-1 text-yellow-800">Eksprespiegāde 2–5h</span>
            <span className="font-mono font-bold text-yellow-700">
              {p.expressSingle.toFixed(2)} €
            </span>
            <span className="text-xs text-yellow-500">/ {p.expressDual.toFixed(2)} €</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-xs text-gray-500">
            <Zap size={12} />
            Eksprespiegāde nav pieejama Zonā 3
          </div>
        )}
        <p className="text-[10px] text-gray-400">
          Cenas: 1 temperatūras režīms / 2 temp. režīmi · ar PVN 21%
        </p>
      </div>

      {/* Locker alternative */}
      <div className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-800">
        <strong>💡 Lētāk:</strong> izvēlies tuvāko pakomātu — vienmēr <strong>3€</strong>.{" "}
        <a href="#pakomati-saraksts" className="underline">
          Skatīt pakomātus
        </a>
      </div>
    </div>
  );
}

function NotFoundResult({ result }: { result: Extract<LookupResult, { found: false }> }) {
  if (result.reason === "invalid_format") {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
        <AlertCircle size={16} className="mt-0.5 shrink-0 text-gray-400" />
        <div className="text-xs text-gray-600">
          <p className="font-semibold text-gray-900">Nepareizs formāts</p>
          <p>Latvijas pasta indekss ir 4 cipari, piem. <strong>LV-1050</strong> vai <strong>5001</strong>.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
      <MapPin size={16} className="mt-0.5 shrink-0 text-amber-600" />
      <div className="text-xs text-amber-800">
        <p className="font-semibold">
          LV-{result.code} nav mūsu apkalpotajās zonās
        </p>
        <p className="mt-0.5">
          Šobrīd nepiegādājam ar kurjeru uz šo indeksu. Vari izvēlēties{" "}
          <a href="#pakomati-saraksts" className="underline font-semibold">tuvāko pakomātu</a>{" "}
          (3€) vai sazināties ar <a href="mailto:birojs@izipizi.lv" className="underline font-semibold">birojs@izipizi.lv</a>{" "}
          individuālam risinājumam.
        </p>
      </div>
    </div>
  );
}
