"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { db } from "@/db";
import {
  assistantKnowledgeBases,
  assistants,
  conversations,
  documents,
  knowledgeBases,
  organizationMembers,
  organizations,
  payments,
  plans,
  sessions,
  sources,
  users,
  widgetConfigurations,
  apiKeys,
  type PaymentMethod,
} from "@/db/schema";
import { audit, hashPassword, requireOrgAdmin, requireOrgContext, sha256 } from "@/lib/auth";
import { assertWithinLimits } from "@/lib/plans";
import { ingestDocument } from "@/lib/rag/engine";
import { extractDocx, extractPdf, extractTxt, extractUrl, cleanText } from "@/lib/rag/extract";
import { getStorage } from "@/lib/storage";
import {
  AppError,
  MAX_FILE_BYTES,
  detectFileKind,
  isDangerousFilename,
  rateLimitAsync,
  safeErrorMessage,
  sanitizeFilename,
} from "@/lib/security";
import type { ActionState } from "./auth";

const str = (fd: FormData, k: string, max = 500) => String(fd.get(k) ?? "").trim().slice(0, max);

// ─────────────────────────── Bases de connaissances ───────────────────────────
export async function createKnowledgeBaseAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireOrgAdmin();
  const name = str(fd, "name", 80);
  if (name.length < 2) return { error: "Nom trop court." };
  const [kb] = await db
    .insert(knowledgeBases)
    .values({ organizationId: ctx.organization.id, name, description: str(fd, "description") || null, createdBy: ctx.user.id })
    .returning();
  await audit({ action: "kb.create", organizationId: ctx.organization.id, userId: ctx.user.id, targetType: "knowledge_base", targetId: kb.id });
  revalidatePath("/dashboard/sources");
  return { success: "Base de connaissances créée." };
}

export async function deleteKnowledgeBaseAction(fd: FormData) {
  const ctx = await requireOrgAdmin();
  const id = str(fd, "id");
  await db.delete(knowledgeBases).where(and(eq(knowledgeBases.id, id), eq(knowledgeBases.organizationId, ctx.organization.id)));
  await audit({ action: "kb.delete", organizationId: ctx.organization.id, userId: ctx.user.id, targetType: "knowledge_base", targetId: id });
  revalidatePath("/dashboard/sources");
}

// ─────────────────────────── Sources ───────────────────────────
async function processSource(sourceId: string, organizationId: string, fn: () => Promise<{ title: string; content: string; storagePath?: string }>) {
  await db.update(sources).set({ status: "processing" }).where(eq(sources.id, sourceId));
  try {
    const { title, content, storagePath } = await fn();
    const [src] = await db.select().from(sources).where(eq(sources.id, sourceId));
    await ingestDocument({ organizationId, knowledgeBaseId: src.knowledgeBaseId, sourceId, title, content, storagePath });
    await db.update(sources).set({ status: "completed", processedAt: new Date(), errorMessage: null }).where(eq(sources.id, sourceId));
  } catch (e) {
    console.error("[ingest] échec", e);
    await db
      .update(sources)
      .set({ status: "error", errorMessage: safeErrorMessage(e, "Le traitement a échoué.") })
      .where(eq(sources.id, sourceId));
  }
}

async function assertKb(kbId: string, organizationId: string) {
  const [kb] = await db.select().from(knowledgeBases).where(and(eq(knowledgeBases.id, kbId), eq(knowledgeBases.organizationId, organizationId)));
  if (!kb) throw new AppError("Base de connaissances introuvable.", 404);
  return kb;
}

