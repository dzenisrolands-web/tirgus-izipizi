"use client";

import { useState } from "react";
import { MapPin, AlertCircle, CheckCircle, Truck, Zap, Package } from "lucide-react";
import { BUYER_LOCKER_FEE_CENTS } from "@/lib/delivery-policy";
import { formatPrice } from "@/lib/utils";
import { lookupPostalCode, type LookupResult } from "@/lib/postal-zones";
import { LvAddressAutocomplete, type ParsedAddress } from "@/components/lv-address-autocomplete";

const ZONE_COLORS: Record<number, { bg: string; border: string; text: string; badge: string }> = {
  0: { bg: "bg-green-50", border: "border-green-200", text: "text-green-700", badge: "bg-green-500" },
  1: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", badge: "bg-blue-500" },
  2: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", badge: "bg-amber-500" },
  3: { bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-700", badge: "bg-purple-500" },
};

export function PostalZoneLookup() {
  const [addressText, setAddressText] = useState("");
  const [parsedAddress, setParsedAddress] = useState<ParsedAddress | null>(null);
  const [result, setResult] = useState<LookupResult | null>(null);

  function handleAddressSelect(parsed: ParsedAddress) {
    setParsedAddress(parsed);
    if (parsed.postalCode && parsed.postalCode.length === 4) {
      const r = lookupPostalCode(parsed.postalCode);
      // Prefer Nominatim city name over hardcoded mapping (more accurate)
      if (r.found && parsed.city) {
        setResult({ ...r, place: parsed.city });
      } else {
        setResult(r);
      }
    } else {
      // Address picked but no postal code returned — show invalid format guidance
      setResult({ found: false, reason: "invalid_format" });
    }
  }

  function handleAddressChange(v: string) {
    setAddressText(v);
    // Any edit invalidates the previously selected address and quote estimate.
    setResult(null);
    setParsedAddress(null);
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50">
          <MapPin size={16} className="text-brand-700" />
        </div>
        <div>
          <h3 className="font-bold text-gray-900">Pārbaudi piegādi savā adresē</h3>
          <p className="text-xs text-gray-500">Izvēlies adresi — pārbaudīsim publicēto galamērķa pasta indeksu un zonas tarifu</p>
        </div>
      </div>

      <LvAddressAutocomplete
        value={addressText}
        onChange={handleAddressChange}
        onSelect={handleAddressSelect}
        placeholder="Piem., Brīvības iela 100, Rīga"
      />

      {parsedAddress && parsedAddress.postalCode && (
        <p className="mt-2 text-xs text-gray-500">
          Pasta indekss: <span className="font-mono font-semibold text-gray-700">LV-{parsedAddress.postalCode}</span>
          {parsedAddress.city && (
            <> · <span className="text-gray-700">{parsedAddress.city}</span></>
          )}
        </p>
      )}

      {/* Result */}
      {result && (
        <div className="mt-4">
          {result.found ? <FoundResult result={result} /> : <NotFoundResult result={result} />}
        </div>
      )}
    </div>
  );
}

export function FoundResult({ result }: { result: Extract<LookupResult, { found: true }> }) {
  const c = ZONE_COLORS[result.zone];
  const p = result.pricing;
  const expressAvailable = !!(p.expressSingle && p.expressDual);
  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} p-4`}>
      <div className="flex items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${c.badge} text-base font-extrabold text-white`}>
          {result.zone}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <MapPin size={14} className={c.text} />
            <p className={`text-base font-extrabold ${c.text}`}>
              {result.place}
            </p>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs">
            <CheckCircle size={11} className={c.text} />
            <span className={`font-semibold ${c.text}`}>LV-{result.code}</span>
            <span className="text-gray-400">·</span>
            <span className="text-gray-600">Zona {result.zone} — {p.area}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-white p-3 text-xs text-gray-700">
        <p><strong>Standarta kurjers:</strong> no {formatPrice(p.singleTemp)} par ražotāju (1 temperatūra); {formatPrice(p.dualTemp)} (2 temperatūras).</p>
        {expressAvailable && <p className="mt-1"><strong>Ekspres:</strong> no {formatPrice(p.expressSingle!)} par ražotāju (1 temperatūra); {formatPrice(p.expressDual!)} (2 temperatūras).</p>}
        <p className="mt-1"><strong>Pakomāts:</strong> {formatPrice(BUYER_LOCKER_FEE_CENTS / 100)} vienreiz par ražotāju un saņemšanas vietu, arī divām temperatūrām.</p>
        <p className="mt-2 text-gray-500">Cenas ar esošo 21% pakalpojuma PVN. Zonas tarifs pats par sevi neapstiprina produktu piegādes atļauju vai pārvadātāja maršrutu.</p>
      </div>

      {/* Final delivery eligibility is checked for every selected product. */}
      <div className="mt-4">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-500">
          Vai arī piegāde uz adresi
        </p>
        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm">
            <Truck size={14} className="text-green-600" />
            <span className="flex-1 text-gray-800">Standarta kurjers</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
              <CheckCircle size={9} /> Zonas tarifs
            </span>
          </div>
          {expressAvailable ? (
            <div className="flex items-center gap-2 rounded-lg bg-yellow-50 px-3 py-2 text-sm">
              <Zap size={14} className="text-yellow-600" />
              <span className="flex-1 text-yellow-800">Eksprespiegāde 2–5h</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-yellow-200 px-2 py-0.5 text-[10px] font-bold text-yellow-800">
                <CheckCircle size={9} /> Zonas tarifs
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-500">
              <Zap size={14} />
              <span className="flex-1">Eksprespiegāde 2–5h</span>
              <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-bold text-gray-600">
                Zonā {result.zone} nav publicēts
              </span>
            </div>
          )}
          <p className="text-[11px] text-gray-500 leading-relaxed pt-1">
            Galīgais piedāvājums grozā ir atkarīgs no ražotāju skaita, sūtījuma temperatūrām un visu produktu atļautajiem piegādes veidiem. Zonas tarifu nosaka tikai galamērķa pasta indekss.
          </p>
        </div>
      </div>
    </div>
  );
}

