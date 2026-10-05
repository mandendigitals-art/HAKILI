import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://hakili.mandendigital.com";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: { default: "HAKILI — Vos documents savent répondre.", template: "%s · HAKILI" },
  description:
    "HAKILI, l'assistant documentaire intelligent des entreprises, institutions, écoles et ONG africaines. Toute votre connaissance, en une question. Une solution Manden Digital.",
  applicationName: "HAKILI",
  keywords: ["assistant documentaire", "IA", "RAG", "base de connaissances", "Mali", "Afrique francophone", "Manden Digital"],
  authors: [{ name: "Manden Digital SARL", url: "https://mandendigital.com" }],
  openGraph: { type: "website", locale: "fr_FR", siteName: "HAKILI", title: "HAKILI — Vos documents savent répondre.", description: "Toute votre connaissance, en une question." },
  robots: { index: true, follow: true },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = { themeColor: "#0b1b3a", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
