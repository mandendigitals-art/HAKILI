import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CTA, Section, SectionTitle, SiteShell } from "@/components/site-shell";
import { COMPANY } from "@/components/brand";
import { DEFAULT_PLANS, formatXof } from "@/lib/plans";

type Block = { h: string; p: string; items?: string[] };
type PageDef = { title: string; description: string; eyebrow: string; intro: string; blocks: Block[]; legal?: boolean };

const SECTORS: Block[] = [
  { h: "Entreprises et PME", p: "Procédures, contrats types, catalogues et politiques internes accessibles à toute l'équipe en une question." },
  { h: "Administrations", p: "Textes réglementaires, circulaires et guides de procédure pour informer agents et usagers sans erreur." },
  { h: "Écoles et centres de formation", p: "Règlements, programmes, supports de cours : un assistant pour les élèves, parents et enseignants." },
  { h: "Cabinets et bureaux d'études", p: "Retrouvez instantanément une clause, une norme ou une étude antérieure, avec la page citée." },
  { h: "ONG", p: "Manuels de procédures bailleurs, rapports de projets, guides terrain disponibles hors du siège." },
  { h: "Service client", p: "Un widget sur votre site répond aux questions fréquentes 24 h/24 à partir de votre documentation officielle." },
  { h: "Ressources humaines", p: "Congés, paie, avantages, convention collective : les collaborateurs obtiennent une réponse sourcée." },
  { h: "Documentation technique", p: "Manuels, fiches produits et notes de maintenance interrogeables par les techniciens sur mobile." },
];

