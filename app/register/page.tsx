import Link from "next/link";
import { ShoppingBag, Tractor } from "lucide-react";

export const metadata = { title: "Reģistrēties — tirgus.izipizi.lv" };

export default function RegisterPage() {
  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <h1 className="text-2xl font-extrabold text-gray-900">Izveido kontu</h1>
          <p className="mt-1 text-sm text-gray-500">Izvēlies kā vēlies izmantot platformu</p>
        </div>

        {/* Role selection */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <label className="relative cursor-pointer rounded-xl border-2 border-gray-200 p-4 text-center transition hover:border-brand-400">
            <input type="radio" name="role" value="buyer" className="sr-only" defaultChecked />
            <ShoppingBag size={24} className="mx-auto text-brand-600" />
            <p className="mt-2 text-sm font-semibold text-gray-900">Pircējs</p>
            <p className="mt-0.5 text-xs text-gray-400">Pērku produktus</p>
          </label>
          <label className="relative cursor-pointer rounded-xl border-2 border-gray-200 p-4 text-center transition hover:border-brand-400">
            <input type="radio" name="role" value="seller" className="sr-only" />
            <Tractor size={24} className="mx-auto text-brand-600" />
            <p className="mt-2 text-sm font-semibold text-gray-900">Pārdevējs</p>
            <p className="mt-0.5 text-xs text-gray-400">Pārdodu produktus</p>
          </label>
        </div>

        <form className="mt-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Vārds, Uzvārds</label>
            <input type="text" className="input mt-1" placeholder="Jānis Bērziņš" autoComplete="name" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">E-pasts</label>
            <input type="email" className="input mt-1" placeholder="tavs@epasts.lv" autoComplete="email" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Parole</label>
            <input type="password" className="input mt-1" placeholder="Min. 8 rakstzīmes" autoComplete="new-password" />
          </div>
          <button type="submit" className="btn-primary w-full py-3">
            Reģistrēties
          </button>
          <p className="text-center text-xs text-gray-400">
            Reģistrējoties, tu piekrīti{" "}
            <Link href="/terms" className="underline">lietošanas noteikumiem</Link>
          </p>
        </form>

        <p className="mt-5 text-center text-sm text-gray-500">
          Jau ir konts?{" "}
          <Link href="/login" className="font-medium text-brand-600 hover:underline">
            Pieslēgties
          </Link>
        </p>
      </div>
    </div>
  );
}
