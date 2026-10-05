import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organizationMembers, users } from "@/db/schema";
import { inviteUserAction, removeMemberAction, updateMemberRoleAction } from "@/app/actions/workspace";
import { PageHeader, fmtDate } from "@/components/page-header";
import { ActionForm, ConfirmButton } from "@/components/ui";
import { requireOrgAdmin } from "@/lib/auth";
import { getActiveSubscription } from "@/lib/plans";

export default async function UsersPage() {
  const ctx = await requireOrgAdmin();
  const members = await db
    .select({ m: organizationMembers, u: users })
    .from(organizationMembers)
    .innerJoin(users, eq(users.id, organizationMembers.userId))
    .where(eq(organizationMembers.organizationId, ctx.organization.id))
    .orderBy(organizationMembers.createdAt);
  const sub = await getActiveSubscription(ctx.organization.id);

  return (
    <div>
      <PageHeader title="Utilisateurs" text={`${members.length} membre(s)${sub ? ` sur ${sub.plan.maxUsers} inclus dans l'offre ${sub.plan.name}` : ""}.`} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-1">
          <h2 className="mb-3 font-semibold text-nuit-900">Ajouter un utilisateur</h2>
          <ActionForm action={inviteUserAction} submitLabel="Ajouter" resetOnSuccess>
            <div><label className="label">E-mail</label><input name="email" type="email" required className="input" /></div>
            <div><label className="label">Nom</label><input name="name" className="input" /></div>
            <div><label className="label">Mot de passe provisoire</label><input name="password" type="text" className="input" placeholder="8 caractères min. (nouvel utilisateur)" /></div>
            <div><label className="label">Rôle</label><select name="role" className="input"><option value="member">Collaborateur</option><option value="admin">Administrateur</option></select></div>
            <p className="text-xs text-slate-500">Communiquez le mot de passe provisoire par un canal sûr ; l&apos;utilisateur pourra le modifier dans Paramètres.</p>
          </ActionForm>
        </div>
        <div className="card overflow-hidden lg:col-span-2">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-2">Utilisateur</th><th className="px-4 py-2">Rôle</th><th className="px-4 py-2 hidden sm:table-cell">Depuis</th><th></th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {members.map(({ m, u }) => (
                <tr key={m.id}>
                  <td className="px-4 py-2.5"><p className="font-medium text-slate-800">{u.name}</p><p className="text-xs text-slate-500">{u.email}</p></td>
                  <td className="px-4 py-2.5">
                    {u.id === ctx.user.id ? <span className="badge bg-tech-100 text-tech-700">{m.role === "admin" ? "Administrateur" : "Collaborateur"} (vous)</span> : (
                      <form action={updateMemberRoleAction} className="flex items-center gap-1">
                        <input type="hidden" name="userId" value={u.id} />
                        <select name="role" defaultValue={m.role} className="input py-1 text-xs"><option value="member">Collaborateur</option><option value="admin">Administrateur</option></select>
                        <button className="btn-ghost px-2 py-1 text-xs">OK</button>
                      </form>
                    )}
                  </td>
                  <td className="px-4 py-2.5 hidden sm:table-cell text-slate-500">{fmtDate(m.createdAt)}</td>
                  <td className="px-2 py-2.5">{u.id !== ctx.user.id && <form action={removeMemberAction}><input type="hidden" name="userId" value={u.id} /><ConfirmButton className="btn-ghost px-2 py-1 text-xs text-red-600" message={`Retirer ${u.name} de l'organisation ?`}>Retirer</ConfirmButton></form>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
