"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { XCircle, ArrowLeft, Loader2, ShieldCheck, Mail, Phone } from "lucide-react";

function CartCancelContent() {
  const params = useSearchParams();
  const orderNumber = params.get("order");

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-100">
          <XCircle size={40} className="text-amber-500" />
        </div>
        <h1 className="mt-5 text-2xl font-extrabold text-gray-900">Apmaksa atcelta</h1>
        <p className="mt-2 max-w-sm text-sm text-gray-500">
          Pasūtījums nav noformēts. Tavs grozs ir saglabāts — vari mēģināt vēlreiz.
        </p>
        {orderNumber && (
          <p className="mt-3 rounded-full bg-gray-100 px-3 py-1 text-xs font-mono text-gray-500">
            {orderNumber}
          </p>
        )}
      </div>

      <div className="mt-7 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-brand-600" />
          <div>
            <p className="text-sm font-semibold text-gray-900">Bez maksas</p>
            <p className="mt-0.5 text-xs text-gray-500">
              Atceltam darījumam nekādas izmaksas — pasūtījums vēl nav apstrādāts un produkts vēl nav rezervēts.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-2xl bg-gray-50 p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Vajag palīdzību?</p>
        <p className="mt-2 text-sm text-gray-600">
          Ja apmaksa neizdevās tehnisku iemeslu dēļ, sazinies ar mums — atrisināsim ātri.
        </p>
        <div className="mt-3 space-y-2">
          <a href="mailto:tirgus@izipizi.lv" className="flex items-center gap-2 text-sm text-brand-700 hover:underline">
            <Mail size={14} /> tirgus@izipizi.lv
          </a>
          <a href="tel:+37120031552" className="flex items-center gap-2 text-sm text-brand-700 hover:underline">
            <Phone size={14} /> +371 20031552
          </a>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
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
