import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://hakili.mandendigital.com";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard", "/admin", "/api", "/onboarding", "/widget", "/reinitialiser"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
