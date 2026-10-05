"use server";

import { redirect } from "next/navigation";
import { and, eq, gt, isNull } from "drizzle-orm";
import { randomBytes } from "crypto";
import { z } from "zod";
import { db } from "@/db";
import { organizationMembers, organizations, passwordResets, subscriptions, plans, users, sessions } from "@/db/schema";
import {
  audit,
  createSession,
  destroySession,
  getClientIp,
  hashPassword,
  requireUser,
  sha256,
  slugify,
  switchOrganization,
  verifyPassword,
  getMemberships,
} from "@/lib/auth";
import { rateLimitAsync, safeErrorMessage } from "@/lib/security";
import { ensureDefaultPlans } from "@/lib/plans";
import { buildPasswordResetEmail, sendEmail } from "@/lib/email";

export type ActionState = { error?: string; success?: string } | undefined;

const registerSchema = z.object({
  name: z.string().trim().min(2, "Nom trop court").max(80),
  email: z.string().trim().toLowerCase().email("E-mail invalide"),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères").max(128),
  organization: z.string().trim().min(2, "Nom d'organisation trop court").max(80),
  sector: z.string().trim().max(60).optional(),
});

export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ip = await getClientIp();
  if (!(await rateLimitAsync(`register:${ip}`, 5, 15 * 60_000)).ok) {
    return { error: "Trop de tentatives d'inscription. Réessayez dans quelques minutes." };
  }

  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, email, password, organization, sector } = parsed.data;

  let createdUserId: string | null = null;
  let createdOrgId: string | null = null;

  try {
    await ensureDefaultPlans();

    // Transaction atomique complète pour la création du compte, de l'organisation et de l'essai
    await db.transaction(async (tx) => {
      const dup = await tx.select({ id: users.id }).from(users).where(eq(users.email, email));
      if (dup.length) {
        throw new Error("Un compte existe déjà avec cette adresse e-mail.");
      }

      const [user] = await tx
        .insert(users)
        .values({
          name,
          email,
          passwordHash: await hashPassword(password),
        })
        .returning();

      let slug = slugify(organization) || "organisation";
      const existing = await tx.select({ id: organizations.id }).from(organizations).where(eq(organizations.slug, slug));
      if (existing.length) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;

      const [org] = await tx
        .insert(organizations)
        .values({
          name: organization,
          slug,
          sector: sector || null,
        })
        .returning();

      await tx.insert(organizationMembers).values({
        organizationId: org.id,
        userId: user.id,
        role: "admin",
      });

      const [essentiel] = await tx.select().from(plans).where(eq(plans.code, "essentiel"));
      const trialDays = Number(process.env.TRIAL_DAYS ?? 14);

      if (essentiel) {
        await tx.insert(subscriptions).values({
          organizationId: org.id,
          planId: essentiel.id,
          status: "trial",
          endsAt: new Date(Date.now() + trialDays * 86400_000),
          notes: `Essai gratuit ${trialDays} jours`,
        });
      }

      createdUserId = user.id;
      createdOrgId = org.id;
    });

    if (createdUserId && createdOrgId) {
      await audit({
        action: "user.register",
        userId: createdUserId,
        organizationId: createdOrgId,
        targetType: "organization",
        targetId: createdOrgId,
      });
      await createSession(createdUserId);
      await switchOrganization(createdOrgId);
    }
  } catch (e) {
    return { error: safeErrorMessage(e) };
  }

  redirect("/dashboard");
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ip = await getClientIp();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!(await rateLimitAsync(`login:${ip}`, 10, 15 * 60_000)).ok || !(await rateLimitAsync(`login:${email}`, 8, 15 * 60_000)).ok) {
    return { error: "Trop de tentatives de connexion. Réessayez dans 15 minutes." };
  }

  if (!email || !password) return { error: "E-mail et mot de passe requis." };

  const [user] = await db.select().from(users).where(eq(users.email, email));
  const ok = user ? await verifyPassword(password, user.passwordHash) : false;

  if (!user || !ok) {
    await audit({ action: "auth.login_failed", meta: { email } });
    return { error: "Identifiants incorrects." };
  }

  await createSession(user.id);
  await audit({ action: "auth.login", userId: user.id });

  const memberships = await getMemberships(user.id);
  if (memberships.length === 0 && user.isSuperAdmin) redirect("/admin");
  if (memberships.length === 0) redirect("/onboarding");

  await switchOrganization(memberships[0].organization.id);
  redirect("/dashboard");
}

export async function logoutAction() {
  await destroySession();
  redirect("/connexion");
}

