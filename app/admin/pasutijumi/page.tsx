import { ShoppingBag } from "lucide-react";

export default function AdminPasutijumiPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-extrabold text-gray-900">Pasūtījumi</h1>
      <p className="mt-0.5 text-sm text-gray-500">Visi platformas pasūtījumi</p>
      <div className="mt-10 rounded-2xl border-2 border-dashed border-gray-200 bg-white p-16 text-center">
        <ShoppingBag size={40} className="mx-auto text-gray-300" />
        <p className="mt-3 font-semibold text-gray-900">Pasūtījumu pārvaldība</p>
        <p className="mt-1 text-sm text-gray-400">Tiek izstrādāta — drīzumā</p>
      </div>
    </div>
  );
}
