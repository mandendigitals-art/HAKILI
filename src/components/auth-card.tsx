import Link from "next/link";
import type { ReactNode } from "react";
import { Logo, MandenMention } from "./brand";

export function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-nuit-900 via-nuit-800 to-tech-700 px-4 py-10 flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center"><Logo light size="lg" /></div>
        <div className="card p-6 sm:p-8 animate-fade-in">
          <h1 className="text-xl font-bold text-nuit-900">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
          <div className="mt-6">{children}</div>
          {footer && <div className="mt-6 border-t border-slate-100 pt-4 text-center text-sm text-slate-600">{footer}</div>}
        </div>
        <div className="mt-6 flex items-center justify-center gap-4 text-xs text-slate-300">
          <MandenMention light />
          <Link href="/" className="hover:text-white">← Retour au site</Link>
        </div>
      </div>
    </div>
  );
}
