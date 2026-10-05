import { and, count, desc, eq, sum } from "drizzle-orm";
import { db } from "@/db";
import { assistants, organizationMembers, plans, sources, subscriptions, usageRecords, type Plan } from "@/db/schema";
import { AppError } from "@/lib/security";

export const currentPeriod = () => new Date().toISOString().slice(0, 7);

export const DEFAULT_PLANS: Omit<Plan, "id" | "createdAt" | "updatedAt">[] = [
  {
    code: "essentiel",
    name: "Essentiel",
    description: "Pour démarrer avec un assistant et vos documents clés.",
    priceMonthlyXof: 25_000,
    maxDocuments: 30,
    maxStorageMb: 200,
    maxQuestionsPerMonth: 500,
    maxUsers: 3,
    maxAssistants: 1,
    features: ["1 assistant", "30 documents", "500 questions / mois", "3 utilisateurs", "Widget site web", "Support e-mail"],
    isActive: true,
    sortOrder: 1,
  },
  {
    code: "professionnel",
    name: "Professionnel",
    description: "Pour les PME, cabinets et écoles qui déploient plusieurs assistants.",
    priceMonthlyXof: 75_000,
    maxDocuments: 200,
    maxStorageMb: 2_000,
    maxQuestionsPerMonth: 3_000,
    maxUsers: 15,
    maxAssistants: 5,
    features: ["5 assistants", "200 documents", "3 000 questions / mois", "15 utilisateurs", "Widget + clés API", "Export des données", "Support prioritaire"],
    isActive: true,
    sortOrder: 2,
  },
  {
    code: "entreprise",
    name: "Entreprise",
    description: "Pour les institutions, ONG et grandes organisations.",
    priceMonthlyXof: 200_000,
    maxDocuments: 2_000,
    maxStorageMb: 20_000,
    maxQuestionsPerMonth: 20_000,
    maxUsers: 100,
    maxAssistants: 25,
    features: ["25 assistants", "2 000 documents", "20 000 questions / mois", "100 utilisateurs", "Accompagnement dédié", "Hébergement dédié possible", "SLA"],
    isActive: true,
    sortOrder: 3,
  },
];

export async function ensureDefaultPlans() {
  for (const p of DEFAULT_PLANS) {
    await db.insert(plans).values(p).onConflictDoNothing({ target: plans.code });
  }
}

export async function getActiveSubscription(organizationId: string) {
  const rows = await db
    .select({ subscription: subscriptions, plan: plans })
    .from(subscriptions)
    .innerJoin(plans, eq(plans.id, subscriptions.planId))
    .where(eq(subscriptions.organizationId, organizationId))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function getUsageSummary(organizationId: string, period = currentPeriod()) {
  const [q] = await db
    .select({ n: sum(usageRecords.quantity) })
    .from(usageRecords)
    .where(and(eq(usageRecords.organizationId, organizationId), eq(usageRecords.period, period), eq(usageRecords.type, "question")));
  const [t] = await db
    .select({ n: sum(usageRecords.quantity) })
    .from(usageRecords)
    .where(and(eq(usageRecords.organizationId, organizationId), eq(usageRecords.period, period), eq(usageRecords.type, "tokens")));
  const [d] = await db.select({ n: count() }).from(sources).where(eq(sources.organizationId, organizationId));
  const [s] = await db.select({ n: sum(sources.sizeBytes) }).from(sources).where(eq(sources.organizationId, organizationId));
  const [u] = await db.select({ n: count() }).from(organizationMembers).where(eq(organizationMembers.organizationId, organizationId));
  const [a] = await db.select({ n: count() }).from(assistants).where(eq(assistants.organizationId, organizationId));
  return {
    period,
    questions: Number(q?.n ?? 0),
    tokens: Number(t?.n ?? 0),
    documents: Number(d?.n ?? 0),
    storageMb: Math.round((Number(s?.n ?? 0) / (1024 * 1024)) * 100) / 100,
    users: Number(u?.n ?? 0),
    assistants: Number(a?.n ?? 0),
  };
}

export type LimitKind = "documents" | "questions" | "users" | "assistants" | "storage";

/** Vérifie une limite du plan ; lève une AppError explicite si dépassée ou abonnement suspendu. */
export async function assertWithinLimits(organizationId: string, kind: LimitKind, extraBytes = 0) {
  const sub = await getActiveSubscription(organizationId);
  if (!sub) throw new AppError("Aucun abonnement actif. Contactez Manden Digital pour activer votre espace.", 402, "no_subscription");
  const { subscription, plan } = sub;
  if (subscription.status === "suspended") throw new AppError("Votre abonnement est suspendu. Contactez le support pour le réactiver.", 402, "suspended");
  if (subscription.status === "expired" || subscription.status === "cancelled")
    throw new AppError("Votre abonnement est expiré. Renouvelez-le pour continuer.", 402, "expired");
  if (subscription.endsAt && subscription.endsAt < new Date() && subscription.status !== "trial")
    throw new AppError("Votre période d'abonnement est terminée. Renouvelez-la pour continuer.", 402, "expired");

  const usage = await getUsageSummary(organizationId);
  const over = (label: string, cur: number, max: number) =>
    new AppError(`Limite du plan ${plan.name} atteinte : ${label} (${cur}/${max}). Passez à une offre supérieure.`, 402, "limit");
  switch (kind) {
    case "documents":
      if (usage.documents >= plan.maxDocuments) throw over("documents", usage.documents, plan.maxDocuments);
      break;
    case "questions":
      if (usage.questions >= plan.maxQuestionsPerMonth) throw over("questions ce mois-ci", usage.questions, plan.maxQuestionsPerMonth);
      break;
    case "users":
      if (usage.users >= plan.maxUsers) throw over("utilisateurs", usage.users, plan.maxUsers);
      break;
    case "assistants":
      if (usage.assistants >= plan.maxAssistants) throw over("assistants", usage.assistants, plan.maxAssistants);
      break;
    case "storage":
      if (usage.storageMb + extraBytes / (1024 * 1024) > plan.maxStorageMb) throw over("stockage (Mo)", Math.ceil(usage.storageMb), plan.maxStorageMb);
      break;
  }
  return { subscription, plan, usage };
}

export const formatXof = (n: number) => new Intl.NumberFormat("fr-FR").format(n) + " FCFA";
