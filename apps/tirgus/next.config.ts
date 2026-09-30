import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "**.izipizi.lv" },
      { protocol: "https", hostname: "**.supabase.co" },
    ],
  },
  async headers() {
    return [
      {
        // Set Referrer-Policy on cart page so browser sends full Referer to Paysera
        // This is required for Paysera 0x13 fix when using Edge PWA standalone mode
        source: "/cart",
        headers: [
          { key: "Referrer-Policy", value: "unsafe-url" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      // Apvienots /piegade aizvieto atsevišķās sadaļas
      { source: "/lockers", destination: "/piegade", permanent: true },
      { source: "/eksprespiegade", destination: "/piegade", permanent: true },
      // Vecās URL struktūras (vienskaitlis) atbalsts
      { source: "/razotajs/:id", destination: "/seller/:id", permanent: true },
    ];
  },
};

export default nextConfig;
