import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { documentChunks, sources } from "@/db/schema";
import { apiOrgContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Aperçu complet d'un passage cité (isolé par organisation). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await apiOrgContext();
  if (!ctx) return Response.json({ error: "Non authentifié." }, { status: 401 });
  const { id } = await params;
  const [row] = await db
    .select({ content: documentChunks.content, index: documentChunks.chunkIndex, sourceName: sources.name, sourceType: sources.type, url: sources.url })
    .from(documentChunks)
    .innerJoin(sources, eq(sources.id, documentChunks.sourceId))
    .where(and(eq(documentChunks.id, id), eq(documentChunks.organizationId, ctx.organization.id)));
  if (!row) return Response.json({ error: "Passage introuvable." }, { status: 404 });
  return Response.json(row);
}
