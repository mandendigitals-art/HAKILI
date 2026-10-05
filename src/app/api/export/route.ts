import { eq } from "drizzle-orm";
import { db } from "@/db";
import { assistants, citations, conversations, knowledgeBases, messages, organizationMembers, sources, users } from "@/db/schema";
import { apiOrgContext, audit } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Export JSON complet des données de l'organisation (portabilité / RGPD). Admin uniquement. */
export async function GET() {
  const ctx = await apiOrgContext();
  if (!ctx || !ctx.isAdmin) return Response.json({ error: "Accès refusé." }, { status: 403 });
  const orgId = ctx.organization.id;
  const [kbs, srcs, asst, members, convs, msgs, cits] = await Promise.all([
    db.select().from(knowledgeBases).where(eq(knowledgeBases.organizationId, orgId)),
    db.select().from(sources).where(eq(sources.organizationId, orgId)),
    db.select().from(assistants).where(eq(assistants.organizationId, orgId)),
    db
      .select({ email: users.email, name: users.name, role: organizationMembers.role, since: organizationMembers.createdAt })
      .from(organizationMembers)
      .innerJoin(users, eq(users.id, organizationMembers.userId))
      .where(eq(organizationMembers.organizationId, orgId)),
    db.select().from(conversations).where(eq(conversations.organizationId, orgId)),
    db.select().from(messages).where(eq(messages.organizationId, orgId)),
    db.select().from(citations).where(eq(citations.organizationId, orgId)),
  ]);
  await audit({ action: "organization.export", organizationId: orgId, userId: ctx.user.id });
  const payload = {
    exportedAt: new Date().toISOString(),
    application: "HAKILI — Manden Digital SARL",
    organization: ctx.organization,
    members,
    knowledgeBases: kbs,
    sources: srcs,
    assistants: asst,
    conversations: convs,
    messages: msgs,
    citations: cits,
  };
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="hakili-export-${ctx.organization.slug}-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
