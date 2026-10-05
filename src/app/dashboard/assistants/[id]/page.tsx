import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { assistantKnowledgeBases, assistants, citations, conversations, knowledgeBases, messages, widgetConfigurations } from "@/db/schema";
import { createConversationAction, deleteAssistantAction, saveWidgetAction } from "@/app/actions/workspace";
import { AssistantForm } from "@/components/assistant-form";
import { Chat, type ChatMsg } from "@/components/chat";
import { PageHeader, fmtDateTime } from "@/components/page-header";
import { ActionForm, ConfirmButton, CopyButton } from "@/components/ui";
import { requireOrgContext } from "@/lib/auth";

export default async function AssistantPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ c?: string; tab?: string }> }) {
  const ctx = await requireOrgContext();
  const { id } = await params;
  const { c, tab = "chat" } = await searchParams;
  const orgId = ctx.organization.id;
  const [assistant] = await db.select().from(assistants).where(and(eq(assistants.id, id), eq(assistants.organizationId, orgId)));
  if (!assistant) notFound();

  const convWhere = ctx.isAdmin
    ? and(eq(conversations.assistantId, id), eq(conversations.organizationId, orgId), eq(conversations.channel, "app"))
    : and(eq(conversations.assistantId, id), eq(conversations.organizationId, orgId), eq(conversations.userId, ctx.user.id));
  const convs = await db.select().from(conversations).where(convWhere).orderBy(desc(conversations.updatedAt)).limit(30);
  const current = c ? convs.find((x) => x.id === c) ?? null : null;

  let initial: ChatMsg[] = [];
  if (current) {
    const msgs = await db.select().from(messages).where(eq(messages.conversationId, current.id)).orderBy(asc(messages.createdAt));
    const allCits = msgs.length
      ? await db.select().from(citations).where(and(eq(citations.organizationId, orgId), inArray(citations.messageId, msgs.map((m) => m.id))))
      : [];
    const byMsg = new Map<string, typeof allCits>();
    for (const ct of allCits) {
      if (!byMsg.has(ct.messageId)) byMsg.set(ct.messageId, []);
      byMsg.get(ct.messageId)!.push(ct);
    }
    initial = msgs
      .filter((m) => m.role !== "system")
      .map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content,
        refused: m.refused,
        confidence: m.confidence,
        citations: (byMsg.get(m.id) ?? []).sort((a, b) => a.rank - b.rank).map((ct) => ({ rank: ct.rank, sourceName: ct.sourceName, snippet: ct.snippet, score: ct.score, chunkId: ct.chunkId })),
      }));
  }

  const kbs = ctx.isAdmin ? await db.select({ id: knowledgeBases.id, name: knowledgeBases.name }).from(knowledgeBases).where(eq(knowledgeBases.organizationId, orgId)) : [];
  const linked = (await db.select({ id: assistantKnowledgeBases.knowledgeBaseId }).from(assistantKnowledgeBases).where(eq(assistantKnowledgeBases.assistantId, id))).map((x) => x.id);
  const [widget] = await db.select().from(widgetConfigurations).where(eq(widgetConfigurations.assistantId, id));
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://hakili.mandendigital.com";

  const tabs = [{ k: "chat", l: "Conversation" }, ...(ctx.isAdmin ? [{ k: "reglages", l: "Réglages" }, { k: "widget", l: "Widget" }] : [])];

  return (
    <div className="flex h-[calc(100vh-7.5rem)] flex-col lg:h-[calc(100vh-4rem)]">
      <PageHeader title={assistant.name} text={assistant.description ?? undefined}
        actions={<div className="flex gap-1 rounded-lg bg-slate-100 p-1">{tabs.map((t) => <Link key={t.k} href={`/dashboard/assistants/${id}?tab=${t.k}${c ? `&c=${c}` : ""}`} className={`rounded-md px-3 py-1.5 text-sm ${tab === t.k ? "bg-white font-semibold text-nuit-900 shadow-sm" : "text-slate-600"}`}>{t.l}</Link>)}</div>} />

      {tab === "chat" && (
        <div className="flex min-h-0 flex-1 gap-4">
          <aside className="hidden w-64 shrink-0 flex-col md:flex card overflow-hidden">
            <form action={createConversationAction} className="border-b border-slate-100 p-3"><input type="hidden" name="assistantId" value={id} /><button className="btn-secondary w-full">+ Nouvelle conversation</button></form>
            <ul className="flex-1 overflow-y-auto p-2 text-sm">
              {convs.length === 0 && <li className="px-2 py-2 text-slate-400">Aucun historique.</li>}
              {convs.map((cv) => (
                <li key={cv.id}><Link href={`/dashboard/assistants/${id}?c=${cv.id}`} className={`block rounded-md px-2 py-2 ${current?.id === cv.id ? "bg-tech-50 text-tech-700 font-medium" : "hover:bg-slate-50"}`}><span className="block truncate">{cv.title}</span><span className="text-xs text-slate-400">{fmtDateTime(cv.updatedAt)}</span></Link></li>
              ))}
            </ul>
          </aside>
          <div className="card flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 md:hidden">
              <Link href="/dashboard/conversations" className="text-xs text-tech-600">Historique</Link>
              <form action={createConversationAction}><input type="hidden" name="assistantId" value={id} /><button className="text-xs font-semibold text-tech-600">+ Nouvelle</button></form>
            </div>
            <Chat endpoint="/api/chat" body={{ assistantId: id }} initialMessages={initial} conversationId={current?.id ?? null} welcome={assistant.welcomeMessage} showConfidence={ctx.isAdmin} canPreview />
          </div>
        </div>
      )}

      {tab === "reglages" && ctx.isAdmin && (
        <div className="mx-auto w-full max-w-3xl space-y-6 overflow-y-auto">
          <div className="card p-6"><AssistantForm assistant={assistant} kbs={kbs} linked={linked} /></div>
          <div className="card border-red-200 p-6">
            <h3 className="font-semibold text-red-700">Zone de danger</h3>
            <p className="mt-1 text-sm text-slate-600">La suppression efface l&apos;assistant, son widget et toutes ses conversations.</p>
            <form action={deleteAssistantAction} className="mt-3"><input type="hidden" name="id" value={id} /><ConfirmButton message="Supprimer définitivement cet assistant ?">Supprimer l&apos;assistant</ConfirmButton></form>
          </div>
        </div>
      )}

      {tab === "widget" && ctx.isAdmin && (
        <div className="mx-auto w-full max-w-3xl space-y-6 overflow-y-auto">
          <div className="card p-6">
            <h3 className="font-semibold text-nuit-900">Widget pour votre site web</h3>
            <p className="mt-1 text-sm text-slate-500">Les visiteurs de votre site pourront interroger cet assistant. Limitez les domaines autorisés pour éviter les usages abusifs.</p>
            <div className="mt-4">
              <ActionForm action={saveWidgetAction} submitLabel="Enregistrer le widget">
                <input type="hidden" name="assistantId" value={id} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><label className="label">Titre affiché</label><input name="title" defaultValue={widget?.title ?? assistant.name} className="input" /></div>
                  <div><label className="label">Couleur principale</label><input name="primaryColor" type="color" defaultValue={widget?.primaryColor ?? "#1E6FE8"} className="input h-11 p-1" /></div>
                  <div className="sm:col-span-2"><label className="label">Message d&apos;accueil</label><input name="welcomeMessage" defaultValue={widget?.welcomeMessage ?? ""} className="input" /></div>
                  <div><label className="label">Position</label><select name="position" defaultValue={widget?.position ?? "right"} className="input"><option value="right">Bas droite</option><option value="left">Bas gauche</option></select></div>
                  <div><label className="label">Limite quotidienne par visiteur</label><input name="dailyLimitPerVisitor" type="number" min="1" max="500" defaultValue={widget?.dailyLimitPerVisitor ?? 30} className="input" /></div>
                  <div className="sm:col-span-2"><label className="label">Domaines autorisés (séparés par des virgules, vide = tous)</label><input name="allowedDomains" defaultValue={widget?.allowedDomains.join(", ") ?? ""} className="input" placeholder="monsite.ml, www.monsite.ml" /></div>
                  <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="isEnabled" defaultChecked={widget?.isEnabled ?? false} className="accent-tech-600" /> Activer le widget public</label>
                </div>
              </ActionForm>
            </div>
          </div>
          {widget && (
            <div className="card p-6">
              <h3 className="font-semibold text-nuit-900">Code d&apos;intégration</h3>
              <p className="mt-1 text-sm text-slate-500">Collez ce code avant la balise <code>&lt;/body&gt;</code> de votre site.</p>
              <pre className="mt-3 overflow-x-auto rounded-lg bg-nuit-950 p-4 text-xs text-slate-100">{`<script src="${appUrl}/embed.js" data-key="${widget.publicKey}" data-color="${widget.primaryColor}" data-position="${widget.position}" defer></script>`}</pre>
              <div className="mt-3 flex flex-wrap gap-2">
                <CopyButton text={`<script src="${appUrl}/embed.js" data-key="${widget.publicKey}" data-color="${widget.primaryColor}" data-position="${widget.position}" defer></script>`} label="Copier le code" />
                <a href={`/widget/${widget.publicKey}`} target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs px-3 py-1.5">Ouvrir l&apos;aperçu</a>
              </div>
              <p className="mt-3 text-xs text-slate-500">Intégration iframe directe : <code>{appUrl}/widget/{widget.publicKey}</code></p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
