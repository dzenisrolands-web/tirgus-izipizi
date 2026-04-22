import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/nav";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "tirgus.izipizi.lv — Vietējie produkti pie tevis tuvāk",
  description:
    "Iegādājies svaigus produktus no Latvijas zemniekiem un saņem tos izipizi pakomates savā tuvumā.",
  keywords: ["tirgus", "svaiga pārtika", "zemnieki", "pakomāts", "izipizi", "vietējie produkti"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="lv" className={inter.variable}>
      <body>
        <Nav />
        <main>{children}</main>
        <footer className="mt-20 border-t border-gray-100 bg-gray-50">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
              <div>
                <p className="text-sm font-semibold text-brand-700">tirgus.izipizi.lv</p>
                <p className="mt-2 text-xs text-gray-500">
                  Latvijas zemnieku un ražotāju tirgus vieta.
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Pircējiem</p>
                <ul className="mt-3 space-y-2">
                  <li><a href="/catalog" className="text-sm text-gray-600 hover:text-brand-600">Skatīt produktus</a></li>
                  <li><a href="/lockers" className="text-sm text-gray-600 hover:text-brand-600">Pakomātu vietas</a></li>
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Pārdevējiem</p>
                <ul className="mt-3 space-y-2">
                  <li><a href="/sell" className="text-sm text-gray-600 hover:text-brand-600">Kļūt par pārdevēju</a></li>
                  <li><a href="/how-it-works" className="text-sm text-gray-600 hover:text-brand-600">Kā tas strādā</a></li>
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Izipizi</p>
                <ul className="mt-3 space-y-2">
                  <li><a href="https://izipizi.lv" target="_blank" rel="noopener" className="text-sm text-gray-600 hover:text-brand-600">izipizi.lv</a></li>
                  <li><a href="/contact" className="text-sm text-gray-600 hover:text-brand-600">Sazināties</a></li>
                </ul>
              </div>
            </div>
            <div className="mt-10 border-t border-gray-200 pt-6 text-center text-xs text-gray-400">
              © 2026 tirgus.izipizi.lv — Visas tiesības aizsargātas
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
