"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; icon: string };

export function NavLinks({ items, variant }: { items: Item[]; variant: "side" | "bottom" }) {
  const path = usePathname();
  const isActive = (href: string) => (href === "/dashboard" ? path === "/dashboard" : path.startsWith(href));
  if (variant === "bottom") {
    return (
      <div className="flex overflow-x-auto">
        {items.map((i) => (
          <Link key={i.href} href={i.href} className={`flex min-w-[72px] flex-1 flex-col items-center gap-0.5 px-2 py-2 text-[11px] ${isActive(i.href) ? "text-tech-600 font-semibold" : "text-slate-500"}`}>
            <span className="text-lg leading-none">{i.icon}</span>
            <span className="truncate">{i.label}</span>
          </Link>
        ))}
      </div>
    );
  }
  return (
    <ul className="space-y-1">
      {items.map((i) => (
        <li key={i.href}>
          <Link href={i.href} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${isActive(i.href) ? "bg-white/10 text-white font-semibold" : "text-slate-300 hover:bg-white/5 hover:text-white"}`}>
            <span aria-hidden>{i.icon}</span>{i.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