export async function uploadFileAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireOrgAdmin();
  const orgId = ctx.organization.id;
  if (!(await rateLimitAsync(`upload:${orgId}`, 30, 60 * 60_000)).ok) return { error: "Trop d'imports en une heure. Réessayez plus tard." };
  const kbId = str(fd, "knowledgeBaseId");
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Aucun fichier sélectionné." };
  if (file.size > MAX_FILE_BYTES) return { error: `Fichier trop volumineux (max ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} Mo).` };
  if (isDangerousFilename(file.name)) return { error: "Type de fichier non autorisé." };
  try {
    await assertKb(kbId, orgId);
    await assertWithinLimits(orgId, "documents");
    await assertWithinLimits(orgId, "storage", file.size);
    const buffer = Buffer.from(await file.arrayBuffer());
    const kind = detectFileKind(file.name, file.type, buffer.subarray(0, 512));
    if (!kind) return { error: "Format non pris en charge. Formats acceptés : PDF, DOCX, TXT." };
    const safeName = sanitizeFilename(file.name);
    const [src] = await db
      .insert(sources)
      .values({ organizationId: orgId, knowledgeBaseId: kbId, type: "file", name: safeName, mimeType: file.type || kind, sizeBytes: file.size, createdBy: ctx.user.id })
      .returning();
    await processSource(src.id, orgId, async () => {
      const storagePath = `${orgId}/${kbId}/${src.id}-${safeName}`;
      await getStorage().put(storagePath, buffer, file.type || "application/octet-stream");
      const content = kind === "pdf" ? await extractPdf(buffer) : kind === "docx" ? await extractDocx(buffer) : extractTxt(buffer);
      return { title: safeName, content, storagePath };
    });
    await audit({ action: "source.upload", organizationId: orgId, userId: ctx.user.id, targetType: "source", targetId: src.id, meta: { name: safeName, size: file.size } });
  } catch (e) {
    return { error: safeErrorMessage(e) };
  }
  revalidatePath("/dashboard/sources");
  return { success: "Fichier importé et traité." };
}

export async function addUrlAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireOrgAdmin();
  const orgId = ctx.organization.id;
  if (!(await rateLimitAsync(`url:${orgId}`, 30, 60 * 60_000)).ok) return { error: "Trop d'imports en une heure." };
  const kbId = str(fd, "knowledgeBaseId");
  const url = str(fd, "url", 2000);
  try {
    await assertKb(kbId, orgId);
    await assertWithinLimits(orgId, "documents");
    const [src] = await db
      .insert(sources)
      .values({ organizationId: orgId, knowledgeBaseId: kbId, type: "url", name: url, url, createdBy: ctx.user.id })
      .returning();
    await processSource(src.id, orgId, async () => {
      const { title, text } = await extractUrl(url);
      await db.update(sources).set({ name: title.slice(0, 200), sizeBytes: text.length }).where(eq(sources.id, src.id));
      return { title, content: text };
    });
    await audit({ action: "source.url", organizationId: orgId, userId: ctx.user.id, targetType: "source", targetId: src.id, meta: { url } });
  } catch (e) {
    return { error: safeErrorMessage(e) };
  }
  revalidatePath("/dashboard/sources");
  return { success: "Page web ajoutée." };
}

export async function addTextAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireOrgAdmin();
  const orgId = ctx.organization.id;
  const kbId = str(fd, "knowledgeBaseId");
  const type = str(fd, "type") === "qa" ? "qa" : "text";
  let title = str(fd, "title", 200);
  let content: string;
  if (type === "qa") {
    const q = str(fd, "question", 1000);
    const a = String(fd.get("answer") ?? "").trim().slice(0, 20_000);
    if (q.length < 5 || a.length < 2) return { error: "Question et réponse requises." };
    title = title || q;
    content = `Question : ${q}\nRéponse : ${a}`;
  } else {
    content = cleanText(String(fd.get("content") ?? "").slice(0, 200_000));
    if (!title || content.length < 20) return { error: "Titre et contenu (20 caractères min.) requis." };
  }
  try {
    await assertKb(kbId, orgId);
    await assertWithinLimits(orgId, "documents");
    const [src] = await db
      .insert(sources)
      .values({ organizationId: orgId, knowledgeBaseId: kbId, type, name: title, sizeBytes: content.length, createdBy: ctx.user.id })
      .returning();
    await processSource(src.id, orgId, async () => ({ title, content }));
    await audit({ action: `source.${type}`, organizationId: orgId, userId: ctx.user.id, targetType: "source", targetId: src.id });
  } catch (e) {
    return { error: safeErrorMessage(e) };
  }
  revalidatePath("/dashboard/sources");
  return { success: type === "qa" ? "Question-réponse ajoutée." : "Texte ajouté." };
}

