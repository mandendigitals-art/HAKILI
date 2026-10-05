import { count, eq, sql, sum } from "drizzle-orm";
import { db } from "@/db";
import { organizations, payments, sources, usageRecords, users, subscriptions, leads } from "@/db/schema";
import { createSuperAdminAction } from "@/app/actions/admin";
import { PageHeader, Stat } from "@/components/page-header";
import { ActionForm } from "@/components/ui";
import { currentPeriod, formatXof } from "@/lib/plans";
import { describeAiSetup } from "@/lib/ai/provider";

export default async function AdminHome() {
  const period = currentPeriod();
  const [[orgs], [usr], [src], [q], [pend], [rev], [susp], [newLeads]] = await Promise.all([
    db.select({ n: count() }).from(organizations),
    db.select({ n: count() }).from(users),
    db.select({ n: count() }).from(sources),
    db.select({ n: sum(usageRecords.quantity) }).from(usageRecords).where(sql`${usageRecords.type} = 'question' and ${usageRecords.period} = ${period}`),
    db.select({ n: count() }).from(payments).where(eq(payments.status, "pending")),
    db.select({ n: sum(payments.amountXof) }).from(payments).where(eq(payments.status, "confirmed")),
    db.select({ n: count() }).from(subscriptions).where(eq(subscriptions.status, "suspended")),
    db.select({ n: count() }).from(leads).where(eq(leads.status, "new")),
  ]);
  const ai = describeAiSetup();
  return (
    <div>
      <PageHeader title="Vue globale de la plateforme" text={`HAKILI · ${period} · Moteur IA : ${ai.llm} · Embeddings : ${ai.embeddings}`} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Entreprises" value={Number(orgs.n)} />
        <Stat label="Utilisateurs" value={Number(usr.n)} />
        <Stat label="Sources indexées" value={Number(src.n)} />
        <Stat label="Questions ce mois" value={Number(q.n ?? 0)} />
        <Stat label="Paiements à confirmer" value={Number(pend.n)} hint="Voir Paiements" />
        <Stat label="Revenus confirmés" value={formatXof(Number(rev.n ?? 0))} />
        <Stat label="Abonnements suspendus" value={Number(susp.n)} />
        <Stat label="Demandes nouvelles" value={Number(newLeads.n)} hint="Voir Demandes" />
      </div>
      <div className="card mt-6 max-w-lg p-5">
        <h2 className="font-semibold text-nuit-900">Ajouter un super administrateur</h2>
        <p className="mt-1 text-sm text-slate-500">Réservé à l&apos;équipe Manden Digital. Action journalisée.</p>
        <div className="mt-3"><ActionForm action={createSuperAdminAction} submitLabel="Créer" resetOnSuccess>
          <div><label className="label">Nom</label><input name="name" required className="input" /></div>
          <div><label className="label">E-mail</label><input name="email" type="email" required className="input" /></div>
          <div><label className="label">Mot de passe (10 caractères min.)</label><input name="password" type="password" required minLength={10} className="input" /></div>
        </ActionForm></div>
      </div>
    </div>
  );
}
