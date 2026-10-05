import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys, assistants, conversations, organizations } from "@/db/schema";
import { sha256, getClientIp } from "@/lib/auth";
import { assertWithinLimits } from "@/lib/plans";
import { answerQuestion } from "@/lib/rag/engine";
import { AppError, jsonError, rateLimitAsync } from "@/lib/security";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** API publique : POST /api/v1/ask  { assistantId, question, conversationId? }  Authorization: Bearer hk_xxx */
export async function POST(req: Request) {
  try {
    const ip = await getClientIp();
    if (!(await rateLimitAsync(`api-ip:${ip}`, 60, 60_000)).ok) throw new AppError("Trop de requêtes.", 429);
    const auth = req.headers.get("authorization") ?? "";
    const raw = auth.replace(/^Bearer\s+/i, "").trim();
    if (!raw.startsWith("hk_")) throw new AppError("Clé API manquante ou format invalide (Bearer hk_...).", 401);

    const [k] = await db
      .select({ key: apiKeys, org: organizations })
      .from(apiKeys)
      .innerJoin(organizations, eq(organizations.id, apiKeys.organizationId))
      .where(and(eq(apiKeys.keyHash, sha256(raw)), isNull(apiKeys.revokedAt)));

    if (!k || !k.org.isActive) throw new AppError("Clé API invalide ou révoquée.", 401);

    // Rate limit par clé API
    if (!(await rateLimitAsync(`apikey:${k.key.id}`, 120, 60_000)).ok) {
      throw new AppError("Limite de requêtes atteinte pour cette clé API.", 429);
    }

    await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, k.key.id));

    const body = (await req.json().catch(() => ({}))) as {
      assistantId?: string;
      question?: string;
      conversationId?: string;
    };

    const question = String(body.question ?? "").trim();
    if (!question || question.length > 2000) throw new AppError("Question invalide (1 à 2000 caractères).");

    const [assistant] = await db
      .select()
      .from(assistants)
      .where(
        and(
          eq(assistants.id, String(body.assistantId ?? "")),
          eq(assistants.organizationId, k.org.id),
          eq(assistants.isActive, true),
        ),
      );

    if (!assistant) throw new AppError("Assistant introuvable dans votre organisation.", 404);
    await assertWithinLimits(k.org.id, "questions");

    let conversationId: string;
    if (body.conversationId) {
      // Isolation stricte de la conversation : vérification organisation, assistant et canal 'api'
      const [c] = await db
        .select({ id: conversations.id })
        .from(conversations)
        .where(
          and(
            eq(conversations.id, body.conversationId),
            eq(conversations.organizationId, k.org.id),
            eq(conversations.assistantId, assistant.id),
            eq(conversations.channel, "api"),
          ),
        );

      if (!c) {
        throw new AppError("Conversation introuvable ou non autorisée pour cet assistant.", 404);
      }
      conversationId = c.id;
    } else {
      const [c] = await db
        .insert(conversations)
        .values({
          organizationId: k.org.id,
          assistantId: assistant.id,
          channel: "api",
          title: question.slice(0, 80),
        })
        .returning();
      conversationId = c.id;
    }

    const r = await answerQuestion({ assistant, conversationId, organizationId: k.org.id, question });
    return Response.json({
      conversationId,
      answer: r.answer,
      refused: r.refused,
      confidence: r.confidence,
      generationUnavailable: r.generationUnavailable,
      citations: r.citations,
    });
  } catch (e) {
    return jsonError(e);
  }
}
