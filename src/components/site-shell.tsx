import Link from "next/link";
import type { ReactNode } from "react";
import { COMPANY, Logo, MandenMention } from "./brand";
import { MobileMenu } from "./mobile-menu";

const NAV = [
  { href: "/fonctionnalites", label: "Fonctionnalités" },
  { href: "/solutions", label: "Solutions" },
  { href: "/tarifs", label: "Tarifs" },
  { href: "/securite", label: "Sécurité" },
  { href: "/demo", label: "Démonstration" },
  { href: "/contact", label: "Contact" },
];

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/90 backdrop-blur">
        <div className="relative mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Logo />
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600" aria-label="Navigation principale">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="hover:text-nuit-900">
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/connexion" className="btn-ghost hidden md:inline-flex">
              Connexion
            </Link>
            <Link href="/inscription" className="btn-primary hidden sm:inline-flex">
              Créer mon assistant
            </Link>
            <MobileMenu items={NAV} />
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="bg-nuit-950 text-slate-300">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
          <div className="md:col-span-1 space-y-4">
            <Logo light />
            <p className="text-sm text-slate-400">Vos documents savent répondre.</p>
            <MandenMention light />
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold text-white">Produit</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/fonctionnalites" className="hover:text-white">Fonctionnalités</Link></li>
              <li><Link href="/solutions" className="hover:text-white">Solutions par secteur</Link></li>
              <li><Link href="/tarifs" className="hover:text-white">Tarifs</Link></li>
              <li><Link href="/demo" className="hover:text-white">Demander une démonstration</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold text-white">Confiance</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/securite" className="hover:text-white">Sécurité et confidentialité</Link></li>
              <li><Link href="/confidentialite" className="hover:text-white">Politique de confidentialité</Link></li>
              <li><Link href="/cgu" className="hover:text-white">Conditions d&apos;utilisation</Link></li>
              <li><Link href="/mentions-legales" className="hover:text-white">Mentions légales</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold text-white">Contact</h4>
            <ul className="space-y-2 text-sm">
              <li>{COMPANY.name}</li>
              <li>{COMPANY.city}</li>
              <li><a href={`mailto:${COMPANY.email}`} className="hover:text-white">{COMPANY.email}</a></li>
              <li><a href={`tel:${COMPANY.phone.replace(/\s/g, "")}`} className="hover:text-white">{COMPANY.phone}</a></li>
              <li><a href={COMPANY.site} target="_blank" rel="noopener noreferrer" className="hover:text-white">mandendigital.com</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10 py-4 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} {COMPANY.name}. Tous droits réservés. Composants open source sous licence MIT (voir LICENSE).
        </div>
      </footer>
    </div>
  );
}

export function Section({ children, className = "", id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 ${className}`}>
      {children}
    </section>
  );
}

export function SectionTitle({ eyebrow, title, text }: { eyebrow?: string; title: string; text?: string }) {
  return (
    <div className="mx-auto mb-10 max-w-2xl text-center">
      {eyebrow && <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-orange-500">{eyebrow}</p>}
      <h2 className="text-3xl font-bold tracking-tight text-nuit-900 sm:text-4xl">{title}</h2>
      {text && <p className="mt-4 text-lg text-slate-600">{text}</p>}
    </div>
  );
}

export function CTA() {
  return (
    <Section>
      <div className="rounded-2xl bg-gradient-to-br from-nuit-900 to-tech-700 px-6 py-12 text-center text-white sm:px-12">
        <h2 className="text-3xl font-bold">Toute votre connaissance, en une question.</h2>
        <p className="mx-auto mt-3 max-w-xl text-slate-200">Créez votre espace sécurisé en deux minutes. Essai gratuit, sans carte bancaire.</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/inscription" className="btn-accent px-6 py-3 text-base">Créer mon assistant</Link>
          <Link href="/demo" className="btn bg-white/10 text-white hover:bg-white/20 px-6 py-3 text-base">Demander une démonstration</Link>
        </div>
      </div>
    </Section>
  );
}
