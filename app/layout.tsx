import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/nav";
import { IziPiziNetworkBar } from "@/components/izipizi-network-bar";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { PageTransition } from "@/components/page-transition";
import { CartProvider } from "@/lib/cart-context";
import { StorageTypesProvider } from "@/lib/storage-types-context";
import { BuyerAddressProvider } from "@/lib/buyer-address-context";
import { BuyerAddressPrompt } from "@/components/buyer-address-prompt";
import { CookieConsent } from "@/components/cookie-consent";
import { CookieSettingsLink } from "@/components/cookie-settings-link";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { PWAInstallTracker } from "@/components/pwa-install-tracker";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
});

const BASE_URL = "https://tirgus.izipizi.lv";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "tirgus.izipizi.lv — Pērc no vietējā, saņem ērti",
    template: "%s | tirgus.izipizi.lv",
  },
  description:
    "Pērc no vietējā un saņem ērti — pārtikas pakomātā vai ar piegādi uz mājām. Pelmeņi, gaļa, olas, dārzeņi no Latvijas ražotājiem.",
  keywords: ["tirgus", "svaiga pārtika", "ražotāji", "pakomāts", "izipizi", "vietējie produkti", "latvija", "ferma"],
  authors: [{ name: "tirgus.izipizi.lv" }],
  creator: "IziPizi",
  openGraph: {
    type: "website",
    locale: "lv_LV",
    url: BASE_URL,
    siteName: "tirgus.izipizi.lv",
    title: "tirgus.izipizi.lv — Pērc no vietējā, saņem ērti",
    description:
      "Pērc no vietējā un saņem ērti — pārtikas pakomātā vai ar piegādi uz mājām. Latvijas ražotāji vienuviet.",
    images: [
      {
        url: "/og-default.jpg",
        width: 1200,
        height: 630,
        alt: "tirgus.izipizi.lv — Svaiga pārtika no Latvijas ražotājiem",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "tirgus.izipizi.lv — Pērc no vietējā, saņem ērti",
    description: "Pērc no vietējā — pakomātā vai ar piegādi.",
    images: ["/og-default.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  alternates: {
    canonical: BASE_URL,
  },
  verification: {
    other: {
      "verify-paysera": "6567d173da1185168a8bf3c13a6d3456",
    },
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Tirgus",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
  },
};

export const viewport: Viewport = {
  themeColor: "#192635",
  width: "device-width",
  initialScale: 1,
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "OnlineStore",
  name: "tirgus.izipizi.lv",
  alternateName: "Tirgus IziPizi",
  url: BASE_URL,
  logo: `${BASE_URL}/og-default.jpg`,
  description:
    "Latvijas ražotāju tirgus vieta — svaiga pārtika no fermas līdz pakomātam.",
  inLanguage: "lv-LV",
  areaServed: { "@type": "Country", name: "Latvia" },
  parentOrganization: {
    "@type": "Organization",
    name: 'Sabiedrība ar ierobežotu atbildību "Svaigi"',
    legalName: 'Sabiedrība ar ierobežotu atbildību "Svaigi"',
    taxID: "LV40103915568",
    vatID: "LV40103915568",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Margrietas iela 7",
      addressLocality: "Rīga",
      postalCode: "LV-1046",
      addressCountry: "LV",
    },
    contactPoint: {
      "@type": "ContactPoint",
      telephone: "+371 20031552",
      email: "tirgus@izipizi.lv",
      contactType: "customer service",
      availableLanguage: ["Latvian", "English"],
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="lv" className={inter.variable}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="text/javascript"
          dangerouslySetInnerHTML={{
            __html: `(function() {
  const script = document.createElement('script');
  const dateToday = new Date();
  const todayFullDate = dateToday.getDate() + '-' + (dateToday.getMonth() + 1) + '-' + dateToday.getFullYear();
  script.src = 'https://bank.paysera.com/js/compiled/quality-sign.js?v=' + todayFullDate;
  script.setAttribute('data-paysera-project-id', 256875);
  script.setAttribute('data-lang', 'lv');
  script.async = true;
  document.head.appendChild(script);
})();`,
          }}
        />
      </head>
      <body spellCheck={false}>
        <ServiceWorkerRegister />
        <PWAInstallTracker />
        <Analytics />
        <SpeedInsights />
        <CartProvider>
          <BuyerAddressProvider>
            <StorageTypesProvider>
              <IziPiziNetworkBar />
              <Nav />
              <BuyerAddressPrompt />
              <main className="pb-16 md:pb-0">
                <PageTransition>{children}</PageTransition>
              </main>
              <MobileBottomNav />
            </StorageTypesProvider>
          </BuyerAddressProvider>
        </CartProvider>
        <CookieConsent />
        <footer className="mt-20 border-t border-gray-100 bg-gray-50">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
              <div>
                <p className="text-sm font-semibold text-brand-700">tirgus.izipizi.lv</p>
                <p className="mt-2 text-xs text-gray-500">
                  Latvijas ražotāju tirgus vieta — svaiga pārtika no fermas līdz pakomātam.
                </p>
                <p className="mt-4 text-[10px] leading-relaxed text-gray-400">
                  SIA &quot;Svaigi&quot; · Reģ. Nr. 40103915568 ·
                  PVN reģ. Nr. LV40103915568 · Margrietas iela 7, Rīga, LV-1046
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Tirgus</p>
                <ul className="mt-3 space-y-2">
                  <li><a href="/catalog" className="text-sm text-gray-600 hover:text-brand-600">Produkti</a></li>
                  <li><a href="/razotaji" className="text-sm text-gray-600 hover:text-brand-600">Ražotāji</a></li>
                  <li><a href="/receptes" className="text-sm text-gray-600 hover:text-brand-600">IziPizi RECEPTE</a></li>
                  {/* <li><a href="/keriens" className="text-sm font-medium text-orange-600 hover:text-orange-700">🔥 Sludinājumu dēlis</a></li> */}
                  <li><a href="/sell" className="text-sm text-gray-600 hover:text-brand-600">Sākt pārdot</a></li>
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Par mums</p>
                <ul className="mt-3 space-y-2">
                  <li><a href="/par-mums" className="text-sm text-gray-600 hover:text-brand-600">Par tirgus.izipizi.lv</a></li>
                  <li><a href="/how-it-works" className="text-sm text-gray-600 hover:text-brand-600">Kā tas strādā</a></li>
                  <li><a href="/piegade" className="text-sm text-gray-600 hover:text-brand-600">Piegāde un cenas</a></li>
                  <li><a href="/contact" className="text-sm text-gray-600 hover:text-brand-600">Kontakti</a></li>
                  <li><a href="https://izipizi.lv" target="_blank" rel="noopener" className="text-sm text-gray-600 hover:text-brand-600">izipizi.lv</a></li>
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Juridiski</p>
                <ul className="mt-3 space-y-2">
                  <li><a href="/noteikumi" className="text-sm text-gray-600 hover:text-brand-600">Lietošanas noteikumi</a></li>
                  <li><a href="/privatums" className="text-sm text-gray-600 hover:text-brand-600">Privātuma politika</a></li>
                  <li><a href="/atgriesana" className="text-sm text-gray-600 hover:text-brand-600">Atgriešanas politika</a></li>
                  <li><a href="/noteikumi/self-billing" className="text-sm text-gray-600 hover:text-brand-600">Self-billing kārtība</a></li>
                  <li><CookieSettingsLink /></li>
                </ul>
              </div>
            </div>
            <div className="mt-10 flex flex-col items-center gap-2 border-t border-gray-200 pt-6 text-center text-xs text-gray-400 sm:flex-row sm:justify-between">
              <span>© 2026 SIA &quot;Svaigi&quot; — Visas tiesības aizsargātas</span>
              <span className="flex items-center gap-3">
                <a href="mailto:tirgus@izipizi.lv" className="hover:text-brand-600">tirgus@izipizi.lv</a>
                <span className="text-gray-300">·</span>
                <a href="tel:+37120031552" className="hover:text-brand-600">+371 20031552</a>
              </span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
