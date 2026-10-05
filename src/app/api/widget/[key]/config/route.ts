import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { assistants, widgetConfigurations } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const [row] = await db
    .select({ w: widgetConfigurations, a: { name: assistants.name, welcome: assistants.welcomeMessage } })
    .from(widgetConfigurations)
    .innerJoin(assistants, eq(assistants.id, widgetConfigurations.assistantId))
    .where(and(eq(widgetConfigurations.publicKey, key), eq(widgetConfigurations.isEnabled, true), eq(assistants.isActive, true)));
  if (!row) return Response.json({ error: "Widget indisponible." }, { status: 404 });
  return Response.json(
    {
      title: row.w.title || row.a.name,
      welcomeMessage: row.w.welcomeMessage || row.a.welcome || "Bonjour ! Posez-moi une question sur nos documents.",
      primaryColor: row.w.primaryColor,
      position: row.w.position,
    },
    { headers: { "Access-Control-Allow-Origin": "*" } },
  );
}
