import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { organizations, payments, plans } from "@/db/schema";
import { confirmPaymentAction } from "@/app/actions/admin";
import { PageHeader, StatusBadge, fmtDate } from "@/components/page-header";
import { ConfirmButton } from "@/components/ui";
import { formatXof } from "@/lib/plans";

export default async function AdminPayments() {
  const rows = await db.select({ p: payments, orgName: organizations.name, orgId: organizations.id, planName: plans.name }).from(payments).innerJoin(organizations, eq(organizations.id, payments.organizationId)).leftJoin(plans, eq(plans.id, payments.planId)).orderBy(desc(payments.createdAt)).limit(200);
  const pending = rows.filter((r) => r.p.status === "pending");
  return (
    <div>
      <PageHeader title="Paiements" text={`${pending.length} paiement(s) en attente de confirmation. La confirmation active ou prolonge l'abonnement automatiquement.`} />
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-2">Date</th><th className="px-4 py-2">Organisation</th><th className="px-4 py-2 hidden sm:table-cell">Offre</th><th className="px-4 py-2">Montant</th><th className="px-4 py-2 hidden md:table-cell">Moyen / Référence</th><th className="px-4 py-2">Statut</th><th></th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Aucun paiement.</td></tr>}
            {rows.map((r) => (
              <tr key={r.p.id}>
                <td className="px-4 py-2.5 text-slate-500">{fmtDate(r.p.createdAt)}</td>
                <td className="px-4 py-2.5"><Link href={`/admin/organisations/${r.orgId}`} className="font-medium hover:text-tech-600">{r.orgName}</Link></td>
                <td className="px-4 py-2.5 hidden sm:table-cell">{r.planName} × {r.p.periodMonths} mois</td>
                <td className="px-4 py-2.5 font-semibold">{formatXof(r.p.amountXof)}</td>
                <td className="px-4 py-2.5 hidden md:table-cell text-slate-600">{r.p.method}<span className="block text-xs text-slate-400">{r.p.reference}{r.p.notes ? ` · ${r.p.notes}` : ""}</span>{r.p.proofUrl && <a href={`/api/paiements/preuve?id=${r.p.id}`} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-tech-600 hover:underline">Voir la preuve</a>}</td>
                <td className="px-4 py-2.5"><StatusBadge status={r.p.status} /></td>
                <td className="px-2 py-2.5">{r.p.status === "pending" && <div className="flex gap-1"><form action={confirmPaymentAction}><input type="hidden" name="id" value={r.p.id} /><input type="hidden" name="decision" value="confirm" /><ConfirmButton className="btn-primary px-2 py-1 text-xs" message="Confirmer la réception de ce paiement et activer l'abonnement ?">Confirmer</ConfirmButton></form><form action={confirmPaymentAction}><input type="hidden" name="id" value={r.p.id} /><input type="hidden" name="decision" value="reject" /><ConfirmButton className="btn-ghost px-2 py-1 text-xs text-red-600" message="Rejeter ce paiement ?">Rejeter</ConfirmButton></form></div>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
