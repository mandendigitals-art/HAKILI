import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { assistants, organizations, widgetConfigurations } from "@/db/schema";
import { WidgetClient } from "@/components/widget-client";

export const dynamic = "force-dynamic";

export default async function WidgetPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const [row] = await db
    .select({ w: widgetConfigurations, aName: assistants.name, aWelcome: assistants.welcomeMessage, active: organizations.isActive })
    .from(widgetConfigurations)
    .innerJoin(assistants, eq(assistants.id, widgetConfigurations.assistantId))
    .innerJoin(organizations, eq(organizations.id, widgetConfigurations.organizationId))
    .where(and(eq(widgetConfigurations.publicKey, key), eq(widgetConfigurations.isEnabled, true), eq(assistants.isActive, true)));
  if (!row || !row.active) {
    return <div className="flex h-screen items-center justify-center p-6 text-center text-sm text-slate-500">Cet assistant n&apos;est pas disponible pour le moment.</div>;
  }
  return (
    <WidgetClient
      publicKey={key}
      title={row.w.title || row.aName}
      welcome={row.w.welcomeMessage || row.aWelcome || "Bonjour ! Posez-moi une question, je réponds à partir de nos documents."}
      color={row.w.primaryColor}
    />
  );
}
