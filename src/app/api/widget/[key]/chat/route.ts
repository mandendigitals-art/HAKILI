import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { assistants, conversations, organizations, widgetConfigurations } from "@/db/schema";
import { getClientIp } from "@/lib/auth";
import { assertWithinLimits } from "@/lib/plans";
import { answerQuestion } from "@/lib/rag/engine";
import { AppError, jsonError, rateLimitAsync } from "@/lib/security";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: cors });
}

export async function POST(req: Request, { params }: { params: Promise<{ key: string }> }) {
  try {
    const { key } = await params;
    const ip = await getClientIp();
    if (!(await rateLimitAsync(`widget-ip:${ip}`, 30, 60_000)).ok) {
      throw new AppError("Trop de requêtes. Patientez une minute.", 429);
    }

    const [row] = await db
      .select({ w: widgetConfigurations, a: assistants, org: organizations })
      .from(widgetConfigurations)
      .innerJoin(assistants, eq(assistants.id, widgetConfigurations.assistantId))
      .innerJoin(organizations, eq(organizations.id, widgetConfigurations.organizationId))
      .where(
        and(
          eq(widgetConfigurations.publicKey, key),
          eq(widgetConfigurations.isEnabled, true),
          eq(assistants.isActive, true),
        ),
      );

    if (!row || !row.org.isActive) throw new AppError("Widget indisponible.", 404);

    // Contrôle du domaine d'origine (si configuré)
    if (row.w.allowedDomains.length > 0) {
      const origin = req.headers.get("origin") || req.headers.get("referer") || "";
      let host = "";
      try {
        host = new URL(origin).hostname.toLowerCase();
      } catch {
        // Ignorer parse error
      }
      const self = (process.env.NEXT_PUBLIC_APP_URL ? new URL(process.env.NEXT_PUBLIC_APP_URL).hostname : "").toLowerCase();
      const ok = host === self || row.w.allowedDomains.some((d) => host === d || host.endsWith("." + d));
      if (!ok) throw new AppError("Domaine non autorisé pour ce widget.", 403);
    }

    const body = (await req.json().catch(() => ({}))) as { visitorId?: string; conversationId?: string; question?: string };
    const question = String(body.question ?? "").trim();
    const visitorId = String(body.visitorId ?? "").slice(0, 64) || ip;
    if (!question || question.length > 1000) throw new AppError("Question invalide (1 à 1000 caractères).");

    if (!(await rateLimitAsync(`widget-visitor:${key}:${visitorId}`, row.w.dailyLimitPerVisitor, 86_400_000)).ok) {
      throw new AppError("Limite quotidienne atteinte pour ce visiteur.", 429);
    }

    const orgId = row.org.id;
    await assertWithinLimits(orgId, "questions");

    let conversationId: string;
    if (body.conversationId) {
      // Isolation stricte de la conversation : vérification organisation, assistant, canal et visiteur
      const [c] = await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.id, body.conversationId),
            eq(conversations.organizationId, orgId),
            eq(conversations.assistantId, row.a.id),
            eq(conversations.channel, "widget"),
            eq(conversations.visitorId, visitorId),
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
          organizationId: orgId,
          assistantId: row.a.id,
          visitorId,
          channel: "widget",
          title: question.slice(0, 80),
        })
        .returning();
      conversationId = c.id;
    }

    const result = await answerQuestion({ assistant: row.a, conversationId, organizationId: orgId, question });

    return Response.json(
      {
        conversationId,
        answer: result.answer,
        refused: result.refused,
        generationUnavailable: result.generationUnavailable,
        citations: result.citations.map((c) => ({
          rank: c.rank,
          sourceName: c.sourceName,
          snippet: c.snippet.slice(0, 250),
        })),
      },
      { headers: cors },
    );
  } catch (e) {
    const res = jsonError(e);
    return new Response(res.body, { status: res.status, headers: { ...cors, "Content-Type": "application/json" } });
  }
}
