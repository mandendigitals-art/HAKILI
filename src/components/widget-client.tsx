"use client";

import { useState } from "react";
import { Chat, type ChatMsg } from "@/components/chat";
import { HakiliSymbol } from "@/components/brand";

function ensureVisitorId() {
  if (typeof window === "undefined") return "";
  let v = localStorage.getItem("hakili_visitor");
  if (!v) {
    v = "v_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("hakili_visitor", v);
  }
  return v;
}

export function WidgetClient({ publicKey, title, welcome, color }: { publicKey: string; title: string; welcome: string; color: string }) {
  // Initialiseurs lazy : exécutés une seule fois côté client, sans effet.
  const [visitorId] = useState<string>(ensureVisitorId);
  const [convId] = useState<string | null>(() =>
    typeof window === "undefined" ? null : sessionStorage.getItem(`hakili_conv_${publicKey}`),
  );
  const initial: ChatMsg[] = [];

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      <header className="flex items-center gap-2 px-4 py-3 text-white" style={{ backgroundColor: color }}>
        <HakiliSymbol size={26} />
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{title}</p><p className="text-[11px] opacity-80">Répond à partir de nos documents</p></div>
      </header>
      <div className="min-h-0 flex-1">
        {visitorId && (
          <Chat endpoint={`/api/widget/${publicKey}/chat`} body={{ visitorId }} initialMessages={initial} conversationId={convId} welcome={welcome} compact primaryColor={color}
            onConversation={(id) => sessionStorage.setItem(`hakili_conv_${publicKey}`, id)} />
        )}
      </div>
      <footer className="border-t border-slate-200 bg-white px-3 py-1.5 text-center text-[10px] text-slate-400">Propulsé par <a href="https://mandendigital.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-slate-600">HAKILI</a> · Une solution Manden Digital</footer>
    </div>
  );
}
