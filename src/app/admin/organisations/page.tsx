import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { organizationMembers, organizations, plans, sources, subscriptions } from "@/db/schema";
import { PageHeader, StatusBadge, fmtDate } from "@/components/page-header";

export default async function AdminOrgs() {
  const rows = await db
    .select({
      o: organizations,
      members: sql<number>`(select count(*) from ${organizationMembers} where ${organizationMembers.organizationId} = ${organizations.id})`,
      docs: sql<number>`(select count(*) from ${sources} where ${sources.organizationId} = ${organizations.id})`,
      planName: plans.name,
      subStatus: subscriptions.status,
      endsAt: subscriptions.endsAt,
    })
    .from(organizations)
    .leftJoin(subscriptions, sql`${subscriptions.id} = (select id from ${subscriptions} s where s.organization_id = ${organizations.id} order by s.created_at desc limit 1)`)
    .leftJoin(plans, eq(plans.id, subscriptions.planId))
    .orderBy(desc(organizations.createdAt));
  return (
    <div>
      <PageHeader title="Entreprises" text={`${rows.length} organisation(s) inscrites.`} />
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-2">Organisation</th><th className="px-4 py-2 hidden sm:table-cell">Offre</th><th className="px-4 py-2">Statut</th><th className="px-4 py-2 hidden md:table-cell">Membres / Docs</th><th className="px-4 py-2 hidden md:table-cell">Fin</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.o.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5"><Link href={`/admin/organisations/${r.o.id}`} className="font-medium text-slate-800 hover:text-tech-600">{r.o.name}</Link><span className="block text-xs text-slate-400">{r.o.sector ?? "—"} · inscrite le {fmtDate(r.o.createdAt)}</span></td>
                <td className="px-4 py-2.5 hidden sm:table-cell">{r.planName ?? "—"}</td>
                <td className="px-4 py-2.5 flex gap-1 flex-wrap">{!r.o.isActive && <span className="badge bg-red-100 text-red-700">Désactivée</span>}{r.subStatus && <StatusBadge status={r.subStatus} />}</td>
                <td className="px-4 py-2.5 hidden md:table-cell">{Number(r.members)} / {Number(r.docs)}</td>
                <td className="px-4 py-2.5 hidden md:table-cell text-slate-500">{fmtDate(r.endsAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
