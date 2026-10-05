import type { ReactNode } from "react";
import Link from "next/link";
import { logoutAction, switchOrgAction } from "@/app/actions/auth";
import { Logo, MandenMention } from "@/components/brand";
import { NavLinks } from "@/components/nav-links";
import { requireOrgContext } from "@/lib/auth";
import { getActiveSubscription } from "@/lib/plans";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const ctx = await requireOrgContext();
  const sub = await getActiveSubscription(ctx.organization.id);
  const items = [
    { href: "/dashboard", label: "Accueil", icon: "🏠" },
    { href: "/dashboard/assistants", label: "Mes assistants", icon: "🤖" },
    { href: "/dashboard/sources", label: "Sources", icon: "📚", admin: true },
    { href: "/dashboard/conversations", label: "Conversations", icon: "💬" },
    { href: "/dashboard/utilisateurs", label: "Utilisateurs", icon: "👥", admin: true },
    { href: "/dashboard/consommation", label: "Consommation", icon: "📊", admin: true },
    { href: "/dashboard/abonnement", label: "Abonnement", icon: "💳", admin: true },
    { href: "/dashboard/parametres", label: "Paramètres", icon: "⚙️" },
  ].filter((i) => !i.admin || ctx.isAdmin);
  if (ctx.user.isSuperAdmin) items.push({ href: "/admin", label: "Administration", icon: "🛡️" });

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-nuit-900 text-slate-200">
        <div className="px-5 py-5 border-b border-white/10"><Logo href="/dashboard" light size="sm" /></div>
        <div className="px-4 py-4 border-b border-white/10">
          {ctx.memberships.length > 1 ? (
            <form action={switchOrgAction}>
              <select name="orgId" defaultValue={ctx.organization.id} className="w-full rounded-md bg-white/10 px-2 py-1.5 text-sm text-white" onChange={undefined}>
                {ctx.memberships.map((m) => <option key={m.organization.id} value={m.organization.id} className="text-slate-900">{m.organization.name}</option>)}
              </select>
              <button className="mt-2 w-full text-xs text-slate-400 hover:text-white">Changer d&apos;organisation</button>
            </form>
          ) : (
            <p className="truncate text-sm font-semibold text-white">{ctx.organization.name}</p>
          )}
          <p className="mt-1 text-xs text-slate-400">{ctx.isAdmin ? "Administrateur" : "Collaborateur"} · {sub ? `${sub.plan.name} (${sub.subscription.status === "trial" ? "essai" : sub.subscription.status === "active" ? "actif" : sub.subscription.status})` : "Sans abonnement"}</p>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4"><NavLinks items={items} variant="side" /></nav>
        <div className="px-5 py-4 border-t border-white/10 space-y-2">
          <p className="truncate text-xs text-slate-300">{ctx.user.email}</p>
          <form action={logoutAction}><button className="text-sm text-slate-400 hover:text-white">Se déconnecter</button></form>
          <MandenMention light />
        </div>
      </aside>

      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen">
        <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          <Logo href="/dashboard" size="sm" />
          <div className="flex items-center gap-3">
            <span className="max-w-[140px] truncate text-xs font-medium text-slate-600">{ctx.organization.name}</span>
            <form action={logoutAction}><button className="text-xs text-slate-500">Quitter</button></form>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 pb-24 lg:pb-8">{children}</main>
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-slate-200 bg-white"><NavLinks items={items} variant="bottom" /></nav>
      </div>
    </div>
  );
}
