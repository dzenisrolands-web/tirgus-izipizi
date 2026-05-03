import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "**.izipizi.lv" },
      { protocol: "https", hostname: "**.supabase.co" },
    ],
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