export async function deleteSourceAction(fd: FormData) {
  const ctx = await requireOrgAdmin();
  const id = str(fd, "id");
  const [src] = await db.select().from(sources).where(and(eq(sources.id, id), eq(sources.organizationId, ctx.organization.id)));
  if (!src) return;

  const docs = await db
    .select({ storagePath: documents.storagePath })
    .from(documents)
    .where(and(eq(documents.sourceId, id), eq(documents.organizationId, ctx.organization.id)));

  for (const doc of docs) {
    if (doc.storagePath) {
      await getStorage().delete(doc.storagePath).catch(() => {});
    }
  }

  await db.delete(sources).where(eq(sources.id, id));
  await audit({ action: "source.delete", organizationId: ctx.organization.id, userId: ctx.user.id, targetType: "source", targetId: id, meta: { name: src.name } });
  revalidatePath("/dashboard/sources");
}

// ─────────────────────────── Assistants ───────────────────────────
export async function saveAssistantAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireOrgAdmin();
  const orgId = ctx.organization.id;
  const id = str(fd, "id");
  const name = str(fd, "name", 80);
  if (name.length < 2) return { error: "Nom trop court." };
  const kbIds = fd.getAll("knowledgeBaseIds").map(String).filter(Boolean);
  const values = {
    name,
    description: str(fd, "description") || null,
    instructions: String(fd.get("instructions") ?? "").trim().slice(0, 4000) || null,
    welcomeMessage: str(fd, "welcomeMessage", 300) || null,
    model: str(fd, "model", 80) || null,
    language: ["fr", "en", "bm"].includes(str(fd, "language")) ? str(fd, "language") : "fr",
    temperature: Math.min(1, Math.max(0, Number(fd.get("temperature") ?? 0.2) || 0.2)),
    minConfidence: Math.min(0.9, Math.max(0.05, Number(fd.get("minConfidence") ?? 0.22) || 0.22)),
    topK: Math.min(12, Math.max(2, Number(fd.get("topK") ?? 6) || 6)),
  };
  let assistantId = id;
  try {
    const validKbs = kbIds.length
      ? await db.select({ id: knowledgeBases.id }).from(knowledgeBases).where(and(eq(knowledgeBases.organizationId, orgId)))
      : [];
    const allowed = new Set(validKbs.map((k) => k.id));
    const links = kbIds.filter((k) => allowed.has(k));

    await db.transaction(async (tx) => {
      if (id) {
        const [existing] = await tx.select().from(assistants).where(and(eq(assistants.id, id), eq(assistants.organizationId, orgId)));
        if (!existing) throw new AppError("Assistant introuvable.", 404);
        await tx.update(assistants).set(values).where(eq(assistants.id, id));
        await tx.delete(assistantKnowledgeBases).where(eq(assistantKnowledgeBases.assistantId, id));
      } else {
        await assertWithinLimits(orgId, "assistants");
        const [a] = await tx.insert(assistants).values({ ...values, organizationId: orgId, createdBy: ctx.user.id }).returning();
        assistantId = a.id;
      }
      if (links.length) {
        await tx.insert(assistantKnowledgeBases).values(links.map((k) => ({ assistantId, knowledgeBaseId: k, organizationId: orgId })));
      }
    });

    await audit({ action: id ? "assistant.update" : "assistant.create", organizationId: orgId, userId: ctx.user.id, targetType: "assistant", targetId: assistantId });
  } catch (e) {
    return { error: safeErrorMessage(e) };
  }
  revalidatePath("/dashboard/assistants");
  if (!id) redirect(`/dashboard/assistants/${assistantId}`);
  return { success: "Assistant enregistré." };
}

