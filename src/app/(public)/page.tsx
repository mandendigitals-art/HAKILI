import Link from "next/link";
import { CTA, Section, SectionTitle, SiteShell } from "@/components/site-shell";
import { HakiliSymbol } from "@/components/brand";

const STEPS = [
  { n: "1", t: "Créez votre espace sécurisé", d: "Votre organisation, vos utilisateurs, vos règles. Chaque entreprise est strictement isolée." },
  { n: "2", t: "Importez vos sources", d: "PDF, Word, textes, questions-réponses et pages de votre site web. Le traitement est automatique." },
  { n: "3", t: "Posez vos questions", d: "Vos équipes et vos clients obtiennent des réponses fondées uniquement sur vos documents, avec les passages cités." },
];

const FEATURES = [
  { icon: "📄", t: "Import multi-formats", d: "PDF, DOCX, TXT, URL de site web, textes libres et questions-réponses." },
  { icon: "🧠", t: "Réponses fondées sur vos sources", d: "Architecture RAG avec recherche sémantique : pas d'invention, et un refus clair quand l'information manque." },
  { icon: "🔗", t: "Citations cliquables", d: "Chaque réponse indique le document et le passage exact utilisés." },
  { icon: "💬", t: "Widget pour votre site", d: "Intégrez votre assistant en une ligne de code et servez vos visiteurs 24 h/24." },
  { icon: "👥", t: "Rôles et utilisateurs", d: "Administrateurs, collaborateurs, visiteurs : chacun voit uniquement ce qui lui est autorisé." },
  { icon: "📊", t: "Suivi de consommation", d: "Documents, questions et jetons consommés, limites par offre, historique mensuel." },
];

const SECTORS = ["Entreprises et PME", "Administrations", "Écoles et centres de formation", "Cabinets et bureaux d'études", "ONG", "Service client", "Ressources humaines", "Documentation technique"];

export default function HomePage() {
  return (
    <SiteShell>
      {/* Hero */}
      <section className="relative overflow-hidden bg-nuit-900 text-white">
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-tech-600/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-20 h-96 w-96 rounded-full bg-orange-500/20 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:py-28">
          <div className="animate-fade-in">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-slate-200">
              <span className="h-2 w-2 rounded-full bg-orange-500" /> Assistant documentaire intelligent · Mali & Afrique francophone
            </p>
            <h1 className="text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Vos documents <span className="text-orange-500">savent répondre.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-slate-300">
              HAKILI transforme vos PDF, procédures, rapports et pages web en un assistant qui répond en langage naturel, cite ses sources et ne
              répond jamais au hasard. Toute votre connaissance, en une question.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/inscription" className="btn-accent px-6 py-3 text-base">Créer mon assistant</Link>
              <Link href="/demo" className="btn bg-white/10 text-white hover:bg-white/20 px-6 py-3 text-base">Demander une démonstration</Link>
            </div>
            <p className="mt-4 text-xs text-slate-400">Essai gratuit 14 jours · Sans carte bancaire · Données hébergées de façon isolée</p>
          </div>
          <div className="animate-fade-in card border-white/10 bg-white/5 p-4 text-sm text-slate-100 shadow-2xl backdrop-blur">
            <div className="mb-3 flex items-center gap-2 border-b border-white/10 pb-3">
              <HakiliSymbol size={28} />
              <span className="font-semibold">Assistant RH — Manden Industries</span>
              <span className="ml-auto badge bg-emerald-500/20 text-emerald-300">En ligne</span>
            </div>
            <div className="space-y-3">
              <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-tech-600 px-4 py-2.5">Combien de jours de congé annuel a droit un employé après 3 ans ?</div>
              <div className="max-w-[92%] rounded-2xl rounded-bl-sm bg-white/10 px-4 py-3">
                <p>
                  Après trois années de service, un employé bénéficie de <strong>24 jours ouvrables</strong> de congé annuel, majorés de 2 jours par tranche de 5 ans
                  d&apos;ancienneté [1].
                </p>
                <div className="mt-3 rounded-lg border border-white/10 bg-nuit-950/60 p-2 text-xs">
                  <p className="font-semibold text-orange-400">[1] Règlement intérieur 2024.pdf — page 12</p>
                  <p className="mt-1 text-slate-300">« Le congé annuel est fixé à 24 jours ouvrables pour tout salarié justifiant de… »</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Étapes */}
      <Section>
        <SectionTitle eyebrow="Comment ça marche" title="Trois étapes, aucune compétence technique" />
        <div className="grid gap-6 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="card p-6">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 font-bold text-orange-600">{s.n}</div>
              <h3 className="text-lg font-semibold text-nuit-900">{s.t}</h3>
              <p className="mt-2 text-slate-600">{s.d}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Fonctionnalités */}
      <Section className="bg-slate-50 !max-w-none">
        <div className="mx-auto max-w-7xl">
          <SectionTitle eyebrow="Fonctionnalités" title="Conçu pour les organisations africaines" text="Simple, rapide même sur connexion lente, et pensé d'abord pour le mobile." />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.t} className="card p-6">
                <div className="text-2xl">{f.icon}</div>
                <h3 className="mt-3 font-semibold text-nuit-900">{f.t}</h3>
                <p className="mt-1.5 text-sm text-slate-600">{f.d}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link href="/fonctionnalites" className="btn-secondary">Voir toutes les fonctionnalités</Link>
          </div>
        </div>
      </Section>

      {/* Secteurs */}
      <Section>
        <SectionTitle eyebrow="Solutions" title="Un assistant pour chaque métier" />
        <div className="flex flex-wrap justify-center gap-3">
          {SECTORS.map((s) => (
            <Link key={s} href="/solutions" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-tech-500 hover:text-tech-600">
              {s}
            </Link>
          ))}
        </div>
      </Section>

      {/* Confiance */}
      <Section className="bg-nuit-900 !max-w-none text-white">
        <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-4">
          {[
            ["Isolation stricte", "Chaque organisation dispose de son propre périmètre de données."],
            ["Pas d'invention", "Quand vos sources ne suffisent pas, HAKILI le dit clairement."],
            ["Contrôle des accès", "Rôles, journal d'audit, limitation des requêtes, validation des fichiers."],
            ["Paiement local", "Orange Money, Moov Money ou virement bancaire. Facturation en FCFA."],
          ].map(([t, d]) => (
            <div key={t}>
              <h3 className="font-semibold text-orange-400">{t}</h3>
              <p className="mt-2 text-sm text-slate-300">{d}</p>
            </div>
          ))}
        </div>
      </Section>

      <CTA />
    </SiteShell>
  );
}
