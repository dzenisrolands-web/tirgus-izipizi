import Link from "next/link";
import { ShoppingBag } from "lucide-react";

export const metadata = { title: "Pieslēgties — tirgus.izipizi.lv" };

export default function LoginPage() {
  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-600">
            <ShoppingBag size={24} />
          </span>
          <h1 className="mt-4 text-2xl font-extrabold text-gray-900">Laipni lūgti!</h1>
          <p className="mt-1 text-sm text-gray-500">Pieslēdzies savam kontam</p>
        </div>

        <form className="mt-8 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">E-pasts</label>
            <input
              type="email"
              className="input mt-1"
              placeholder="tavs@epasts.lv"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Parole</label>
            <input
              type="password"
              className="input mt-1"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>
          <button type="submit" className="btn-primary w-full py-3">
            Pieslēgties
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Nav konta?{" "}
          <Link href="/register" className="font-medium text-brand-600 hover:underline">
            Reģistrēties
          </Link>
        </p>
      </div>
    </div>
  );
}
