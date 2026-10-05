"use client";

import { useState } from "react";
import Link from "next/link";

type Item = { href: string; label: string };

export function MobileMenu({ items }: { items: Item[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
        aria-expanded={open}
        aria-controls="menu-mobile"
        className="btn-ghost p-2"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>}
        </svg>
      </button>
      {open && (
        <div id="menu-mobile" className="absolute inset-x-0 top-full border-b border-slate-100 bg-white shadow-lg animate-fade-in">
          <nav className="mx-auto flex max-w-7xl flex-col px-4 py-2">
            {items.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {n.label}
              </Link>
            ))}
            <div className="my-2 border-t border-slate-100" />
            <Link href="/connexion" onClick={() => setOpen(false)} className="btn-secondary my-1">Connexion</Link>
            <Link href="/inscription" onClick={() => setOpen(false)} className="btn-primary my-1">Créer mon assistant</Link>
          </nav>
        </div>
      )}
    </div>
  );
}
