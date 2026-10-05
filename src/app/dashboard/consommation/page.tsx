import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { usageRecords } from "@/db/schema";
import { PageHeader, Stat } from "@/components/page-header";
import { requireOrgAdmin } from "@/lib/auth";
import { getActiveSubscription, getUsageSummary } from "@/lib/plans";

function Bar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return <div className="mt-2 h-2 w-full rounded-full bg-slate-100"><div className={`h-2 rounded-full ${pct > 90 ? "bg-red-500" : pct > 70 ? "bg-orange-500" : "bg-tech-600"}`} style={{ width: `${pct}%` }} /></div>;
}

export default async function UsagePage() {
  const ctx = await requireOrgAdmin();
  const orgId = ctx.organization.id;
  const [usage, sub, history] = await Promise.all([
    getUsageSummary(orgId),
    getActiveSubscription(orgId),
    db
      .select({ period: usageRecords.period, type: usageRecords.type, total: sql<number>`sum(${usageRecords.quantity})` })
      .from(usageRecords)
      .where(and(eq(usageRecords.organizationId, orgId)))
      .groupBy(usageRecords.period, usageRecords.type)
      .orderBy(desc(usageRecords.period))
      .limit(60),
  ]);
  const plan = sub?.plan;
  const periods = Array.from(new Set(history.map((h) => h.period)));
  const get = (p: string, t: string) => Number(history.find((h) => h.period === p && h.type === t)?.total ?? 0);

  return (
    <div>
      <PageHeader title="Consommation" text={`Période en cours : ${usage.period}${plan ? ` · Offre ${plan.name}` : ""}`} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ["Questions ce mois", usage.questions, plan?.maxQuestionsPerMonth],
          ["Documents", usage.documents, plan?.maxDocuments],
          ["Stockage (Mo)", usage.storageMb, plan?.maxStorageMb],
          ["Utilisateurs", usage.users, plan?.maxUsers],
          ["Assistants", usage.assistants, plan?.maxAssistants],
        ].map(([l, v, m]) => (
          <div key={String(l)} className="card p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{l}</p>
            <p className="mt-1 text-2xl font-bold text-nuit-900">{v as number}<span className="text-sm font-normal text-slate-400"> / {m ?? "∞"}</span></p>
            {typeof m === "number" && <Bar value={v as number} max={m} />}
          </div>
        ))}
        <Stat label="Jetons ce mois" value={usage.tokens.toLocaleString("fr-FR")} hint="Entrée + sortie du modèle IA" />
      </div>
      <div className="card mt-6 overflow-hidden">
        <h2 className="border-b border-slate-100 px-4 py-3 font-semibold text-nuit-900">Historique mensuel</h2>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-2">Mois</th><th className="px-4 py-2">Questions</th><th className="px-4 py-2">Documents ajoutés</th><th className="px-4 py-2">Jetons</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {periods.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">Pas encore de consommation.</td></tr>}
            {periods.map((p) => <tr key={p}><td className="px-4 py-2 font-medium">{p}</td><td className="px-4 py-2">{get(p, "question")}</td><td className="px-4 py-2">{get(p, "document")}</td><td className="px-4 py-2">{get(p, "tokens").toLocaleString("fr-FR")}</td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
