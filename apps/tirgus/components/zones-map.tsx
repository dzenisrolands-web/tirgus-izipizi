import { ZONE_PRICING, postalCodesByZone, DELIVERY_PRICE_SOURCE } from "@/lib/postal-zones";
import { BUYER_LOCKER_FEE_CENTS } from "@/lib/delivery-policy";
import { openLockers } from "@/lib/locker-policy";
import { formatPrice } from "@/lib/utils";

/** Postcode coverage, not hand-drawn polygons or unverified driving distances. */
export function ZonesMap() {
  return (
    <div className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div>
        <h3 className="font-bold text-gray-900">Publicētie pasta indeksi un termorežīma tarifi</h3>
        <p className="mt-1 text-xs leading-relaxed text-gray-500">
          Piegādes cenu nosaka saņēmēja publicētais pasta indekss un sūtījuma temperatūras.
          Tabulā — cena par vienu ražotāju ar esošo 21% pakalpojuma PVN.
          Viena temperatūra: +2…+6°C vai −18°C; divas: abi režīmi.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <caption className="sr-only">Kurjera un ekspresa cena ar PVN par ražotāju</caption>
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="p-2">Zona</th>
              <th className="p-2">Kurjers, 1 temp.</th>
              <th className="p-2">Kurjers, 2 temp.</th>
              <th className="p-2">Ekspres, 1 temp.</th>
              <th className="p-2">Ekspres, 2 temp.</th>
            </tr>
          </thead>
          <tbody>
            {([0, 1, 2, 3] as const).map(zone => {
              const rate = ZONE_PRICING[zone];
              return <tr key={zone} data-zone={zone} className="border-b border-gray-100">
                <th className="p-2">Zona {zone}</th>
                <td className="p-2">{formatPrice(rate.singleTemp)}</td>
                <td className="p-2">{formatPrice(rate.dualTemp)}</td>
                <td className="p-2">{rate.expressSingle === null ? "Nav publicēts" : formatPrice(rate.expressSingle)}</td>
                <td className="p-2">{rate.expressDual === null ? "Nav publicēts" : formatPrice(rate.expressDual)}</td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {([0, 1, 2, 3] as const).map(zone => (
          <details key={zone} className="rounded-xl bg-gray-50 p-3 text-xs">
            <summary className="cursor-pointer font-semibold text-gray-800">Zona {zone}: {postalCodesByZone(zone).length} pasta indeksi</summary>
            <p className="mt-2 font-mono leading-relaxed text-gray-600">{postalCodesByZone(zone).map(code => `LV-${code}`).join(", ")}</p>
          </details>
        ))}
      </div>
      <p className="text-xs leading-relaxed text-gray-500">
        Ārpus saraksta automātisks kurjera vai ekspresa tarifs nav pieejams. Galīgais piedāvājums grozā
        atkarīgs no visu produktu atļautajiem piegādes veidiem un ražotāju skaita.
        Tarifa aprēķins nav pārvadātāja maršruta vai izpildes apstiprinājums.{" "}
        <a href={DELIVERY_PRICE_SOURCE} target="_blank" rel="noopener noreferrer" className="underline">Publicēto NET tarifu avots</a>.
      </p>
      <div className="border-t border-gray-100 pt-4">
        <h4 className="text-sm font-bold text-gray-900">Atvērtas pārtikas pakomātu vietas</h4>
        <p className="mt-1 text-xs text-gray-600">
          {formatPrice(BUYER_LOCKER_FEE_CENTS / 100)} vienreiz par ražotāju un saņemšanas vietu,
          arī divām temperatūrām. Tas ir tirgus pircēja tarifs, nevis izmēru vai starppakomātu cenu tabula.
        </p>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {openLockers.map(locker => (
            <li key={locker.id} className="rounded-xl bg-gray-50 p-3 text-xs">
              <p className="font-semibold text-gray-900">{locker.name}</p>
              <p className="mt-1 text-gray-500">{locker.address} · {locker.city}</p>
              <p className="mt-1 text-gray-600">{locker.hours}</p>
              {locker.pickup_only && <p className="mt-1 text-amber-800">Tikai vietēja saņemšana — visiem pasūtījuma ražotājiem šai vietai jābūt norādītai nodošanai.</p>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
