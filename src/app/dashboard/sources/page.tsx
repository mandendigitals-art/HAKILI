import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { knowledgeBases, sources } from "@/db/schema";
import { deleteKnowledgeBaseAction, deleteSourceAction } from "@/app/actions/workspace";
import { PageHeader, StatusBadge, fmtDateTime } from "@/components/page-header";
import { NewKbForm, SourceForms } from "@/components/source-forms";
import { ConfirmButton } from "@/components/ui";
import { requireOrgAdmin } from "@/lib/auth";

const TYPE_LABEL: Record<string, string> = { file: "Fichier", url: "Page web", text: "Texte", qa: "Q&R" };

export default async function SourcesPage({ searchParams }: { searchParams: Promise<{ kb?: string }> }) {
  const ctx = await requireOrgAdmin();
  const { kb } = await searchParams;
  const orgId = ctx.organization.id;
  const kbs = await db.select().from(knowledgeBases).where(eq(knowledgeBases.organizationId, orgId)).orderBy(knowledgeBases.name);
  const all = await db.select().from(sources).where(eq(sources.organizationId, orgId)).orderBy(desc(sources.createdAt));
  const selectedKb = kbs.find((k) => k.id === kb) ?? null;
  const list = selectedKb ? all.filter((s) => s.knowledgeBaseId === selectedKb.id) : all;

  return (
    <div>
      <PageHeader title="Sources" text="Importez vos documents, pages web, textes et questions-réponses. Chaque source est nettoyée, découpée et vectorisée." />
      <div className="card mb-6 p-5">
        <h2 className="mb-3 font-semibold text-nuit-900">Bases de connaissances</h2>
        <NewKbForm />
        {kbs.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/dashboard/sources" className={`badge px-3 py-1 ${!selectedKb ? "bg-nuit-900 text-white" : "bg-slate-100 text-slate-700"}`}>Toutes ({all.length})</Link>
            {kbs.map((k) => (
              <span key={k.id} className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${selectedKb?.id === k.id ? "bg-nuit-900 text-white" : "bg-slate-100 text-slate-700"}`}>
                <Link href={`/dashboard/sources?kb=${k.id}`}>{k.name} ({all.filter((s) => s.knowledgeBaseId === k.id).length})</Link>
                <form action={deleteKnowledgeBaseAction}><input type="hidden" name="id" value={k.id} /><ConfirmButton className="ml-1 opacity-60 hover:opacity-100" message={`Supprimer la base « ${k.name} » et toutes ses sources ?`}>✕</ConfirmButton></form>
              </span>
            ))}
          </div>
        )}
      </div>

      {kbs.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2"><SourceForms kbs={kbs.map((k) => ({ id: k.id, name: k.name }))} defaultKb={selectedKb?.id} /></div>
          <div className="card overflow-hidden lg:col-span-3">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-2">Source</th><th className="px-4 py-2 hidden sm:table-cell">Type</th><th className="px-4 py-2">Statut</th><th className="px-4 py-2 hidden md:table-cell">Fragments</th><th className="px-2 py-2"></th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {list.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Aucune source. Ajoutez votre premier document.</td></tr>}
                {list.map((s) => (
                  <tr key={s.id}>
                    <td className="max-w-[220px] px-4 py-2.5"><p className="truncate font-medium text-slate-800" title={s.name}>{s.name}</p><p className="text-xs text-slate-400">{fmtDateTime(s.createdAt)}{s.errorMessage && <span className="block text-red-600">{s.errorMessage}</span>}</p></td>
                    <td className="px-4 py-2.5 hidden sm:table-cell text-slate-600">{TYPE_LABEL[s.type]}</td>
                    <td className="px-4 py-2.5"><StatusBadge status={s.status} /></td>
                    <td className="px-4 py-2.5 hidden md:table-cell text-slate-600">{s.chunkCount}</td>
                    <td className="px-2 py-2.5"><form action={deleteSourceAction}><input type="hidden" name="id" value={s.id} /><ConfirmButton className="btn-ghost px-2 py-1 text-xs text-red-600" message="Supprimer cette source et ses fragments ?">Suppr.</ConfirmButton></form></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
