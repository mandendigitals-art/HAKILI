/**
 * Données de démonstration HAKILI (non sensibles) + super administrateur.
 * Usage : npm run seed
 * Variables : SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD, SUPERADMIN_NAME (sinon valeurs de démo)
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, pool } from "../src/db";
import { assistantKnowledgeBases, assistants, knowledgeBases, organizationMembers, organizations, plans, sources, subscriptions, users, widgetConfigurations } from "../src/db/schema";
import { ensureDefaultPlans } from "../src/lib/plans";
import { ingestDocument } from "../src/lib/rag/engine";

const DEMO_DOCS = [
  {
    title: "Règlement intérieur — Congés et absences",
    content: `Article 12 — Congé annuel.
Tout salarié justifiant d'au moins douze mois de service effectif bénéficie d'un congé annuel payé de 22 jours ouvrables. Après trois années de service, le congé annuel est porté à 24 jours ouvrables. Il est majoré de 2 jours ouvrables par tranche de cinq années d'ancienneté supplémentaire.

Article 13 — Demande de congé.
La demande de congé est déposée auprès du responsable hiérarchique au moins 15 jours avant la date de départ souhaitée, via le formulaire RH-04. La direction des ressources humaines confirme la validation par courriel dans un délai de 5 jours ouvrables.

Article 14 — Absences pour événements familiaux.
Le salarié bénéficie d'autorisations d'absence rémunérées : mariage du salarié 3 jours, naissance d'un enfant 3 jours, décès d'un conjoint ou d'un enfant 5 jours, décès d'un parent 3 jours.

Article 15 — Congé maladie.
Toute absence pour maladie doit être justifiée par un certificat médical transmis dans les 48 heures. Les indemnités sont versées conformément à la convention collective en vigueur.`,
  },
  {
    title: "Procédure d'achat et de remboursement des frais",
    content: `1. Objet. La présente procédure définit les règles d'engagement des dépenses et de remboursement des frais professionnels.

2. Seuils d'approbation. Toute dépense inférieure à 100 000 FCFA est approuvée par le chef de service. Entre 100 000 et 1 000 000 FCFA, l'approbation du directeur administratif et financier est requise. Au-delà de 1 000 000 FCFA, une mise en concurrence d'au moins trois fournisseurs et la signature du directeur général sont obligatoires.

3. Frais de mission. Le per diem pour une mission à l'intérieur du Mali est fixé à 25 000 FCFA par jour, hébergement compris. Pour les missions en Afrique de l'Ouest, il est de 60 000 FCFA par jour. Les frais de transport sont remboursés sur présentation des justificatifs originaux.

4. Délai de remboursement. Les notes de frais complètes sont remboursées dans un délai maximum de 10 jours ouvrables après validation. Les demandes déposées plus de 60 jours après la dépense ne sont pas recevables.

5. Moyens de paiement. Les remboursements sont effectués par virement bancaire ou Orange Money selon le choix indiqué par l'agent dans son dossier.`,
  },
  {
    title: "FAQ service client — Horaires et support",
    content: `Question : Quels sont les horaires d'ouverture ?
Réponse : Nos bureaux de Bamako (Hamdallaye ACI 2000) sont ouverts du lundi au vendredi de 8 h à 17 h et le samedi de 9 h à 13 h.

Question : Comment contacter le support ?
Réponse : Par téléphone au +223 77 47 47 97, par courriel à support@mandendigital.com ou via WhatsApp aux heures d'ouverture. Le délai de première réponse est de 4 heures ouvrées.

Question : Proposez-vous une formation à l'utilisation ?
Réponse : Oui. Chaque nouveau client bénéficie d'une session de prise en main de deux heures, en présentiel à Bamako ou en visioconférence, incluse dans l'abonnement.

Question : Quels moyens de paiement acceptez-vous ?
Réponse : Orange Money, Moov Money et virement bancaire. Les factures sont émises en FCFA.`,
  },
];

async function main() {
  console.log("→ Offres par défaut");
  await ensureDefaultPlans();

  const adminEmail = (process.env.SUPERADMIN_EMAIL ?? "admin@mandendigital.com").toLowerCase();
  const adminPassword = process.env.SUPERADMIN_PASSWORD ?? "Hakili-Admin-2025!";
  const adminName = process.env.SUPERADMIN_NAME ?? "Administrateur Manden Digital";
  let [admin] = await db.select().from(users).where(eq(users.email, adminEmail));
  if (!admin) {
    [admin] = await db.insert(users).values({ email: adminEmail, name: adminName, passwordHash: await bcrypt.hash(adminPassword, 12), isSuperAdmin: true }).returning();
    console.log(`→ Super administrateur créé : ${adminEmail}`);
  } else {
    await db.update(users).set({ isSuperAdmin: true }).where(eq(users.id, admin.id));
    console.log(`→ Super administrateur existant : ${adminEmail}`);
  }

  if (process.env.SEED_DEMO === "false") return;

  const [existingDemo] = await db.select().from(organizations).where(eq(organizations.slug, "demo-manden-industries"));
  if (existingDemo) {
    console.log("→ Organisation de démonstration déjà présente, rien à faire.");
    return;
  }
  console.log("→ Organisation de démonstration");
  const [demoUser] = await db.insert(users).values({ email: "demo@hakili.local", name: "Aminata Traoré", passwordHash: await bcrypt.hash("Demo-Hakili-2025!", 12) }).returning();
  const [collab] = await db.insert(users).values({ email: "collaborateur@hakili.local", name: "Moussa Diallo", passwordHash: await bcrypt.hash("Demo-Hakili-2025!", 12) }).returning();
  const [org] = await db.insert(organizations).values({ name: "Manden Industries (démo)", slug: "demo-manden-industries", sector: "Entreprise / PME", city: "Bamako" }).returning();
  await db.insert(organizationMembers).values([
    { organizationId: org.id, userId: demoUser.id, role: "admin" },
    { organizationId: org.id, userId: collab.id, role: "member" },
  ]);
  const [pro] = await db.select().from(plans).where(eq(plans.code, "professionnel"));
  const endsAt = new Date(); endsAt.setMonth(endsAt.getMonth() + 12);
  await db.insert(subscriptions).values({ organizationId: org.id, planId: pro.id, status: "active", endsAt, notes: "Abonnement de démonstration" });

  const [kb] = await db.insert(knowledgeBases).values({ organizationId: org.id, name: "Documentation interne", description: "RH, finances et service client", createdBy: demoUser.id }).returning();
  for (const d of DEMO_DOCS) {
    const [src] = await db.insert(sources).values({ organizationId: org.id, knowledgeBaseId: kb.id, type: "text", name: d.title, status: "processing", sizeBytes: d.content.length, createdBy: demoUser.id }).returning();
    const r = await ingestDocument({ organizationId: org.id, knowledgeBaseId: kb.id, sourceId: src.id, title: d.title, content: d.content });
    await db.update(sources).set({ status: "completed", processedAt: new Date() }).where(eq(sources.id, src.id));
    console.log(`   · ${d.title} → ${r.chunks} fragment(s)`);
  }
  const [assistant] = await db.insert(assistants).values({
    organizationId: org.id, name: "Assistant interne", description: "Répond aux questions RH, finances et support à partir de la documentation interne.",
    welcomeMessage: "Bonjour ! Posez-moi une question sur les congés, les frais de mission ou le support.", createdBy: demoUser.id,
  }).returning();
  await db.insert(assistantKnowledgeBases).values({ assistantId: assistant.id, knowledgeBaseId: kb.id, organizationId: org.id });
  await db.insert(widgetConfigurations).values({ organizationId: org.id, assistantId: assistant.id, publicKey: "wk_demo_hakili_public_widget", title: "Assistant Manden Industries", isEnabled: true, welcomeMessage: "Bonjour ! Comment puis-je vous aider ?" });
  console.log("→ Démo prête : demo@hakili.local / Demo-Hakili-2025! (admin), collaborateur@hakili.local / Demo-Hakili-2025! (collaborateur)");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => pool.end());
