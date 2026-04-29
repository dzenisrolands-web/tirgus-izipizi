"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { XCircle, ArrowLeft, Loader2 } from "lucide-react";

function CartCancelContent() {
  const params = useSearchParams();
  const orderNumber = params.get("order");

  return (
    <div className="mx-auto max-w-lg px-4 py-12 text-center">
      <div className="flex flex-col items-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-100">
          <XCircle size={40} className="text-amber-500" />
        </div>
        <h1 className="mt-5 text-2xl font-extrabold text-gray-900">Apmaksa atcelta</h1>
        <p className="mt-2 max-w-sm text-sm text-gray-500">
          Pasūtījums nav noformēts. Tavs grozs ir saglabāts, vari mēģināt vēlreiz.
        </p>
        {orderNumber && (
          <p className="mt-3 rounded-full bg-gray-100 px-3 py-1 text-xs font-mono text-gray-500">
            {orderNumber}
          </p>
        )}
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link href="/cart" className="btn-primary flex items-center justify-center gap-2 px-6 py-3">
          <ArrowLeft size={14} /> Atpakaļ uz grozu
        </Link>
        <Link href="/catalog" className="rounded-2xl border border-gray-200 px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">
          Iepirkties tālāk
        </Link>
      </div>
    </div>
  );
}

export default function CartCancelPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    }>
      <CartCancelContent />
    </Suspense>
  );
}
