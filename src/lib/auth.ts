import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { and, eq, gt } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "crypto";
import { db } from "@/db";
import {
  auditLogs,
  organizationMembers,
  organizations,
  sessions,
  users,
  type OrgRole,
  type Organization,
  type User,
} from "@/db/schema";

export const SESSION_COOKIE = "hakili_session";
const ORG_COOKIE = "hakili_org";
const SESSION_DAYS = Number(process.env.SESSION_MAX_AGE_DAYS ?? 14);

export const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 12);
}
export async function verifyPassword(pw: string, hash: string | null) {
  if (!hash) return false;
  return bcrypt.compare(pw, hash);
}

export async function getClientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "").split(",")[0].trim() || "local";
}

// ────────────── Sessions ──────────────
export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const h = await headers();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await db.insert(sessions).values({
    userId,
    tokenHash: sha256(token),
    expiresAt,
    userAgent: h.get("user-agent")?.slice(0, 255) ?? null,
    ip: await getClientIp(),
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.tokenHash, sha256(token)));
  }
  jar.delete(SESSION_COOKIE);
  jar.delete(ORG_COOKIE);
}

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, sha256(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return rows[0]?.user ?? null;
});

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  return user;
}

export async function requireSuperAdmin(): Promise<User> {
  const user = await requireUser();
  if (!user.isSuperAdmin) redirect("/dashboard");
  return user;
}

// ────────────── Contexte organisation (isolation multi-tenant) ──────────────
export type OrgContext = {
  user: User;
  organization: Organization;
  role: OrgRole;
  isAdmin: boolean;
  memberships: { organization: Organization; role: OrgRole }[];
};

export const getMemberships = cache(async (userId: string) => {
  const rows = await db
    .select({ organization: organizations, role: organizationMembers.role })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
    .where(eq(organizationMembers.userId, userId))
    .orderBy(organizations.name);
  return rows;
});

export const getOrgContext = cache(async (): Promise<OrgContext | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const memberships = await getMemberships(user.id);
  if (memberships.length === 0) return null;
  const jar = await cookies();
  const wanted = jar.get(ORG_COOKIE)?.value;
  const current = memberships.find((m) => m.organization.id === wanted) ?? memberships[0];
  return {
    user,
    organization: current.organization,
    role: current.role,
    isAdmin: current.role === "admin" || user.isSuperAdmin,
    memberships,
  };
});

/** Exige un utilisateur connecté ET rattaché à une organisation. */
export async function requireOrgContext(): Promise<OrgContext> {
  const user = await requireUser();
  const ctx = await getOrgContext();
  if (!ctx) {
    if (user.isSuperAdmin) redirect("/admin");
    redirect("/onboarding");
  }
  if (!ctx.organization.isActive && !user.isSuperAdmin) redirect("/suspendu");
  return ctx;
}

export async function requireOrgAdmin(): Promise<OrgContext> {
  const ctx = await requireOrgContext();
  if (!ctx.isAdmin) redirect("/dashboard");
  return ctx;
}

/** Variante API : renvoie null au lieu de rediriger. */
export async function apiOrgContext(): Promise<OrgContext | null> {
  const ctx = await getOrgContext();
  if (!ctx || (!ctx.organization.isActive && !ctx.user.isSuperAdmin)) return null;
  return ctx;
}

export async function switchOrganization(orgId: string) {
  const jar = await cookies();
  jar.set(ORG_COOKIE, orgId, { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" });
}

// ────────────── Journal d'audit ──────────────
export async function audit(params: {
  action: string;
  organizationId?: string | null;
  userId?: string | null;
  targetType?: string;
  targetId?: string;
  meta?: Record<string, unknown>;
}) {
  try {
    await db.insert(auditLogs).values({
      action: params.action,
      organizationId: params.organizationId ?? null,
      userId: params.userId ?? null,
      targetType: params.targetType,
      targetId: params.targetId,
      meta: params.meta,
      ip: await getClientIp(),
    });
  } catch (e) {
    console.error("[audit] échec de journalisation", e);
  }
}

export function slugify(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
}
