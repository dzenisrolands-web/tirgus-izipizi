import { MapPin, Clock } from "lucide-react";
import { type Locker } from "@/lib/mock-data";

export function LockerCard({ locker }: { locker: Locker }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <MapPin size={16} />
          </span>
          <div>
            <p className="text-sm font-semibold text-gray-900">{locker.name}</p>
            <p className="text-xs text-gray-500">{locker.city}</p>
          </div>
        </div>
        <span className="flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
          <Clock size={11} />
          {locker.hours}
        </span>
      </div>
      <p className="mt-2 text-xs text-gray-400">{locker.address}</p>
    </div>
  );
}
