import type { ReactNode } from "react";
import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { Logo } from "@/components/brand";
import { NavLinks } from "@/components/nav-links";
import { requireSuperAdmin } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireSuperAdmin();
  const items = [
    { href: "/admin", label: "Vue globale", icon: "📈" },
    { href: "/admin/organisations", label: "Entreprises", icon: "🏢" },
    { href: "/admin/paiements", label: "Paiements", icon: "💰" },
    { href: "/admin/demandes", label: "Demandes", icon: "📨" },
    { href: "/admin/plans", label: "Offres", icon: "🧾" },
    { href: "/admin/journal", label: "Journal", icon: "📜" },
  ];
  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-nuit-950 text-slate-200">
        <div className="px-5 py-5 border-b border-white/10"><Logo href="/admin" light size="sm" /><p className="mt-1 text-xs text-orange-400 font-semibold uppercase tracking-wider">Administration Manden Digital</p></div>
        <nav className="flex-1 px-3 py-4"><NavLinks items={items} variant="side" /></nav>
        <div className="px-5 py-4 border-t border-white/10 space-y-2 text-sm">
          <p className="truncate text-xs text-slate-400">{user.email}</p>
          <Link href="/dashboard" className="block text-slate-300 hover:text-white">← Espace client</Link>
          <form action={logoutAction}><button className="text-slate-400 hover:text-white">Se déconnecter</button></form>
        </div>
      </aside>
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen">
        <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3"><Logo href="/admin" size="sm" /><span className="text-xs font-semibold text-orange-600">ADMIN</span></header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 pb-24 lg:pb-8">{children}</main>
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-slate-200 bg-white"><NavLinks items={items} variant="bottom" /></nav>
      </div>
    </div>
  );
}