export async function deleteAssistantAction(fd: FormData) {
  const ctx = await requireOrgAdmin();
  const id = str(fd, "id");
  await db.delete(assistants).where(and(eq(assistants.id, id), eq(assistants.organizationId, ctx.organization.id)));
  await audit({ action: "assistant.delete", organizationId: ctx.organization.id, userId: ctx.user.id, targetType: "assistant", targetId: id });
  revalidatePath("/dashboard/assistants");
  redirect("/dashboard/assistants");
}

export async function saveWidgetAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireOrgAdmin();
  const orgId = ctx.organization.id;
  const assistantId = str(fd, "assistantId");
  const [a] = await db.select().from(assistants).where(and(eq(assistants.id, assistantId), eq(assistants.organizationId, orgId)));
  if (!a) return { error: "Assistant introuvable." };
  const domains = str(fd, "allowedDomains", 1000)
    .split(/[\s,]+/)
    .map((d) => d.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, ""))
    .filter(Boolean);
  const values = {
    title: str(fd, "title", 60) || a.name,
    welcomeMessage: str(fd, "welcomeMessage", 300) || null,
    primaryColor: /^#[0-9a-f]{6}$/i.test(str(fd, "primaryColor")) ? str(fd, "primaryColor") : "#1E6FE8",
    position: str(fd, "position") === "left" ? ("left" as const) : ("right" as const),
    allowedDomains: domains,
    isEnabled: fd.get("isEnabled") === "on",
    dailyLimitPerVisitor: Math.min(500, Math.max(1, Number(fd.get("dailyLimitPerVisitor") ?? 30) || 30)),
  };
  const [existing] = await db.select().from(widgetConfigurations).where(eq(widgetConfigurations.assistantId, assistantId));
  if (existing) await db.update(widgetConfigurations).set(values).where(eq(widgetConfigurations.id, existing.id));
  else
    await db.insert(widgetConfigurations).values({ ...values, organizationId: orgId, assistantId, publicKey: "wk_" + randomBytes(16).toString("hex") });
  await audit({ action: "widget.save", organizationId: orgId, userId: ctx.user.id, targetType: "assistant", targetId: assistantId });
  revalidatePath(`/dashboard/assistants/${assistantId}`);
  return { success: "Widget enregistré." };
}

// ─────────────────────────── Conversations ───────────────────────────
export async function createConversationAction(fd: FormData) {
  const ctx = await requireOrgContext();
  const assistantId = str(fd, "assistantId");
  const [a] = await db.select().from(assistants).where(and(eq(assistants.id, assistantId), eq(assistants.organizationId, ctx.organization.id)));
  if (!a) throw new AppError("Assistant introuvable.", 404);
  const [c] = await db
    .insert(conversations)
    .values({ organizationId: ctx.organization.id, assistantId, userId: ctx.user.id, channel: "app", title: "Nouvelle conversation" })
    .returning();
  redirect(`/dashboard/assistants/${assistantId}?c=${c.id}`);
}

export async function deleteConversationAction(fd: FormData) {
  const ctx = await requireOrgContext();
  const id = str(fd, "id");
  const [c] = await db.select().from(conversations).where(and(eq(conversations.id, id), eq(conversations.organizationId, ctx.organization.id)));
  if (!c) return;
  if (c.userId !== ctx.user.id && !ctx.isAdmin) return;
  await db.delete(conversations).where(eq(conversations.id, id));
  revalidatePath("/dashboard/conversations");
}

