import type { ReactNode } from "react";

export function PageHeader({ title, text, actions }: { title: string; text?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-nuit-900">{title}</h1>
        {text && <p className="mt-1 text-sm text-slate-500">{text}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-nuit-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    pending: ["En attente", "bg-slate-100 text-slate-700"],
    processing: ["Traitement", "bg-amber-100 text-amber-800"],
    completed: ["Terminé", "bg-emerald-100 text-emerald-800"],
    error: ["Erreur", "bg-red-100 text-red-700"],
    trial: ["Essai", "bg-tech-100 text-tech-700"],
    active: ["Actif", "bg-emerald-100 text-emerald-800"],
    suspended: ["Suspendu", "bg-red-100 text-red-700"],
    expired: ["Expiré", "bg-slate-200 text-slate-700"],
    cancelled: ["Annulé", "bg-slate-200 text-slate-700"],
    confirmed: ["Confirmé", "bg-emerald-100 text-emerald-800"],
    rejected: ["Rejeté", "bg-red-100 text-red-700"],
  };
  const [label, cls] = map[status] ?? [status, "bg-slate-100 text-slate-700"];
  return <span className={`badge ${cls}`}>{label}</span>;
}

export const fmtDate = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—";
export const fmtDateTime = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
