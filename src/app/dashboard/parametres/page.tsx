import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { createApiKeyAction, deleteOrganizationAction, revokeApiKeyAction, updateOrganizationAction, updateProfileAction } from "@/app/actions/workspace";
import { PageHeader, fmtDate } from "@/components/page-header";
import { ActionForm, ConfirmButton } from "@/components/ui";
import { requireOrgContext } from "@/lib/auth";
import { describeAiSetup } from "@/lib/ai/provider";

export default async function SettingsPage() {
  const ctx = await requireOrgContext();
  const org = ctx.organization;
  const keys = ctx.isAdmin ? await db.select().from(apiKeys).where(and(eq(apiKeys.organizationId, org.id), isNull(apiKeys.revokedAt))).orderBy(desc(apiKeys.createdAt)) : [];
  const ai = describeAiSetup();

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Paramètres" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-3 font-semibold text-nuit-900">Mon profil</h2>
          <ActionForm action={updateProfileAction} submitLabel="Mettre à jour">
            <div><label className="label">Nom</label><input name="name" defaultValue={ctx.user.name} className="input" /></div>
            <div><label className="label">E-mail</label><input value={ctx.user.email} disabled className="input bg-slate-50" /></div>
            <div><label className="label">Nouveau mot de passe</label><input name="password" type="password" autoComplete="new-password" className="input" placeholder="Laisser vide pour conserver" /></div>
          </ActionForm>
        </div>

        {ctx.isAdmin && (
          <div className="card p-5">
            <h2 className="mb-3 font-semibold text-nuit-900">Organisation</h2>
            <ActionForm action={updateOrganizationAction} submitLabel="Enregistrer">
              <div><label className="label">Nom</label><input name="name" defaultValue={org.name} required className="input" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Secteur</label><input name="sector" defaultValue={org.sector ?? ""} className="input" /></div>
                <div><label className="label">Ville</label><input name="city" defaultValue={org.city ?? ""} className="input" /></div>
                <div><label className="label">Téléphone</label><input name="phone" defaultValue={org.phone ?? ""} className="input" /></div>
                <div><label className="label">Site web</label><input name="website" defaultValue={org.website ?? ""} className="input" /></div>
              </div>
              <div><label className="label">Conservation des conversations (jours)</label><input name="retention" type="number" min="7" max="3650" defaultValue={org.conversationRetentionDays} className="input" /><p className="mt-1 text-xs text-slate-500">Les conversations plus anciennes sont purgées par la tâche de maintenance (npm run purge).</p></div>
            </ActionForm>
          </div>
        )}

        {ctx.isAdmin && (
          <div className="card p-5">
            <h2 className="font-semibold text-nuit-900">Clés API</h2>
            <p className="mt-1 text-sm text-slate-500">Pour interroger vos assistants depuis vos propres outils : <code className="text-xs">POST /api/v1/ask</code> avec l&apos;en-tête <code className="text-xs">Authorization: Bearer hk_…</code></p>
            <div className="mt-3"><ActionForm action={createApiKeyAction} submitLabel="Générer une clé" submitClassName="btn-secondary" className="flex flex-col gap-2 sm:flex-row sm:items-end"><div className="flex-1"><label className="label">Nom</label><input name="name" className="input" placeholder="Ex. : Intégration CRM" /></div></ActionForm></div>
            <ul className="mt-3 divide-y divide-slate-100 text-sm">
              {keys.map((k) => <li key={k.id} className="flex items-center justify-between py-2"><span>{k.name} <code className="text-xs text-slate-500">{k.prefix}…</code><span className="block text-xs text-slate-400">Créée le {fmtDate(k.createdAt)}{k.lastUsedAt ? ` · utilisée le ${fmtDate(k.lastUsedAt)}` : ""}</span></span><form action={revokeApiKeyAction}><input type="hidden" name="id" value={k.id} /><ConfirmButton className="btn-ghost px-2 py-1 text-xs text-red-600" message="Révoquer cette clé ?">Révoquer</ConfirmButton></form></li>)}
            </ul>
          </div>
        )}

        {ctx.isAdmin && (
          <div className="card p-5">
            <h2 className="font-semibold text-nuit-900">Données et confidentialité</h2>
            <p className="mt-1 text-sm text-slate-500">Moteur IA actuel : <strong>{ai.llm}</strong> · Embeddings : <strong>{ai.embeddings}</strong></p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a href="/api/export" download="hakili-export.json" className="btn-secondary">Exporter toutes mes données (JSON)</a>
            </div>
            <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4">
              <h3 className="font-semibold text-red-700">Supprimer définitivement l&apos;organisation</h3>
              <p className="mt-1 text-sm text-slate-600">Efface documents, vecteurs, assistants, conversations, utilisateurs rattachés et abonnement. Irréversible. Tapez <code>{org.slug}</code> pour confirmer.</p>
              <form action={deleteOrganizationAction} className="mt-3 flex flex-col gap-2 sm:flex-row"><input name="confirm" className="input sm:max-w-xs" placeholder={org.slug} /><ConfirmButton message="Suppression définitive de toutes les données. Continuer ?">Supprimer l&apos;organisation</ConfirmButton></form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