// ─────────────────────────── Utilisateurs ───────────────────────────
export async function inviteUserAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireOrgAdmin();
  const orgId = ctx.organization.id;
  const email = str(fd, "email", 200).toLowerCase();
  const name = str(fd, "name", 80);
  const role = str(fd, "role") === "admin" ? "admin" : "member";
  const password = String(fd.get("password") ?? "");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "E-mail invalide." };
  try {
    await assertWithinLimits(orgId, "users");
    let [user] = await db.select().from(users).where(eq(users.email, email));
    if (!user) {
      if (password.length < 8 || name.length < 2) return { error: "Nom et mot de passe provisoire (8 caractères min.) requis pour un nouvel utilisateur." };
      [user] = await db.insert(users).values({ email, name, passwordHash: await hashPassword(password) }).returning();
    }
    await db
      .insert(organizationMembers)
      .values({ organizationId: orgId, userId: user.id, role, invitedBy: ctx.user.id })
      .onConflictDoNothing();
    await audit({ action: "member.invite", organizationId: orgId, userId: ctx.user.id, targetType: "user", targetId: user.id, meta: { role } });
  } catch (e) {
    return { error: safeErrorMessage(e) };
  }
  revalidatePath("/dashboard/utilisateurs");
  return { success: "Utilisateur ajouté." };
}

export async function updateMemberRoleAction(fd: FormData) {
  const ctx = await requireOrgAdmin();
  const userId = str(fd, "userId");
  const role = str(fd, "role") === "admin" ? "admin" : "member";
  if (userId === ctx.user.id) return;
  await db
    .update(organizationMembers)
    .set({ role })
    .where(and(eq(organizationMembers.organizationId, ctx.organization.id), eq(organizationMembers.userId, userId)));
  await audit({ action: "member.role", organizationId: ctx.organization.id, userId: ctx.user.id, targetType: "user", targetId: userId, meta: { role } });
  revalidatePath("/dashboard/utilisateurs");
}

export async function removeMemberAction(fd: FormData) {
  const ctx = await requireOrgAdmin();
  const userId = str(fd, "userId");
  if (userId === ctx.user.id) return;
  await db
    .delete(organizationMembers)
    .where(and(eq(organizationMembers.organizationId, ctx.organization.id), eq(organizationMembers.userId, userId)));
  await audit({ action: "member.remove", organizationId: ctx.organization.id, userId: ctx.user.id, targetType: "user", targetId: userId });
  revalidatePath("/dashboard/utilisateurs");
}

// ─────────────────────────── Paramètres ───────────────────────────
export async function updateOrganizationAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireOrgAdmin();
  const name = str(fd, "name", 80);
  if (name.length < 2) return { error: "Nom trop court." };
  await db
    .update(organizations)
    .set({
      name,
      sector: str(fd, "sector", 60) || null,
      city: str(fd, "city", 60) || null,
      phone: str(fd, "phone", 30) || null,
      website: str(fd, "website", 200) || null,
      conversationRetentionDays: Math.min(3650, Math.max(7, Number(fd.get("retention") ?? 365) || 365)),
    })
    .where(eq(organizations.id, ctx.organization.id));
  await audit({ action: "organization.update", organizationId: ctx.organization.id, userId: ctx.user.id });
  revalidatePath("/dashboard/parametres");
  return { success: "Paramètres enregistrés." };
}

export async function updateProfileAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireOrgContext();
  const name = str(fd, "name", 80);
  const password = String(fd.get("password") ?? "");
  const patch: Partial<typeof users.$inferInsert> = {};
  if (name.length >= 2) patch.name = name;

  if (password) {
    if (password.length < 8) return { error: "Mot de passe trop court (8 caractères min.)." };
    patch.passwordHash = await hashPassword(password);
  }

  await db.transaction(async (tx) => {
    await tx.update(users).set(patch).where(eq(users.id, ctx.user.id));
    if (password) {
      // Si mot de passe modifié, révoquer les autres sessions
      await tx.delete(sessions).where(eq(sessions.userId, ctx.user.id));
    }
  });

  revalidatePath("/dashboard/parametres");
  return { success: "Profil mis à jour." };
}