const PAGES: Record<string, PageDef> = {
  fonctionnalites: {
    title: "Fonctionnalités",
    description: "Import de documents, RAG, citations, widget, gestion des utilisateurs et suivi de consommation.",
    eyebrow: "Fonctionnalités",
    intro: "Tout ce qu'il faut pour transformer vos documents en assistant fiable.",
    blocks: [
      { h: "Sources multiples", p: "Importez vos fichiers et connectez votre site.", items: ["PDF, DOCX, TXT (15 Mo max.)", "Pages web par URL", "Textes libres et questions-réponses", "Suivi du traitement : en attente, traitement, terminé, erreur"] },
      { h: "Moteur RAG", p: "Une vraie chaîne de récupération augmentée, pas une recherche par mots-clés.", items: ["Nettoyage et découpage intelligent", "Embeddings et stockage vectoriel PostgreSQL", "Recherche hybride sémantique + lexicale", "Refus explicite si la confiance est insuffisante"] },
      { h: "Assistants spécialisés", p: "Créez plusieurs assistants avec des périmètres et des consignes différents.", items: ["Choix des bases de connaissances", "Consignes de ton et de langue", "Seuil de confiance réglable", "Message d'accueil personnalisé"] },
      { h: "Citations vérifiables", p: "Chaque réponse est accompagnée des passages utilisés.", items: ["Numérotation [1], [2]…", "Aperçu du passage exact", "Nom du document ou de la page source"] },
      { h: "Widget et API", p: "Diffusez votre assistant au-delà de l'application.", items: ["Script d'intégration en une ligne", "Couleur, position, message d'accueil", "Restriction par domaine autorisé", "Clés API pour vos propres outils"] },
      { h: "Administration", p: "Gardez le contrôle.", items: ["Rôles administrateur / collaborateur", "Consommation mensuelle et limites", "Export complet et suppression des données", "Journal des actions"] },
    ],
  },
  solutions: { title: "Solutions par secteur", description: "HAKILI s'adapte aux PME, administrations, écoles, cabinets, ONG et services techniques.", eyebrow: "Solutions", intro: "Un assistant pour chaque métier, formé uniquement sur vos propres sources.", blocks: SECTORS },
  securite: {
    title: "Sécurité et confidentialité",
    description: "Isolation des organisations, chiffrement, contrôle d'accès, journalisation et suppression complète des données.",
    eyebrow: "Sécurité",
    intro: "Vos documents restent les vôtres. HAKILI est conçu pour les organisations qui manipulent des informations sensibles.",
    blocks: [
      { h: "Isolation stricte des organisations", p: "Chaque donnée (document, fragment, vecteur, conversation, assistant) porte l'identifiant de votre organisation et toutes les requêtes sont filtrées côté serveur. Aucune organisation ne peut consulter les données d'une autre." },
      { h: "Contrôle d'accès", p: "Rôles super administrateur, administrateur, collaborateur et visiteur. Sessions serveur en cookie sécurisé httpOnly, mots de passe hachés (bcrypt), limitation du nombre de tentatives." },
      { h: "Validation des fichiers", p: "Type, taille et signature binaire vérifiés. Les exécutables, scripts et fichiers déguisés sont refusés." },
      { h: "Protection de l'IA", p: "Filtrage des tentatives d'injection de prompt, contenu des documents traité comme donnée, refus quand la confiance est insuffisante. Les clés des fournisseurs IA ne quittent jamais le serveur." },
      { h: "Chiffrement en transit", p: "Toutes les communications sont chiffrées en HTTPS avec en-tête HSTS. Les sauvegardes automatiques quotidiennes et l'hébergement sur serveur dédié sont proposés en option pour les offres Entreprise (à activer selon le contrat)." },
      { h: "Vos droits", p: "Export complet de vos données en un clic (format JSON), suppression définitive de l'espace par l'administrateur, durée de conservation des conversations configurable." },
    ],
  },

  "mentions-legales": {
    title: "Mentions légales", description: "Mentions légales de l'application HAKILI éditée par Manden Digital SARL.", eyebrow: "Légal", intro: "", legal: true,
    blocks: [
      { h: "Éditeur", p: `HAKILI est édité par ${COMPANY.name}, société à responsabilité limitée de droit malien, dont le siège est situé à ${COMPANY.city}. Contact : ${COMPANY.email} — ${COMPANY.phone}.` },
      { h: "Hébergement", p: "L'application est hébergée sur des infrastructures cloud sécurisées. Les coordonnées de l'hébergeur sont communiquées sur demande." },
      { h: "Propriété intellectuelle", p: "HAKILI est un signe distinctif exploité par Manden Digital SARL. Le logo et l'interface sont la propriété de Manden Digital SARL. Certains composants logiciels sont issus de projets open source sous licence MIT, dont la notice est conservée dans le fichier LICENSE distribué avec le code." },
      { h: "Responsabilité", p: "Les réponses générées par HAKILI sont produites à partir des documents fournis par chaque organisation. Manden Digital ne saurait être tenue responsable du contenu de ces documents ni des décisions prises sur la base des réponses." },
    ],
  },
  confidentialite: {
    title: "Politique de confidentialité", description: "Comment HAKILI collecte, utilise et protège vos données.", eyebrow: "Légal", intro: "", legal: true,
    blocks: [
      { h: "Données collectées", p: "Données de compte (nom, e-mail, mot de passe haché), données d'organisation, documents et textes importés, conversations, journaux techniques (adresse IP, navigateur) et données de facturation." },
      { h: "Finalités", p: "Fournir le service (indexation, génération de réponses), sécuriser la plateforme, mesurer la consommation, assurer le support et la facturation." },
      { h: "Sous-traitants", p: "Selon la configuration choisie par l'organisation, des extraits de documents peuvent être transmis à un fournisseur de modèles d'IA (OpenAI, Google ou fournisseur tiers) uniquement pour générer les réponses. Ces fournisseurs n'utilisent pas ces données pour entraîner leurs modèles selon leurs conditions professionnelles." },
      { h: "Conservation", p: "Les conversations sont conservées pendant la durée configurée par l'administrateur (365 jours par défaut). Les documents sont conservés tant que l'organisation les garde. La suppression de l'espace efface l'ensemble des données." },
      { h: "Vos droits", p: `Accès, rectification, export et suppression : depuis les paramètres de l'application ou en écrivant à ${COMPANY.email}. Conformité à la loi malienne n° 2013-015 relative à la protection des données à caractère personnel.` },
    ],
  },
  cgu: {
    title: "Conditions d'utilisation", description: "Conditions générales d'utilisation de HAKILI.", eyebrow: "Légal", intro: "", legal: true,
    blocks: [
      { h: "Objet", p: "Les présentes conditions régissent l'accès et l'utilisation de la plateforme HAKILI par les organisations clientes et leurs utilisateurs." },
      { h: "Compte et sécurité", p: "L'organisation est responsable des accès qu'elle accorde à ses utilisateurs et de la confidentialité des mots de passe. Toute activité suspecte doit être signalée au support." },
      { h: "Contenus", p: "L'organisation garantit détenir les droits nécessaires sur les documents importés. Sont interdits les contenus illicites, malveillants ou portant atteinte aux droits de tiers." },
      { h: "Abonnement et paiement", p: "Les offres Essentiel, Professionnel et Entreprise sont facturées mensuellement en FCFA, payables par Orange Money, Moov Money ou virement bancaire. L'activation intervient après confirmation du paiement par Manden Digital. Un abonnement impayé peut être suspendu puis réactivé après régularisation." },
      { h: "Limites du service", p: "HAKILI fournit des réponses générées automatiquement à partir des sources de l'organisation. Elles ne constituent pas un conseil juridique, médical ou financier et doivent être vérifiées pour toute décision importante." },
      { h: "Résiliation", p: "L'organisation peut exporter puis supprimer ses données à tout moment. Manden Digital peut suspendre un compte en cas de violation des présentes conditions." },
    ],
  },
};

