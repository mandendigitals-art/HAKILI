import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { payments, plans } from "@/db/schema";
import { declarePaymentAction } from "@/app/actions/workspace";
import { COMPANY } from "@/components/brand";
import { PageHeader, StatusBadge, fmtDate } from "@/components/page-header";
import { ActionForm } from "@/components/ui";
import { requireOrgAdmin } from "@/lib/auth";
import { ensureDefaultPlans, formatXof, getActiveSubscription } from "@/lib/plans";

const METHODS: Record<string, string> = { orange_money: "Orange Money", moov_money: "Moov Money", bank_transfer: "Virement bancaire", cash: "Espèces", other: "Autre" };

export default async function SubscriptionPage() {
  const ctx = await requireOrgAdmin();
  await ensureDefaultPlans();
  const [sub, allPlans, history] = await Promise.all([
    getActiveSubscription(ctx.organization.id),
    db.select().from(plans).where(eq(plans.isActive, true)).orderBy(asc(plans.sortOrder)),
    db.select({ p: payments, planName: plans.name }).from(payments).leftJoin(plans, eq(plans.id, payments.planId)).where(eq(payments.organizationId, ctx.organization.id)).orderBy(desc(payments.createdAt)).limit(30),
  ]);

  return (
    <div>
      <PageHeader title="Abonnement" text="Choisissez une offre, réglez par Orange Money, Moov Money ou virement, puis déclarez le paiement : Manden Digital l'active sous 24 h ouvrées." />
      {sub && (
        <div className="card mb-6 flex flex-wrap items-center gap-4 p-5">
          <div><p className="text-xs uppercase text-slate-500">Offre actuelle</p><p className="text-xl font-bold text-nuit-900">{sub.plan.name}</p></div>
          <StatusBadge status={sub.subscription.status} />
          <p className="text-sm text-slate-600">{sub.subscription.endsAt ? `Valide jusqu'au ${fmtDate(sub.subscription.endsAt)}` : "Sans date de fin"}</p>
          {sub.subscription.status === "suspended" && <p className="text-sm text-red-600">Abonnement suspendu : régularisez votre paiement ou contactez {COMPANY.email}.</p>}
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        {allPlans.map((p) => (
          <div key={p.id} className={`card p-5 ${sub?.plan.id === p.id ? "border-tech-600 ring-2 ring-tech-100" : ""}`}>
            <h3 className="text-lg font-bold text-nuit-900">{p.name}</h3>
            <p className="text-sm text-slate-500">{p.description}</p>
            <p className="mt-3 text-2xl font-black text-nuit-900">{formatXof(p.priceMonthlyXof)}<span className="text-sm font-normal text-slate-500"> / mois</span></p>
            <ul className="mt-3 space-y-1 text-sm text-slate-700">{p.features.map((f) => <li key={f}>✓ {f}</li>)}</ul>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-semibold text-nuit-900">Déclarer un paiement</h2>
          <div className="mt-2 rounded-lg bg-orange-50 p-3 text-sm text-slate-700">
            <p><strong>Orange Money / Moov Money :</strong> {COMPANY.phone} (Manden Digital SARL)</p>
            <p><strong>Virement bancaire :</strong> coordonnées communiquées sur demande à {COMPANY.email}</p>
            <p className="mt-1 text-xs text-slate-500">Indiquez le nom de votre organisation dans le motif du paiement.</p>
            <a href={`${COMPANY.whatsapp}?text=${encodeURIComponent("Bonjour, je viens d'effectuer un paiement pour HAKILI.")}`} target="_blank" rel="noopener noreferrer" className="btn-accent mt-3 w-full text-sm">Confirmer par WhatsApp</a>
          </div>
          <div className="mt-4">
            <ActionForm action={declarePaymentAction} submitLabel="Déclarer le paiement" resetOnSuccess>
              <div><label className="label">Offre</label><select name="planId" className="input" defaultValue={sub?.plan.id}>{allPlans.map((p) => <option key={p.id} value={p.id}>{p.name} — {formatXof(p.priceMonthlyXof)}/mois</option>)}</select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Durée (mois)</label><input name="months" type="number" min="1" max="24" defaultValue={1} className="input" /></div>
                <div><label className="label">Moyen de paiement</label><select name="method" className="input">{Object.entries(METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              </div>
              <div><label className="label">Référence de la transaction</label><input name="reference" required className="input" placeholder="Ex. : OM-2025-XXXXXX" /></div>
              <div><label className="label">Preuve de paiement (facultatif — image ou PDF, 5 Mo max.)</label><input name="proof" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" className="input" /></div>
              <div><label className="label">Remarque (optionnel)</label><input name="notes" className="input" /></div>
            </ActionForm>
          </div>
        </div>
        <div className="card overflow-hidden">
          <h2 className="border-b border-slate-100 px-4 py-3 font-semibold text-nuit-900">Historique des paiements</h2>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-2">Date</th><th className="px-4 py-2">Offre</th><th className="px-4 py-2">Montant</th><th className="px-4 py-2">Statut</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {history.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">Aucun paiement déclaré.</td></tr>}
              {history.map(({ p, planName }) => <tr key={p.id}><td className="px-4 py-2">{fmtDate(p.createdAt)}<span className="block text-xs text-slate-400">{METHODS[p.method]} · {p.reference}</span></td><td className="px-4 py-2">{planName} × {p.periodMonths}</td><td className="px-4 py-2">{formatXof(p.amountXof)}</td><td className="px-4 py-2"><StatusBadge status={p.status} /></td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
