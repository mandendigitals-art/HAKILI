import Link from "next/link";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { assistants, conversations, messages, users } from "@/db/schema";
import { deleteConversationAction } from "@/app/actions/workspace";
import { PageHeader, fmtDateTime } from "@/components/page-header";
import { ConfirmButton } from "@/components/ui";
import { requireOrgContext } from "@/lib/auth";

const CH: Record<string, string> = { app: "Application", widget: "Widget", api: "API" };

export default async function ConversationsPage() {
  const ctx = await requireOrgContext();
  const where = ctx.isAdmin
    ? eq(conversations.organizationId, ctx.organization.id)
    : and(eq(conversations.organizationId, ctx.organization.id), eq(conversations.userId, ctx.user.id));
  const rows = await db
    .select({
      c: conversations,
      assistantName: assistants.name,
      userName: users.name,
      count: sql<number>`(select count(*) from ${messages} where ${messages.conversationId} = ${conversations.id})`,
    })
    .from(conversations)
    .innerJoin(assistants, eq(assistants.id, conversations.assistantId))
    .leftJoin(users, eq(users.id, conversations.userId))
    .where(where)
    .orderBy(desc(conversations.updatedAt))
    .limit(200);

  return (
    <div>
      <PageHeader title="Conversations" text={ctx.isAdmin ? `Historique de toutes les conversations (application, widget, API). Conservation : ${ctx.organization.conversationRetentionDays} jours.` : "Vos conversations avec les assistants."} />
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-2">Sujet</th><th className="px-4 py-2 hidden sm:table-cell">Assistant</th><th className="px-4 py-2 hidden md:table-cell">Canal / Auteur</th><th className="px-4 py-2 hidden md:table-cell">Messages</th><th className="px-4 py-2">Dernière activité</th><th></th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Aucune conversation.</td></tr>}
            {rows.map(({ c, assistantName, userName, count }) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="max-w-[240px] px-4 py-2.5"><Link href={`/dashboard/assistants/${c.assistantId}?c=${c.id}`} className="block truncate font-medium text-slate-800 hover:text-tech-600">{c.title}</Link></td>
                <td className="px-4 py-2.5 hidden sm:table-cell text-slate-600">{assistantName}</td>
                <td className="px-4 py-2.5 hidden md:table-cell text-slate-600">{CH[c.channel]} · {userName ?? (c.visitorId ? "Visiteur" : "—")}</td>
                <td className="px-4 py-2.5 hidden md:table-cell text-slate-600">{Number(count)}</td>
                <td className="px-4 py-2.5 text-slate-500">{fmtDateTime(c.updatedAt)}</td>
                <td className="px-2 py-2.5"><form action={deleteConversationAction}><input type="hidden" name="id" value={c.id} /><ConfirmButton className="btn-ghost px-2 py-1 text-xs text-red-600" message="Supprimer cette conversation ?">Suppr.</ConfirmButton></form></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
