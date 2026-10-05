import { notFound } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, organizationMembers, organizations, payments, plans, users } from "@/db/schema";
import { impersonateOrgAction, setSubscriptionAction, toggleOrganizationAction } from "@/app/actions/admin";
import { PageHeader, Stat, StatusBadge, fmtDate, fmtDateTime } from "@/components/page-header";
import { ActionForm, ConfirmButton } from "@/components/ui";
import { formatXof, getActiveSubscription, getUsageSummary } from "@/lib/plans";

export default async function AdminOrgDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [org] = await db.select().from(organizations).where(eq(organizations.id, id));
  if (!org) notFound();
  const [sub, usage, allPlans, members, pays, logs] = await Promise.all([
    getActiveSubscription(id),
    getUsageSummary(id),
    db.select().from(plans).orderBy(asc(plans.sortOrder)),
    db.select({ u: users, role: organizationMembers.role }).from(organizationMembers).innerJoin(users, eq(users.id, organizationMembers.userId)).where(eq(organizationMembers.organizationId, id)),
    db.select().from(payments).where(eq(payments.organizationId, id)).orderBy(desc(payments.createdAt)).limit(10),
    db.select().from(auditLogs).where(eq(auditLogs.organizationId, id)).orderBy(desc(auditLogs.createdAt)).limit(20),
  ]);
  return (
    <div>
      <PageHeader title={org.name} text={`${org.sector ?? "Secteur non renseigné"} · ${org.city ?? org.country} · slug ${org.slug}`}
        actions={<>
          <form action={impersonateOrgAction}><input type="hidden" name="id" value={id} /><button className="btn-secondary">Ouvrir l&apos;espace</button></form>
          <form action={toggleOrganizationAction}><input type="hidden" name="id" value={id} /><input type="hidden" name="active" value={org.isActive ? "0" : "1"} /><ConfirmButton className={org.isActive ? "btn-danger" : "btn-primary"} message={org.isActive ? "Désactiver l'accès de cette organisation ?" : "Réactiver cette organisation ?"}>{org.isActive ? "Désactiver" : "Réactiver"}</ConfirmButton></form>
        </>} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Offre" value={sub?.plan.name ?? "—"} hint={sub ? `${sub.subscription.status} · fin ${fmtDate(sub.subscription.endsAt)}` : undefined} />
        <Stat label="Documents" value={usage.documents} hint={`${usage.storageMb} Mo`} />
        <Stat label="Questions ce mois" value={usage.questions} />
        <Stat label="Jetons ce mois" value={usage.tokens.toLocaleString("fr-FR")} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-semibold text-nuit-900">Gérer l&apos;abonnement</h2>
          <div className="mt-3"><ActionForm action={setSubscriptionAction} submitLabel="Appliquer">
            <input type="hidden" name="organizationId" value={id} />
            <div><label className="label">Offre</label><select name="planId" defaultValue={sub?.plan.id} className="input">{allPlans.map((p) => <option key={p.id} value={p.id}>{p.name} — {formatXof(p.priceMonthlyXof)}</option>)}</select></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Statut</label><select name="status" defaultValue={sub?.subscription.status ?? "active"} className="input"><option value="trial">Essai</option><option value="active">Actif</option><option value="suspended">Suspendu</option><option value="expired">Expiré</option><option value="cancelled">Annulé</option></select></div>
              <div><label className="label">Durée (mois)</label><input name="months" type="number" min="0" max="36" defaultValue={1} className="input" /></div>
            </div>
            <div><label className="label">Note interne</label><input name="notes" className="input" /></div>
          </ActionForm></div>
        </div>
        <div className="card p-5">
          <h2 className="font-semibold text-nuit-900">Membres ({members.length})</h2>
          <ul className="mt-2 divide-y divide-slate-100 text-sm">{members.map((m) => <li key={m.u.id} className="flex justify-between py-2"><span>{m.u.name} <span className="text-xs text-slate-400">{m.u.email}</span></span><span className="badge bg-slate-100 text-slate-700">{m.role}</span></li>)}</ul>
          <h2 className="mt-5 font-semibold text-nuit-900">Derniers paiements</h2>
          <ul className="mt-2 divide-y divide-slate-100 text-sm">{pays.length === 0 && <li className="py-2 text-slate-500">Aucun.</li>}{pays.map((p) => <li key={p.id} className="flex justify-between py-2"><span>{fmtDate(p.createdAt)} · {p.method} · {p.reference}</span><span className="flex gap-2">{formatXof(p.amountXof)} <StatusBadge status={p.status} /></span></li>)}</ul>
        </div>
      </div>
      <div className="card mt-6 p-5">
        <h2 className="font-semibold text-nuit-900">Journal d&apos;activité</h2>
        <ul className="mt-2 divide-y divide-slate-100 text-sm">{logs.map((l) => <li key={l.id} className="py-1.5 text-slate-600"><span className="text-xs text-slate-400">{fmtDateTime(l.createdAt)}</span> · <code className="text-xs">{l.action}</code> {l.targetType && <span className="text-xs text-slate-400">{l.targetType}</span>}</li>)}</ul>
      </div>
    </div>
  );
}