export async function createApiKeyAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireOrgAdmin();
  const name = str(fd, "name", 60) || "Clé API";
  const raw = "hk_" + randomBytes(24).toString("hex");
  await db.insert(apiKeys).values({ organizationId: ctx.organization.id, name, prefix: raw.slice(0, 10), keyHash: sha256(raw), createdBy: ctx.user.id });
  await audit({ action: "apikey.create", organizationId: ctx.organization.id, userId: ctx.user.id });
  revalidatePath("/dashboard/parametres");
  return { success: `Clé créée. Copiez-la maintenant, elle ne sera plus affichée : ${raw}` };
}

export async function revokeApiKeyAction(fd: FormData) {
  const ctx = await requireOrgAdmin();
  await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.id, str(fd, "id")), eq(apiKeys.organizationId, ctx.organization.id)));
  revalidatePath("/dashboard/parametres");
}

export async function deleteOrganizationAction(fd: FormData) {
  const ctx = await requireOrgAdmin();
  if (str(fd, "confirm") !== ctx.organization.slug) return;
  await audit({ action: "organization.delete", organizationId: ctx.organization.id, userId: ctx.user.id, meta: { name: ctx.organization.name } });

  // Suppression des fichiers physiques stockés
  await getStorage().deletePrefix?.(ctx.organization.id).catch(() => {});

  // Suppression en cascade : membres, bases, sources, documents, fragments, vecteurs, conversations, abonnements
  await db.delete(organizations).where(eq(organizations.id, ctx.organization.id));
  redirect("/onboarding");
}

// ─────────────────────────── Paiement manuel ───────────────────────────
export async function declarePaymentAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireOrgAdmin();
  const planId = str(fd, "planId");
  const method = str(fd, "method") as PaymentMethod;
  const months = Math.min(24, Math.max(1, Number(fd.get("months") ?? 1) || 1));
  const reference = str(fd, "reference", 120);
  if (!["orange_money", "moov_money", "bank_transfer", "cash", "other"].includes(method)) return { error: "Moyen de paiement invalide." };
  const [plan] = await db.select().from(plans).where(and(eq(plans.id, planId), eq(plans.isActive, true)));
  if (!plan) return { error: "Offre introuvable." };
  if (reference.length < 4) return { error: "Indiquez la référence de la transaction." };

  // Preuve de paiement facultative (capture d'écran ou reçu)
  let proofUrl: string | null = null;
  const proof = fd.get("proof");
  if (proof instanceof File && proof.size > 0) {
    if (proof.size > 5 * 1024 * 1024) return { error: "La preuve ne doit pas dépasser 5 Mo." };
    const kind = detectFileKind(proof.name, proof.type, new Uint8Array(await proof.slice(0, 512).arrayBuffer()));
    const isImage = ["image/png", "image/jpeg", "image/webp"].includes(proof.type);
    if (!isImage && kind !== "pdf") return { error: "Preuve invalide : image (PNG, JPG, WEBP) ou PDF uniquement." };
    if (isDangerousFilename(proof.name)) return { error: "Nom de fichier non autorisé." };
    try {
      const buffer = Buffer.from(await proof.arrayBuffer());
      const key = `${ctx.organization.id}/paiements/${Date.now()}-${sanitizeFilename(proof.name)}`;
      await getStorage().put(key, buffer, proof.type || "application/octet-stream");
      proofUrl = key;
    } catch (e) {
      return { error: safeErrorMessage(e, "Échec de l'enregistrement de la preuve.") };
    }
  }

  await db.insert(payments).values({
    organizationId: ctx.organization.id,
    planId: plan.id,
    amountXof: plan.priceMonthlyXof * months,
    method,
    reference,
    proofUrl,
    periodMonths: months,
    declaredBy: ctx.user.id,
    notes: str(fd, "notes", 500) || null,
  });
  await audit({ action: "payment.declare", organizationId: ctx.organization.id, userId: ctx.user.id, meta: { plan: plan.code, method, months } });
  revalidatePath("/dashboard/abonnement");
  return { success: "Paiement déclaré. Manden Digital le confirmera sous 24 h ouvrées." };
}
