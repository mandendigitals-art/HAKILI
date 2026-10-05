import { desc } from "drizzle-orm";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { updateLeadStatusAction } from "@/app/actions/leads";
import { PageHeader, StatusBadge, fmtDateTime } from "@/components/page-header";
import { requireSuperAdmin } from "@/lib/auth";

const KIND_LABEL: Record<string, string> = { contact: "Contact", demo: "Démonstration" };
const STATUS_LABEL: Record<string, string> = { new: "Nouvelle", in_progress: "En cours", done: "Traitée", archived: "Archivée" };
const MODE_LABEL: Record<string, string> = { presentiel: "Présentiel", visio: "Visioconférence" };

export default async function AdminLeads() {
  await requireSuperAdmin();
  const rows = await db.select().from(leads).orderBy(desc(leads.createdAt)).limit(300);
  const newCount = rows.filter((r) => r.status === "new").length;
  return (
    <div>
      <PageHeader title="Demandes reçues" text={`${rows.length} demande(s) · ${newCount} nouvelle(s). Formulaires Contact et Démonstration du site public.`} />
      <div className="space-y-4">
        {rows.length === 0 && <div className="card p-10 text-center text-slate-500">Aucune demande pour l&apos;instant.</div>}
        {rows.map((l) => (
          <div key={l.id} className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`badge ${l.kind === "demo" ? "bg-orange-100 text-orange-700" : "bg-tech-100 text-tech-700"}`}>{KIND_LABEL[l.kind]}</span>
                  <StatusBadge status={l.status} />
                  <span className="text-xs text-slate-400">{fmtDateTime(l.createdAt)}</span>
                </div>
                <h2 className="mt-2 font-semibold text-nuit-900">{l.fullName}{l.organization ? ` · ${l.organization}` : ""}</h2>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                  <a href={`mailto:${l.email}`} className="hover:text-tech-600">{l.email}</a>
                  {l.phone && <a href={`https://wa.me/${l.phone.replace(/[^\d]/g, "")}`} target="_blank" rel="noopener noreferrer" className="hover:text-tech-600">📱 {l.phone}</a>}
                  {l.sector && <span>Secteur : {l.sector}</span>}
                  {l.mode && <span>{MODE_LABEL[l.mode]}</span>}
                  {l.preferredDate && <span>Date souhaitée : {l.preferredDate}</span>}
                </div>
                {l.message && <p className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{l.message}</p>}
              </div>
              <form action={updateLeadStatusAction} className="flex items-center gap-2">
                <input type="hidden" name="id" value={l.id} />
                <select name="status" defaultValue={l.status} className="input py-1.5 text-sm">
                  {Object.entries(STATUS_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                <button className="btn-secondary text-sm px-3 py-1.5">Mettre à jour</button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
