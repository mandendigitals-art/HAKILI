import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { assistants, conversations } from "@/db/schema";
import { apiOrgContext, getClientIp } from "@/lib/auth";
import { assertWithinLimits } from "@/lib/plans";
import { answerQuestion } from "@/lib/rag/engine";
import { AppError, jsonError, rateLimitAsync } from "@/lib/security";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const ctx = await apiOrgContext();
    if (!ctx) return Response.json({ error: "Non authentifié." }, { status: 401 });
    const ip = await getClientIp();

    if (!(await rateLimitAsync(`chat:${ctx.user.id}`, 40, 60_000)).ok || !(await rateLimitAsync(`chat-ip:${ip}`, 80, 60_000)).ok) {
      throw new AppError("Trop de questions en peu de temps. Patientez une minute.", 429);
    }

    const body = (await req.json().catch(() => ({}))) as {
      assistantId?: string;
      conversationId?: string;
      question?: string;
    };

    const question = String(body.question ?? "").trim();
    if (!question || question.length > 2000) throw new AppError("Question invalide (1 à 2000 caractères).");
    const orgId = ctx.organization.id;

    const [assistant] = await db
      .select()
      .from(assistants)
      .where(
        and(
          eq(assistants.id, String(body.assistantId ?? "")),
          eq(assistants.organizationId, orgId),
          eq(assistants.isActive, true),
        ),
      );

    if (!assistant) throw new AppError("Assistant introuvable.", 404);

    await assertWithinLimits(orgId, "questions");

    let conversationId: string;
    if (body.conversationId) {
      const [c] = await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.id, body.conversationId),
            eq(conversations.organizationId, orgId),
            eq(conversations.assistantId, assistant.id),
            eq(conversations.channel, "app"),
          ),
        );

      if (!c || (c.userId !== ctx.user.id && !ctx.isAdmin)) {
        throw new AppError("Conversation introuvable ou non autorisée.", 404);
      }
      conversationId = c.id;
    } else {
      const [c] = await db
        .insert(conversations)
        .values({
          organizationId: orgId,
          assistantId: assistant.id,
          userId: ctx.user.id,
          channel: "app",
          title: question.slice(0, 80),
        })
        .returning();
      conversationId = c.id;
    }

    const result = await answerQuestion({
      assistant,
      conversationId,
      organizationId: orgId,
      question,
      userId: ctx.user.id,
    });

    return Response.json({ conversationId, ...result });
  } catch (e) {
    return jsonError(e);
  }
}
