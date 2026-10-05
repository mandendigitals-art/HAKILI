import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, organizations, users } from "@/db/schema";
import { PageHeader, fmtDateTime } from "@/components/page-header";

export default async function AdminJournal() {
  const rows = await db.select({ l: auditLogs, orgName: organizations.name, userEmail: users.email }).from(auditLogs).leftJoin(organizations, eq(organizations.id, auditLogs.organizationId)).leftJoin(users, eq(users.id, auditLogs.userId)).orderBy(desc(auditLogs.createdAt)).limit(300);
  return (
    <div>
      <PageHeader title="Journal des actions" text="Traçabilité des actions administratives et sensibles (300 dernières)." />
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-2">Date</th><th className="px-4 py-2">Action</th><th className="px-4 py-2 hidden sm:table-cell">Organisation</th><th className="px-4 py-2 hidden md:table-cell">Utilisateur</th><th className="px-4 py-2 hidden lg:table-cell">IP</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(({ l, orgName, userEmail }) => <tr key={l.id}><td className="px-4 py-2 text-slate-500 whitespace-nowrap">{fmtDateTime(l.createdAt)}</td><td className="px-4 py-2"><code className="text-xs">{l.action}</code>{l.meta && <span className="block truncate max-w-[260px] text-xs text-slate-400">{JSON.stringify(l.meta)}</span>}</td><td className="px-4 py-2 hidden sm:table-cell">{orgName ?? "—"}</td><td className="px-4 py-2 hidden md:table-cell text-slate-600">{userEmail ?? "—"}</td><td className="px-4 py-2 hidden lg:table-cell text-xs text-slate-400">{l.ip}</td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
