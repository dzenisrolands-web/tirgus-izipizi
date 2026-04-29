import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard/", "/admin/", "/api/", "/auth/", "/update-password"],
      },
    ],
    sitemap: "https://tirgus.izipizi.lv/sitemap.xml",
    host: "https://tirgus.izipizi.lv",
  };
}
