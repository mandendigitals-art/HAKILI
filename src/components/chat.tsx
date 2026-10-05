"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type ChatCitation = { rank: number; sourceName: string; snippet: string; score?: number; chunkId?: string | null };
export type ChatMsg = { id: string; role: "user" | "assistant"; content: string; citations?: ChatCitation[]; refused?: boolean; confidence?: number | null };

type Props = {
  endpoint: string;
  body: Record<string, unknown>;
  initialMessages: ChatMsg[];
  conversationId: string | null;
  welcome?: string | null;
  compact?: boolean;
  primaryColor?: string;
  onConversation?: (id: string) => void;
  showConfidence?: boolean;
  canPreview?: boolean;
};

function renderContent(text: string, onCite?: (n: number) => void) {
  const parts = text.split(/(\[\d+\])/g);
  return parts.map((p, i) => {
    const m = p.match(/^\[(\d+)\]$/);
    if (m) {
      const n = Number(m[1]);
      return (
        <button key={i} type="button" onClick={() => onCite?.(n)} className="mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded bg-orange-100 px-1 text-[11px] font-bold text-orange-700 hover:bg-orange-200 align-text-top">
          {n}
        </button>
      );
    }
    return <span key={i} className="whitespace-pre-wrap">{p.replace(/\*\*(.*?)\*\*/g, "$1")}</span>;
  });
}

export function Chat({ endpoint, body, initialMessages, conversationId, welcome, compact, primaryColor = "#1e6fe8", onConversation, showConfidence, canPreview }: Props) {
  const [messages, setMessages] = useState<ChatMsg[]>(initialMessages);
  const [convId, setConvId] = useState<string | null>(conversationId);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openCite, setOpenCite] = useState<{ msgId: string; rank: number } | null>(null);
  const [preview, setPreview] = useState<{ title: string; content: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    setMessages(initialMessages);
    setConvId(conversationId);
  }, [initialMessages, conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const q = input.trim();
    if (!q || loading) return;
    setError(null);
    setInput("");
    const tempId = "tmp-" + Date.now();
    setMessages((m) => [...m, { id: tempId, role: "user", content: q }]);
    setLoading(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, conversationId: convId, question: q }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Erreur inconnue");
      const isNew = !convId;
      setConvId(j.conversationId);
      setMessages((m) => [
        ...m.map((x) => (x.id === tempId ? { ...x, id: j.userMessageId ?? tempId } : x)),
        { id: j.assistantMessageId ?? "a-" + Date.now(), role: "assistant", content: j.answer, citations: j.citations ?? [], refused: j.refused, confidence: j.confidence },
      ]);
      if (isNew) {
        onConversation?.(j.conversationId);
        if (!compact) router.replace(`?c=${j.conversationId}`, { scroll: false });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  async function openPreview(c: ChatCitation) {
    if (!canPreview || !c.chunkId) return;
    try {
      const res = await fetch(`/api/chunks/${c.chunkId}`);
      if (!res.ok) throw new Error();
      const j = await res.json();
      setPreview({ title: `${j.sourceName} — passage n° ${j.index + 1}`, content: j.content });
    } catch {
      setPreview({ title: c.sourceName, content: c.snippet });
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className={`flex-1 overflow-y-auto ${compact ? "p-3" : "p-4"} space-y-4`}>
        {messages.length === 0 && (
          <div className="mx-auto max-w-md rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700">{welcome || "Bonjour ! Posez une question sur vos documents."}</div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}>
            <div className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${m.role === "user" ? "rounded-br-sm text-white" : m.refused ? "rounded-bl-sm border border-amber-200 bg-amber-50 text-amber-900" : "rounded-bl-sm border border-slate-200 bg-white text-slate-800"}`}
              style={m.role === "user" ? { backgroundColor: primaryColor } : undefined}>
              <div className="leading-relaxed">{m.role === "assistant" ? renderContent(m.content, (n) => setOpenCite({ msgId: m.id, rank: n })) : m.content}</div>
              {m.role === "assistant" && showConfidence && typeof m.confidence === "number" && (
                <p className="mt-1.5 text-[11px] text-slate-400">Confiance : {(m.confidence * 100).toFixed(0)} %</p>
              )}
              {m.citations && m.citations.length > 0 && (
                <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Sources</p>
                  {m.citations.map((c) => {
                    const open = openCite?.msgId === m.id && openCite.rank === c.rank;
                    return (
                      <div key={c.rank} className="rounded-lg bg-slate-50 text-xs">
                        <button type="button" onClick={() => setOpenCite(open ? null : { msgId: m.id, rank: c.rank })} className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left">
                          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded bg-orange-100 px-1 font-bold text-orange-700">{c.rank}</span>
                          <span className="flex-1 truncate font-medium text-slate-700">{c.sourceName}</span>
                          <span className="text-slate-400">{open ? "▲" : "▼"}</span>
                        </button>
                        {open && (
                          <div className="border-t border-slate-200 px-2.5 py-2 text-slate-600">
                            <p className="italic leading-relaxed">« {c.snippet.slice(0, 400)}{c.snippet.length > 400 ? "…" : ""} »</p>
                            {canPreview && c.chunkId && (
                              <button type="button" onClick={() => openPreview(c)} className="mt-1.5 font-semibold text-tech-600 hover:underline">Voir le passage complet</button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start"><div className="typing rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-4 py-3 text-slate-400"><span>●</span> <span>●</span> <span>●</span></div></div>
        )}
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={send} className={`border-t border-slate-200 bg-white ${compact ? "p-2" : "p-3"}`}>
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
            rows={1}
            maxLength={2000}
            placeholder="Posez votre question…"
            className="input max-h-32 min-h-[44px] resize-none"
            aria-label="Votre question"
          />
          <button type="submit" disabled={loading || !input.trim()} className="btn-primary h-[44px] px-4" style={{ backgroundColor: primaryColor }} aria-label="Envoyer">➤</button>
        </div>
      </form>

      {preview && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-nuit-950/50 p-4 sm:items-center" onClick={() => setPreview(null)}>
          <div className="card max-h-[80vh] w-full max-w-2xl overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <h3 className="font-semibold text-nuit-900">{preview.title}</h3>
              <button type="button" className="btn-ghost px-2 py-1" onClick={() => setPreview(null)} aria-label="Fermer">✕</button>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{preview.content}</p>
          </div>
        </div>
      )}
    </div>
  );
}
