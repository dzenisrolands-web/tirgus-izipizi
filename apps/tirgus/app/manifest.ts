import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "tirgus.izipizi.lv — Latvijas pārtikas tirgotāju mārketplace",
    short_name: "Tirgus",
    description:
      "Pērc no vietējā un saņem ērti — pārtikas pakomātā vai ar piegādi uz mājām. Latvijas ražotāji vienuviet.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#192635",
    theme_color: "#192635",
    lang: "lv",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    categories: ["food", "shopping", "lifestyle"],
  };
}
