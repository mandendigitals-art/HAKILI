import { asc } from "drizzle-orm";
import { db } from "@/db";
import { plans, type Plan } from "@/db/schema";
import { savePlanAction } from "@/app/actions/admin";
import { PageHeader } from "@/components/page-header";
import { ActionForm } from "@/components/ui";
import { ensureDefaultPlans } from "@/lib/plans";

function PlanForm({ p }: { p?: Plan }) {
  return (
    <ActionForm action={savePlanAction} submitLabel={p ? "Enregistrer" : "Créer l'offre"} submitClassName="btn-secondary">
      {p && <input type="hidden" name="id" value={p.id} />}
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Nom</label><input name="name" defaultValue={p?.name} required className="input" /></div>
        <div><label className="label">Code</label><input name="code" defaultValue={p?.code} required className="input" /></div>
        <div className="col-span-2"><label className="label">Description</label><input name="description" defaultValue={p?.description ?? ""} className="input" /></div>
        <div><label className="label">Prix mensuel (FCFA)</label><input name="priceMonthlyXof" type="number" defaultValue={p?.priceMonthlyXof ?? 0} className="input" /></div>
        <div><label className="label">Ordre</label><input name="sortOrder" type="number" defaultValue={p?.sortOrder ?? 0} className="input" /></div>
        <div><label className="label">Documents max</label><input name="maxDocuments" type="number" defaultValue={p?.maxDocuments ?? 20} className="input" /></div>
        <div><label className="label">Stockage (Mo)</label><input name="maxStorageMb" type="number" defaultValue={p?.maxStorageMb ?? 100} className="input" /></div>
        <div><label className="label">Questions / mois</label><input name="maxQuestionsPerMonth" type="number" defaultValue={p?.maxQuestionsPerMonth ?? 200} className="input" /></div>
        <div><label className="label">Utilisateurs</label><input name="maxUsers" type="number" defaultValue={p?.maxUsers ?? 3} className="input" /></div>
        <div><label className="label">Assistants</label><input name="maxAssistants" type="number" defaultValue={p?.maxAssistants ?? 1} className="input" /></div>
        <label className="flex items-center gap-2 text-sm self-end"><input type="checkbox" name="isActive" defaultChecked={p?.isActive ?? true} className="accent-tech-600" /> Offre active</label>
        <div className="col-span-2"><label className="label">Avantages (un par ligne)</label><textarea name="features" rows={4} defaultValue={p?.features.join("\n")} className="input" /></div>
      </div>
    </ActionForm>
  );
}

export default async function AdminPlans() {
  await ensureDefaultPlans();
  const rows = await db.select().from(plans).orderBy(asc(plans.sortOrder));
  return (
    <div>
      <PageHeader title="Offres et limites" text="Modifiez les prix et quotas. Les changements s'appliquent immédiatement aux organisations abonnées." />
      <div className="grid gap-6 lg:grid-cols-2">
        {rows.map((p) => <div key={p.id} className="card p-5"><h2 className="mb-3 font-semibold text-nuit-900">{p.name} {!p.isActive && <span className="badge bg-slate-200 text-slate-600">inactive</span>}</h2><PlanForm p={p} /></div>)}
        <div className="card border-dashed p-5"><h2 className="mb-3 font-semibold text-nuit-900">Nouvelle offre</h2><PlanForm /></div>
      </div>
    </div>
  );
}
