"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organizations, payments, plans, subscriptions, users } from "@/db/schema";
import { audit, hashPassword, requireSuperAdmin, switchOrganization } from "@/lib/auth";
import { getActiveSubscription } from "@/lib/plans";
import type { ActionState } from "./auth";

const str = (fd: FormData, k: string, max = 500) => String(fd.get(k) ?? "").trim().slice(0, max);
const num = (fd: FormData, k: string, d: number) => {
  const n = Number(fd.get(k));
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : d;
};

export async function savePlanAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireSuperAdmin();
  const id = str(fd, "id");
  const values = {
    name: str(fd, "name", 60),
    code: str(fd, "code", 40).toLowerCase().replace(/[^a-z0-9-]/g, "-"),
    description: str(fd, "description") || null,
    priceMonthlyXof: num(fd, "priceMonthlyXof", 0),
    maxDocuments: num(fd, "maxDocuments", 20),
    maxStorageMb: num(fd, "maxStorageMb", 100),
    maxQuestionsPerMonth: num(fd, "maxQuestionsPerMonth", 200),
    maxUsers: num(fd, "maxUsers", 3),
    maxAssistants: num(fd, "maxAssistants", 1),
    features: str(fd, "features", 2000).split("\n").map((s) => s.trim()).filter(Boolean),
    isActive: fd.get("isActive") === "on",
    sortOrder: num(fd, "sortOrder", 0),
  };
  if (values.name.length < 2 || values.code.length < 2) return { error: "Nom et code requis." };
  if (id) await db.update(plans).set(values).where(eq(plans.id, id));
  else await db.insert(plans).values(values);
  await audit({ action: "admin.plan.save", userId: admin.id, targetType: "plan", targetId: id || values.code });
  revalidatePath("/admin/plans");
  return { success: "Offre enregistrée." };
}

export async function confirmPaymentAction(fd: FormData) {
  const admin = await requireSuperAdmin();
  const id = str(fd, "id");
  const decision = str(fd, "decision") === "reject" ? "rejected" : "confirmed";

  const [p] = await db.select().from(payments).where(eq(payments.id, id));
  if (!p || p.status !== "pending") return;

  await db.transaction(async (tx) => {
    await tx
      .update(payments)
      .set({ status: decision, confirmedBy: admin.id, confirmedAt: new Date() })
      .where(eq(payments.id, id));

    if (decision === "confirmed" && p.planId) {
      const current = await getActiveSubscription(p.organizationId);
      const base =
        current?.subscription.endsAt &&
        current.subscription.endsAt > new Date() &&
        current.subscription.status === "active"
          ? current.subscription.endsAt
          : new Date();
      const endsAt = new Date(base);
      endsAt.setMonth(endsAt.getMonth() + p.periodMonths);

      if (current && current.subscription.planId === p.planId && current.subscription.status !== "cancelled") {
        await tx
          .update(subscriptions)
          .set({ status: "active", endsAt })
          .where(eq(subscriptions.id, current.subscription.id));
        await tx.update(payments).set({ subscriptionId: current.subscription.id }).where(eq(payments.id, id));
      } else {
        if (current) {
          await tx
            .update(subscriptions)
            .set({ status: "cancelled" })
            .where(eq(subscriptions.id, current.subscription.id));
        }
        const [s] = await tx
          .insert(subscriptions)
          .values({
            organizationId: p.organizationId,
            planId: p.planId,
            status: "active",
            endsAt,
            notes: `Paiement ${p.method} ${p.reference ?? ""}`,
          })
          .returning();
        await tx.update(payments).set({ subscriptionId: s.id }).where(eq(payments.id, id));
      }
    }
  });

  await audit({
    action: `admin.payment.${decision}`,
    userId: admin.id,
    organizationId: p.organizationId,
    targetType: "payment",
    targetId: id,
  });

  revalidatePath("/admin/paiements");
  revalidatePath("/admin/organisations");
}

export async function setSubscriptionAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireSuperAdmin();
  const orgId = str(fd, "organizationId");
  const planId = str(fd, "planId");
  const status = str(fd, "status") as "trial" | "active" | "suspended" | "expired" | "cancelled";
  const months = num(fd, "months", 1);
  if (!["trial", "active", "suspended", "expired", "cancelled"].includes(status)) return { error: "Statut invalide." };
  const current = await getActiveSubscription(orgId);
  const endsAt = new Date();
  endsAt.setMonth(endsAt.getMonth() + months);
  if (current && current.subscription.planId === planId) {
    await db
      .update(subscriptions)
      .set({ status, endsAt: status === "suspended" ? current.subscription.endsAt : endsAt, notes: str(fd, "notes") || current.subscription.notes })
      .where(eq(subscriptions.id, current.subscription.id));
  } else {
    if (current) await db.update(subscriptions).set({ status: "cancelled" }).where(eq(subscriptions.id, current.subscription.id));
    await db.insert(subscriptions).values({ organizationId: orgId, planId, status, endsAt, notes: str(fd, "notes") || "Défini manuellement par Manden Digital" });
  }
  await audit({ action: "admin.subscription.set", userId: admin.id, organizationId: orgId, meta: { planId, status, months } });
  revalidatePath(`/admin/organisations/${orgId}`);
  return { success: "Abonnement mis à jour." };
}

export async function toggleOrganizationAction(fd: FormData) {
  const admin = await requireSuperAdmin();
  const id = str(fd, "id");
  const active = str(fd, "active") === "1";
  await db.update(organizations).set({ isActive: active }).where(eq(organizations.id, id));
  await audit({ action: active ? "admin.org.activate" : "admin.org.suspend", userId: admin.id, organizationId: id });
  revalidatePath(`/admin/organisations/${id}`);
  revalidatePath("/admin/organisations");
}

export async function impersonateOrgAction(fd: FormData) {
  const admin = await requireSuperAdmin();
  const id = str(fd, "id");
  await audit({ action: "admin.org.open", userId: admin.id, organizationId: id });
  await switchOrganization(id);
  const { redirect } = await import("next/navigation");
  redirect("/dashboard");
}

export async function createSuperAdminAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireSuperAdmin();
  const email = str(fd, "email", 200).toLowerCase();
  const name = str(fd, "name", 80);
  const password = String(fd.get("password") ?? "");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || name.length < 2 || password.length < 10)
    return { error: "E-mail, nom et mot de passe (10 caractères min.) requis." };
  const [existing] = await db.select().from(users).where(eq(users.email, email));
  if (existing) await db.update(users).set({ isSuperAdmin: true }).where(eq(users.id, existing.id));
  else await db.insert(users).values({ email, name, passwordHash: await hashPassword(password), isSuperAdmin: true });
  await audit({ action: "admin.superadmin.create", userId: admin.id, meta: { email } });
  revalidatePath("/admin");
  return { success: "Super administrateur enregistré." };
}
