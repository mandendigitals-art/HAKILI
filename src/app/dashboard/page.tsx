import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { assistants, conversations, sources } from "@/db/schema";
import { PageHeader, Stat, StatusBadge, fmtDate, fmtDateTime } from "@/components/page-header";
import { requireOrgContext } from "@/lib/auth";
import { getActiveSubscription, getUsageSummary } from "@/lib/plans";
import { describeAiSetup } from "@/lib/ai/provider";

export default async function DashboardPage() {
  const ctx = await requireOrgContext();
  const orgId = ctx.organization.id;
  const [usage, sub, myAssistants, recentSources, recentConvs] = await Promise.all([
    getUsageSummary(orgId),
    getActiveSubscription(orgId),
    db.select().from(assistants).where(eq(assistants.organizationId, orgId)).orderBy(desc(assistants.createdAt)).limit(6),
    db.select().from(sources).where(eq(sources.organizationId, orgId)).orderBy(desc(sources.createdAt)).limit(5),
    db.select().from(conversations).where(eq(conversations.organizationId, orgId)).orderBy(desc(conversations.updatedAt)).limit(5),
  ]);
  const ai = describeAiSetup();
  const plan = sub?.plan;

  return (
    <div>
      <PageHeader title={`Bonjour, ${ctx.user.name.split(" ")[0]}`} text={`Espace ${ctx.organization.name} · Toute votre connaissance, en une question.`}
        actions={ctx.isAdmin ? <><Link href="/dashboard/sources" className="btn-secondary">Ajouter des sources</Link><Link href="/dashboard/assistants/nouveau" className="btn-primary">Créer un assistant</Link></> : undefined} />

      {ai.isLocal && ctx.isAdmin && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Mode démonstration : aucun fournisseur IA n&apos;est configuré. Les réponses sont extractives (passages pertinents). Renseignez <code>OPENAI_API_KEY</code>, <code>GEMINI_API_KEY</code> ou <code>MUAPI_API_KEY</code> pour des réponses rédigées.
        </div>
      )}

      {sub && (
        <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Organisation</p>
            <p className="font-semibold text-nuit-900">{ctx.organization.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Abonnement</p>
            <span className="font-semibold text-nuit-900">{plan?.name}</span>
            <StatusBadge status={sub.subscription.status} />
          </div>
          {sub.subscription.status === "trial" && sub.subscription.endsAt && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Fin de l&apos;essai</p>
              <p className="font-semibold text-orange-600">{fmtDate(sub.subscription.endsAt)}</p>
            </div>
          )}
          {sub.subscription.status !== "trial" && sub.subscription.endsAt && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Valide jusqu&apos;au</p>
              <p className="font-semibold text-nuit-900">{fmtDate(sub.subscription.endsAt)}</p>
            </div>
          )}
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Utilisateurs</p>
            <p className="font-semibold text-nuit-900">{usage.users}{plan ? ` / ${plan.maxUsers}` : ""}</p>
          </div>
          {ctx.isAdmin && (
            <Link href="/dashboard/abonnement" className="btn-secondary ml-auto text-sm">Gérer l&apos;abonnement</Link>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Assistants" value={usage.assistants} hint={plan ? `sur ${plan.maxAssistants}` : undefined} />
        <Stat label="Documents" value={usage.documents} hint={plan ? `sur ${plan.maxDocuments}` : undefined} />
        <Stat label="Questions ce mois" value={usage.questions} hint={plan ? `sur ${plan.maxQuestionsPerMonth}` : undefined} />
        <Stat label="Jetons consommés" value={usage.tokens.toLocaleString("fr-FR")} hint={usage.period} />
      </div>

      {myAssistants.length === 0 ? (
        <div className="card mt-6 p-8 text-center">
          <p className="text-4xl">🚀</p>
          <h2 className="mt-3 text-lg font-semibold text-nuit-900">Commencez en trois étapes</h2>
          <ol className="mx-auto mt-3 max-w-md space-y-1.5 text-left text-sm text-slate-600">
            <li>1. Créez une base de connaissances et importez vos documents dans <Link href="/dashboard/sources" className="text-tech-600 underline">Sources</Link>.</li>
            <li>2. Créez un <Link href="/dashboard/assistants/nouveau" className="text-tech-600 underline">assistant</Link> relié à cette base.</li>
            <li>3. Posez vos questions, vérifiez les citations, puis activez le widget sur votre site.</li>
          </ol>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="card p-5 lg:col-span-1">
            <h2 className="font-semibold text-nuit-900">Mes assistants</h2>
            <ul className="mt-3 divide-y divide-slate-100">
              {myAssistants.map((a) => (
                <li key={a.id}><Link href={`/dashboard/assistants/${a.id}`} className="flex items-center justify-between py-2.5 text-sm hover:text-tech-600"><span className="truncate font-medium">{a.name}</span><span className="text-slate-400">→</span></Link></li>
              ))}
            </ul>
          </div>
          <div className="card p-5">
            <h2 className="font-semibold text-nuit-900">Dernières sources</h2>
            <ul className="mt-3 divide-y divide-slate-100 text-sm">
              {recentSources.length === 0 && <li className="py-2 text-slate-500">Aucune source.</li>}
              {recentSources.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 py-2.5"><span className="truncate">{s.name}</span><StatusBadge status={s.status} /></li>
              ))}
            </ul>
          </div>
          <div className="card p-5">
            <h2 className="font-semibold text-nuit-900">Conversations récentes</h2>
            <ul className="mt-3 divide-y divide-slate-100 text-sm">
              {recentConvs.length === 0 && <li className="py-2 text-slate-500">Aucune conversation.</li>}
              {recentConvs.map((c) => (
                <li key={c.id}><Link href={`/dashboard/assistants/${c.assistantId}?c=${c.id}`} className="block py-2.5 hover:text-tech-600"><span className="block truncate">{c.title}</span><span className="text-xs text-slate-400">{c.channel} · {fmtDateTime(c.updatedAt)}</span></Link></li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
