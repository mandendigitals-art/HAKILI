import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { assistants, conversations, widgetConfigurations } from "@/db/schema";
import { PageHeader } from "@/components/page-header";
import { requireOrgContext } from "@/lib/auth";

export default async function AssistantsPage() {
  const ctx = await requireOrgContext();
  const rows = await db
    .select({
      a: assistants,
      convCount: sql<number>`(select count(*) from ${conversations} where ${conversations.assistantId} = ${assistants.id})`,
      widgetEnabled: widgetConfigurations.isEnabled,
    })
    .from(assistants)
    .leftJoin(widgetConfigurations, eq(widgetConfigurations.assistantId, assistants.id))
    .where(eq(assistants.organizationId, ctx.organization.id))
    .orderBy(desc(assistants.createdAt));

  return (
    <div>
      <PageHeader title="Mes assistants" text="Chaque assistant répond uniquement à partir des bases de connaissances qui lui sont reliées."
        actions={ctx.isAdmin ? <Link href="/dashboard/assistants/nouveau" className="btn-primary">Créer un assistant</Link> : undefined} />
      {rows.length === 0 ? (
        <div className="card p-10 text-center text-slate-500">Aucun assistant pour l&apos;instant.{ctx.isAdmin && <> <Link href="/dashboard/assistants/nouveau" className="text-tech-600 underline">Créez le premier</Link>.</>}</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ a, convCount, widgetEnabled }) => (
            <Link key={a.id} href={`/dashboard/assistants/${a.id}`} className="card p-5 hover:border-tech-500 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold text-nuit-900">{a.name}</h2>
                {widgetEnabled ? <span className="badge bg-emerald-100 text-emerald-800">Widget actif</span> : <span className="badge bg-slate-100 text-slate-600">Interne</span>}
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-slate-500">{a.description || "Sans description"}</p>
              <p className="mt-3 text-xs text-slate-400">{Number(convCount)} conversation(s) · {a.language.toUpperCase()}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