export function generateStaticParams() {
  return [...Object.keys(PAGES), "tarifs"].map((page) => ({ page }));
}

export async function generateMetadata({ params }: { params: Promise<{ page: string }> }): Promise<Metadata> {
  const { page } = await params;
  if (page === "tarifs") return { title: "Tarifs", description: "Offres Essentiel, Professionnel et Entreprise en FCFA. Paiement Orange Money, Moov Money ou virement." };
  const def = PAGES[page];
  return def ? { title: def.title, description: def.description } : {};
}

export default async function PublicPage({ params }: { params: Promise<{ page: string }> }) {
  const { page } = await params;
  if (page === "tarifs") return <PricingPage />;
  const def = PAGES[page];
  if (!def) notFound();
  return (
    <SiteShell>
      <Section>
        <SectionTitle eyebrow={def.eyebrow} title={def.title} text={def.intro || undefined} />
        <div className={def.legal ? "mx-auto max-w-3xl space-y-8" : "grid gap-6 md:grid-cols-2"}>
          {def.blocks.map((b) => (
            <div key={b.h} className={def.legal ? "" : "card p-6"}>
              <h3 className="text-lg font-semibold text-nuit-900">{b.h}</h3>
              <p className="mt-2 text-slate-600 leading-relaxed">{b.p}</p>
              {b.items && (
                <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
                  {b.items.map((i) => (
                    <li key={i} className="flex gap-2"><span className="text-orange-500">✓</span>{i}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
        {def.legal && <p className="mx-auto mt-10 max-w-3xl text-xs text-slate-400">Dernière mise à jour : {new Date().toLocaleDateString("fr-FR", { year: "numeric", month: "long" })}.</p>}
      </Section>
      {!def.legal && <CTA />}
    </SiteShell>
  );
}

function PricingPage() {
  return (
    <SiteShell>
      <Section>
        <SectionTitle eyebrow="Tarifs" title="Des offres claires, en FCFA" text="Essai gratuit de 14 jours sur l'offre Essentiel. Paiement par Orange Money, Moov Money ou virement bancaire." />
        <div className="grid gap-6 md:grid-cols-3">
          {DEFAULT_PLANS.map((p, i) => (
            <div key={p.code} className={`card relative p-6 ${i === 1 ? "border-tech-600 ring-2 ring-tech-100" : ""}`}>
              {i === 1 && <span className="absolute -top-3 left-6 badge bg-orange-500 text-white">Le plus choisi</span>}
              <h3 className="text-xl font-bold text-nuit-900">{p.name}</h3>
              <p className="mt-1 text-sm text-slate-500">{p.description}</p>
              <p className="mt-4 text-3xl font-black text-nuit-900">{formatXof(p.priceMonthlyXof)}<span className="text-sm font-medium text-slate-500"> / mois</span></p>
              <ul className="mt-5 space-y-2 text-sm text-slate-700">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2"><span className="text-orange-500">✓</span>{f}</li>
                ))}
              </ul>
              <Link href="/inscription" className={`${i === 1 ? "btn-primary" : "btn-secondary"} mt-6 w-full`}>Créer mon assistant</Link>
            </div>
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-slate-500">Besoin d&apos;un hébergement dédié, de volumes supérieurs ou d&apos;un contrat annuel ? <Link href="/contact" className="text-tech-600 underline">Contactez-nous</Link>.</p>
      </Section>
      <CTA />
    </SiteShell>
  );
}
