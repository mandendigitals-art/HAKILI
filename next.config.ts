import type { NextConfig } from "next";

// Origines autorisées à embarquer l'application dans une iframe (aperçu, portail interne…).
// En production, définir FRAME_ANCESTORS="'self' https://hakili.mandendigital.com".
// Le widget public (/widget/*) est conçu pour être intégré sur les sites clients :
// il renvoie toujours frame-ancestors *.
const frameAncestors = process.env.FRAME_ANCESTORS ?? "*";

const baseSecurity = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "mammoth", "bcryptjs"],
  poweredByHeader: false,
  async headers() {
    return [
      // Widget public : intégrable sur n'importe quel site client.
      {
        source: "/widget/:path*",
        headers: [...baseSecurity, { key: "Content-Security-Policy", value: "frame-ancestors *;" }],
      },
      {
        source: "/embed.js",
        headers: [...baseSecurity, { key: "Cache-Control", value: "public, max-age=3600" }, { key: "Access-Control-Allow-Origin", value: "*" }],
      },
      // Reste de l'application : politique configurable via FRAME_ANCESTORS.
      // N'utilise pas X-Frame-Options (non compatible avec une liste d'hôtes ;
      // CSP frame-ancestors est honoré par tous les navigateurs modernes).
      {
        source: "/:path*",
        headers: [...baseSecurity, { key: "Content-Security-Policy", value: `frame-ancestors ${frameAncestors};` }],
      },
    ];
  },
};

export default nextConfig;
