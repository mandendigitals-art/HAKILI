"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { audit, getClientIp, requireSuperAdmin } from "@/lib/auth";
import { rateLimitAsync, safeErrorMessage } from "@/lib/security";
import type { ActionState } from "./auth";

const phoneRe = /^[+\d][\d\s().-]{5,25}$/;

const contactSchema = z.object({
  fullName: z.string().trim().min(2, "Nom trop court").max(120),
  email: z.string().trim().toLowerCase().email("E-mail invalide"),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  organization: z.string().trim().max(120).optional().or(z.literal("")),
  message: z.string().trim().min(5, "Message trop court").max(4000),
});

const demoSchema = contactSchema.extend({
  phone: z.string().trim().regex(phoneRe, "Téléphone / WhatsApp invalide").max(30),
  sector: z.string().trim().max(80).optional().or(z.literal("")),
  mode: z.enum(["presentiel", "visio"]),
  preferredDate: z.string().trim().max(40).optional().or(z.literal("")),
  message: z.string().trim().max(4000).optional().or(z.literal("")),
});

export async function submitContactAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ip = await getClientIp();
  if (!(await rateLimitAsync(`lead:${ip}`, 6, 60 * 60_000)).ok) return { error: "Trop d'envois. Réessayez plus tard ou écrivez-nous directement." };
  const parsed = contactSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  try {
    await db.insert(leads).values({
      kind: "contact",
      fullName: d.fullName,
      email: d.email,
      phone: d.phone || null,
      organization: d.organization || null,
      message: d.message,
      ip,
    });
    await audit({ action: "lead.contact", meta: { email: d.email } });
  } catch (e) {
    return { error: safeErrorMessage(e) };
  }
  return { success: "Message envoyé. Notre équipe vous répondra sous 48 h ouvrées." };
}

export async function submitDemoAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ip = await getClientIp();
  if (!(await rateLimitAsync(`lead:${ip}`, 6, 60 * 60_000)).ok) return { error: "Trop d'envois. Réessayez plus tard ou écrivez-nous directement." };
  const parsed = demoSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  try {
    await db.insert(leads).values({
      kind: "demo",
      fullName: d.fullName,
      email: d.email,
      phone: d.phone,
      organization: d.organization || null,
      sector: d.sector || null,
      mode: d.mode,
      preferredDate: d.preferredDate || null,
      message: d.message || null,
      ip,
    });
    await audit({ action: "lead.demo", meta: { email: d.email, mode: d.mode } });
  } catch (e) {
    return { error: safeErrorMessage(e) };
  }
  return { success: "Demande de démonstration envoyée. Nous vous contacterons sous 48 h ouvrées pour convenir d'un créneau." };
}

// ─────────────────────────── Administration ───────────────────────────
export async function updateLeadStatusAction(fd: FormData) {
  const admin = await requireSuperAdmin();
  const id = String(fd.get("id") ?? "");
  const status = String(fd.get("status") ?? "");
  if (!["new", "in_progress", "done", "archived"].includes(status)) return;
  await db
    .update(leads)
    .set({ status: status as "new" | "in_progress" | "done" | "archived", handledBy: admin.id })
    .where(eq(leads.id, id));
  await audit({ action: "admin.lead.status", userId: admin.id, targetType: "lead", targetId: id, meta: { status } });
  revalidatePath("/admin/demandes");
}
