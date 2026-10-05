import { eq } from "drizzle-orm";
import { db } from "@/db";
import { knowledgeBases } from "@/db/schema";
import { AssistantForm } from "@/components/assistant-form";
import { PageHeader } from "@/components/page-header";
import { requireOrgAdmin } from "@/lib/auth";

export default async function NewAssistantPage() {
  const ctx = await requireOrgAdmin();
  const kbs = await db.select({ id: knowledgeBases.id, name: knowledgeBases.name }).from(knowledgeBases).where(eq(knowledgeBases.organizationId, ctx.organization.id));
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Créer un assistant" text="Donnez-lui un nom, un périmètre documentaire et des consignes." />
      <div className="card p-6"><AssistantForm kbs={kbs} linked={kbs.length === 1 ? [kbs[0].id] : []} /></div>
    </div>
  );
}