export function NotFoundResult({ result }: { result: Extract<LookupResult, { found: false }> }) {
  if (result.reason === "invalid_format") {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
        <AlertCircle size={16} className="mt-0.5 shrink-0 text-gray-400" />
        <div className="text-xs text-gray-600">
          <p className="font-semibold text-gray-900">Adresei neizdevās noteikt pasta indeksu</p>
          <p>Pamēģini precizēt — pievieno mājas numuru vai pilsētu (piem., <strong>Brīvības iela 100, Rīga</strong>).</p>
        </div>
      </div>
    );
  }

  if (result.reason === "outside_zones") {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
        <div className="flex items-start gap-3">
          <Package size={18} className="mt-0.5 shrink-0 text-gray-500" />
          <div className="text-sm text-gray-700">
            <p className="font-bold text-gray-900">
              LV-{result.code} — Pārējā Latvija
            </p>
            <p className="mt-1 text-xs text-gray-600">
              Šim indeksam automātisks kurjera un ekspresa tarifs <strong>nav pieejams</strong>. Vari izvēlēties piemērotu atvērtu pakomātu; vietējas saņemšanas vietām jābūt atļautām visiem ražotājiem.
            </p>
          </div>
        </div>


      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
      <MapPin size={16} className="mt-0.5 shrink-0 text-amber-600" />
      <div className="text-xs text-amber-800">
        <p className="font-semibold">
          LV-{result.code} — nav mūsu sarakstā
        </p>
        <p className="mt-0.5">
          Pārbaudi, vai indekss ievadīts pareizi. Ja jā un vēlies precizēt piegādes iespējas, sazinies ar{" "}
          <a href="mailto:birojs@izipizi.lv" className="underline font-semibold">birojs@izipizi.lv</a>.
        </p>
      </div>
    </div>
  );
}
