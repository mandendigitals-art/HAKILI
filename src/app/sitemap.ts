import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://hakili.mandendigital.com";
  const routes = [
    "",
    "/fonctionnalites",
    "/solutions",
    "/tarifs",
    "/securite",
    "/demo",
    "/contact",
    "/connexion",
    "/inscription",
    "/mentions-legales",
    "/confidentialite",
    "/cgu",
  ];
  const now = new Date();
  return routes.map((r) => ({
    url: `${base}${r}`,
    lastModified: now,
    changeFrequency: r === "" ? "weekly" : "monthly",
    priority: r === "" ? 1 : r === "/tarifs" || r === "/demo" ? 0.8 : 0.6,
  }));
}
