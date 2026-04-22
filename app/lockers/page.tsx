import { MapPin, Clock, Thermometer } from "lucide-react";
import { lockers, listings } from "@/lib/mock-data";

export const metadata = {
  title: "Pakomātu vietas — tirgus.izipizi.lv",
};

export default function LockersPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="text-center">
        <h1 className="text-3xl font-extrabold text-gray-900">Pakomātu vietas</h1>
        <p className="mt-3 text-gray-500">
          Latvijas pirmie termoregulatoru pakomāti svaigai pārtikai.
          Pieejami {lockers.length} vietās.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-2 text-sm text-brand-700">
          <Thermometer size={16} />
          Temperatūra: +2°C līdz +6°C · Saldēšana: −18°C
        </div>
      </div>

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {lockers.map((locker) => {
          const count = listings.filter((l) => l.lockerId === locker.id).length;
          return (
            <div
              key={locker.id}
              className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-600">
                  <MapPin size={18} />
                </div>
                <span className="flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
                  <Clock size={11} />
                  {locker.hours}
                </span>
              </div>
              <h2 className="mt-3 text-base font-bold text-gray-900">{locker.name}</h2>
              <p className="text-sm text-gray-500">{locker.city}</p>
              <p className="mt-1 text-xs text-gray-400">{locker.address}</p>
              <div className="mt-4 flex items-center justify-between border-t border-gray-50 pt-4">
                <span className="text-xs text-gray-500">
                  {count} aktīvs sludinājums{count === 1 ? "" : "i"}
                </span>
                <a
                  href={`/catalog?city=${encodeURIComponent(locker.city)}`}
                  className="text-xs font-medium text-brand-600 hover:underline"
                >
                  Skatīt produktus →
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