export async function switchOrgAction(formData: FormData) {
  const user = await requireUser();
  const orgId = String(formData.get("orgId") ?? "");
  const memberships = await getMemberships(user.id);
  if (memberships.some((m) => m.organization.id === orgId) || user.isSuperAdmin) {
    await switchOrganization(orgId);
  }
  redirect("/dashboard");
}

export async function onboardingAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const name = String(formData.get("organization") ?? "").trim();
  const sector = String(formData.get("sector") ?? "").trim();
  if (name.length < 2) return { error: "Nom d'organisation trop court." };

  let createdOrgId: string | null = null;
  try {
    await ensureDefaultPlans();
    await db.transaction(async (tx) => {
      let slug = slugify(name) || "organisation";
      const existing = await tx.select({ id: organizations.id }).from(organizations).where(eq(organizations.slug, slug));
      if (existing.length) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;

      const [org] = await tx.insert(organizations).values({ name, slug, sector: sector || null }).returning();
      await tx.insert(organizationMembers).values({ organizationId: org.id, userId: user.id, role: "admin" });

      const [essentiel] = await tx.select().from(plans).where(eq(plans.code, "essentiel"));
      const trialDays = Number(process.env.TRIAL_DAYS ?? 14);

      if (essentiel) {
        await tx.insert(subscriptions).values({
          organizationId: org.id,
          planId: essentiel.id,
          status: "trial",
          endsAt: new Date(Date.now() + trialDays * 86400_000),
          notes: `Essai gratuit ${trialDays} jours`,
        });
      }
      createdOrgId = org.id;
    });

    if (createdOrgId) {
      await audit({ action: "organization.create", userId: user.id, organizationId: createdOrgId });
      await switchOrganization(createdOrgId);
    }
  } catch (e) {
    return { error: safeErrorMessage(e) };
  }
  redirect("/dashboard");
}

// ─────────────────────────── Mot de passe oublié ───────────────────────────
export async function requestPasswordResetAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ip = await getClientIp();
  if (!(await rateLimitAsync(`reset-req:${ip}`, 5, 15 * 60_000)).ok) {
    return { error: "Trop de demandes de réinitialisation. Réessayez dans quelques minutes." };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "E-mail invalide." };

  const genericResponse = {
    success: "Si un compte existe pour cet e-mail, un lien de réinitialisation a été envoyé à votre adresse.",
  };

  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user) return genericResponse;

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 60 * 60_000); // 1 heure

  await db.insert(passwordResets).values({
    userId: user.id,
    tokenHash: sha256(token),
    expiresAt,
  });

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://hakili.mandendigital.com").replace(/\/$/, "");
  const resetUrl = `${appUrl}/reinitialiser?token=${token}`;

  await audit({ action: "auth.reset_requested", userId: user.id, meta: { email } });

  const emailPayload = buildPasswordResetEmail(resetUrl);
  await sendEmail({
    to: email,
    subject: emailPayload.subject,
    text: emailPayload.text,
    html: emailPayload.html,
  });

  if (process.env.NODE_ENV !== "production" && process.env.SHOW_RESET_LINK === "true") {
    return { success: `Lien généré (mode test) : ${resetUrl}` };
  }

  return genericResponse;
}

export async function resetPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) return { error: "Le mot de passe doit contenir au moins 8 caractères." };
  if (password !== confirm) return { error: "Les deux mots de passe ne correspondent pas." };
  if (!token) return { error: "Lien de réinitialisation manquant ou invalide." };

  const tokenHash = sha256(token);
  let targetUserId: string | null = null;

  try {
    await db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(passwordResets)
        .where(
          and(
            eq(passwordResets.tokenHash, tokenHash),
            isNull(passwordResets.usedAt),
            gt(passwordResets.expiresAt, new Date()),
          ),
        );

      if (!row) {
        throw new Error("Ce lien de réinitialisation est invalide ou a expiré.");
      }

      const newHash = await hashPassword(password);
      await tx.update(users).set({ passwordHash: newHash }).where(eq(users.id, row.userId));
      await tx.update(passwordResets).set({ usedAt: new Date() }).where(eq(passwordResets.id, row.id));

      // Révocation de toutes les sessions existantes pour forcer une nouvelle connexion sécurisée
      await tx.delete(sessions).where(eq(sessions.userId, row.userId));
      targetUserId = row.userId;
    });

    if (targetUserId) {
      await audit({ action: "auth.reset_completed", userId: targetUserId });
    }
  } catch (e) {
    return { error: safeErrorMessage(e) };
  }

  redirect("/connexion?reinitialise=1");
}
