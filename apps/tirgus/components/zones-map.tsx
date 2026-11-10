import { postalCodesByZone, ZONE_PRICING } from "@/lib/postal-zones";
import { formatPrice } from "@/lib/utils";

/**
 * The previous illustrative map invented postcode coordinates and regional-city
 * coverage. Until authoritative boundary/geocoding data exists, show the actual
 * published postcode coverage instead of drawing misleading service areas.
 */
export function ZonesMap() {
  return (
    <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5">
      <h3 className="font-bold text-gray-900">Piegādes zonas pēc pasta indeksa</h3>
      <p className="text-xs text-gray-500">
        Cenas ar PVN par ražotāju un vienu adresi. Viena / divas temperatūras zonas.
        Galīgā kurjera zona ir lielākā no zināmās ražotāja nodošanas zonas un saņēmēja zonas.
        Pakomāts — 3,00 € par ražotāju neatkarīgi no temperatūras zonu skaita.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {([0, 1, 2, 3] as const).map(zone => {
          const pricing = ZONE_PRICING[zone];
          return (
            <div key={zone} className="rounded-xl border border-gray-100 p-4">
              <h4 className="font-semibold">Zona {zone}</h4>
              <p className="mt-2 text-sm">
                Kurjers: {formatPrice(pricing.singleTemp)} / {formatPrice(pricing.dualTemp)}
              </p>
              <p className="text-sm">
                Ekspres: {pricing.expressSingle === null || pricing.expressDual === null
                  ? "nav pieejams"
                  : `${formatPrice(pricing.expressSingle)} / ${formatPrice(pricing.expressDual)}`}
              </p>
              <p className="mt-2 text-xs text-gray-500">
                {postalCodesByZone(zone).map(code => `LV-${code}`).join(", ")}
              </p>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-gray-500">
        Ārpus norādītajiem indeksiem kurjers un ekspres nav pieejami.
        Avots: <a href="https://izipizi.lv/zonas-cenas" className="underline">izipizi.lv/zonas-cenas</a>,
        pārbaudīts 10.11.2026.
      </p>
    </section>
  );
}
