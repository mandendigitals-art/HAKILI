/**
 * Couche d'abstraction IA de HAKILI.
 * Le fournisseur est choisi par variables d'environnement :
 *   AI_PROVIDER = openai | gemini | muapi | local
 *   EMBEDDING_PROVIDER = openai | gemini | local
 * Aucune clé ne quitte le serveur.
 */
import { createHash } from "crypto";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
export type ChatResult = { text: string; promptTokens: number; completionTokens: number; provider: string; model: string };

export interface LLMProvider {
  name: string;
  model: string;
  chat(messages: ChatMessage[], opts?: { temperature?: number; maxTokens?: number }): Promise<ChatResult>;
}

export interface EmbeddingProvider {
  name: string;
  model: string;
  dims: number;
  embed(texts: string[]): Promise<number[][]>;
}

const estimateTokens = (s: string) => Math.ceil(s.length / 4);

// ─────────────────────────── OpenAI ───────────────────────────
class OpenAIChat implements LLMProvider {
  name = "openai";
  constructor(
    private apiKey: string,
    public model = process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini",
    private baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
  ) {}
  async chat(messages: ChatMessage[], opts?: { temperature?: number; maxTokens?: number }): Promise<ChatResult> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model: this.model, messages, temperature: opts?.temperature ?? 0.2, max_tokens: opts?.maxTokens ?? 1024 }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`);
    const j = await res.json();
    return {
      text: j.choices?.[0]?.message?.content ?? "",
      promptTokens: j.usage?.prompt_tokens ?? 0,
      completionTokens: j.usage?.completion_tokens ?? 0,
      provider: this.name,
      model: this.model,
    };
  }
}

class OpenAIEmbeddings implements EmbeddingProvider {
  name = "openai";
  dims = Number(process.env.OPENAI_EMBEDDING_DIMS ?? 1536);
  constructor(
    private apiKey: string,
    public model = process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
    private baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
  ) {}
  async embed(texts: string[]): Promise<number[][]> {
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += 64) {
      const batch = texts.slice(i, i + 64);
      const res = await fetch(`${this.baseUrl}/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({ model: this.model, input: batch, dimensions: this.dims }),
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) throw new Error(`OpenAI embeddings HTTP ${res.status}`);
      const j = await res.json();
      for (const d of j.data) out.push(d.embedding as number[]);
    }
    return out;
  }
}

// ─────────────────────────── Google Gemini ───────────────────────────
class GeminiChat implements LLMProvider {
  name = "gemini";
  constructor(
    private apiKey: string,
    public model = process.env.GEMINI_CHAT_MODEL ?? "gemini-2.0-flash",
  ) {}
  async chat(messages: ChatMessage[], opts?: { temperature?: number; maxTokens?: number }): Promise<ChatResult> {
    const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    const contents = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: system ? { parts: [{ text: system }] } : undefined,
          contents,
          generationConfig: { temperature: opts?.temperature ?? 0.2, maxOutputTokens: opts?.maxTokens ?? 1024 },
        }),
        signal: AbortSignal.timeout(60_000),
      },
    );
    if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
    const j = await res.json();
    const text = j.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
    return {
      text,
      promptTokens: j.usageMetadata?.promptTokenCount ?? 0,
      completionTokens: j.usageMetadata?.candidatesTokenCount ?? 0,
      provider: this.name,
      model: this.model,
    };
  }
}

class GeminiEmbeddings implements EmbeddingProvider {
  name = "gemini";
  dims = 768;
  constructor(
    private apiKey: string,
    public model = process.env.GEMINI_EMBEDDING_MODEL ?? "text-embedding-004",
  ) {}
  async embed(texts: string[]): Promise<number[][]> {
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += 50) {
      const batch = texts.slice(i, i + 50);
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:batchEmbedContents?key=${this.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requests: batch.map((t) => ({ model: `models/${this.model}`, content: { parts: [{ text: t }] } })),
          }),
          signal: AbortSignal.timeout(60_000),
        },
      );
      if (!res.ok) throw new Error(`Gemini embeddings HTTP ${res.status}`);
      const j = await res.json();
      for (const e of j.embeddings) out.push(e.values as number[]);
    }
    return out;
  }
}

// ─────────────────────────── MuAPI (fournisseur tiers, asynchrone) ───────────────────────────
class MuApiChat implements LLMProvider {
  name = "muapi";
  constructor(
    private apiKey: string,
    public model = process.env.MUAPI_MODEL ?? "google/gemini-2.5-flash",
  ) {}
  async chat(messages: ChatMessage[], opts?: { temperature?: number; maxTokens?: number }): Promise<ChatResult> {
    const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    const history = messages.filter((m) => m.role !== "system");
    const last = history.pop();
    const prompt =
      history.map((m) => `${m.role === "user" ? "Utilisateur" : "Assistant"} : ${m.content}`).join("\n") +
      `\n\nUtilisateur : ${last?.content ?? ""}`;
    const res = await fetch("https://api.muapi.ai/api/v1/any-llm-models", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": this.apiKey },
      body: JSON.stringify({
        prompt,
        system_prompt: system,
        model: this.model,
        temperature: opts?.temperature ?? 0.2,
        max_tokens: opts?.maxTokens ?? 1024,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`MuAPI HTTP ${res.status}`);
    const { request_id } = await res.json();
    if (!request_id) throw new Error("MuAPI : identifiant de requête manquant");
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const poll = await fetch(`https://api.muapi.ai/api/v1/predictions/${request_id}/result`, {
        headers: { "x-api-key": this.apiKey },
        signal: AbortSignal.timeout(15_000),
      });
      if (!poll.ok) continue;
      const j = await poll.json();
      if (j.status === "completed") {
        const text = j.outputs?.[0] ?? "";
        return { text, promptTokens: estimateTokens(prompt + system), completionTokens: estimateTokens(text), provider: this.name, model: this.model };
      }
      if (j.status === "failed") throw new Error("MuAPI : génération échouée");
    }
    throw new Error("MuAPI : délai dépassé");
  }
}

// ─────────────────────────── Fournisseur local (repli, sans clé) ───────────────────────────
/**
 * Embeddings locaux par hachage de caractéristiques (unigrammes, bigrammes, trigrammes de
 * caractères). Déterministes, sans réseau. Qualité inférieure à un vrai modèle mais suffisante
 * pour une démonstration et un fonctionnement hors ligne.
 */
export function normalizeText(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOPWORDS = new Set(
  "le la les un une des du de d l et ou a au aux en dans sur pour par avec sans sous que qui quoi dont ou est sont etre ete ce cet cette ces se sa son ses leur leurs mon ma mes ton ta tes nos vos notre votre il elle ils elles on nous vous je tu ne pas plus moins tres the of and to in is are for on at by with from this that it as be or an".split(
    " ",
  ),
);

export function tokenize(s: string) {
  return normalizeText(s)
    .split(" ")
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

function hashIndex(token: string, dims: number) {
  const h = createHash("md5").update(token).digest();
  const idx = h.readUInt32LE(0) % dims;
  const sign = h[4] & 1 ? 1 : -1;
  return { idx, sign };
}

export class LocalEmbeddings implements EmbeddingProvider {
  name = "local";
  model = "hakili-hash-v1";
  dims = 512;
  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((t) => {
      const v = new Float32Array(this.dims);
      const words = tokenize(t);
      const push = (tok: string, w: number) => {
        const { idx, sign } = hashIndex(tok, this.dims);
        v[idx] += sign * w;
      };
      for (let i = 0; i < words.length; i++) {
        const w = words[i];
        push("w:" + w, 1);
        if (i + 1 < words.length) push("b:" + w + "_" + words[i + 1], 0.8);
        if (w.length > 5) push("p:" + w.slice(0, 5), 0.5); // préfixe (stemming léger)
        for (let k = 0; k + 3 <= w.length && k < 6; k++) push("c:" + w.slice(k, k + 3), 0.25);
      }
      let norm = 0;
      for (const x of v) norm += x * x;
      norm = Math.sqrt(norm) || 1;
      return Array.from(v, (x) => x / norm);
    });
  }
}

/**
 * LLM local extractif : compose une réponse à partir des passages fournis, sans modèle externe.
 * Sert de repli lorsque aucune clé n'est configurée (démonstration, environnement hors ligne).
 */
class LocalExtractiveChat implements LLMProvider {
  name = "local";
  model = "hakili-extractive-v1";
  async chat(messages: ChatMessage[]): Promise<ChatResult> {
    const user = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const system = messages.find((m) => m.role === "system")?.content ?? "";
    const ctxMatch = system.match(/=== SOURCES ===([\s\S]*?)=== FIN DES SOURCES ===/);
    const ctx = ctxMatch?.[1] ?? "";
    const question = user.replace(/^Question\s*:\s*/i, "");
    const qTokens = new Set(tokenize(question).filter((t) => !/^\d+$/.test(t) && t.length > 2));
    const sentences = ctx
      .split(/(?<=[.!?])\s+|\n+/)
      .map((s) => s.replace(/^\[\d+\][^\n]*\n?/, "").trim())
      .filter((s) => s.length > 30 && !s.startsWith("[") && !s.startsWith("==="));
    const scored = sentences
      .map((s) => {
        const toks = tokenize(s);
        const matched = new Set<string>();
        for (const t of toks) {
          if (qTokens.has(t)) matched.add(t);
          else for (const q of qTokens) if (q.length > 4 && t.startsWith(q.slice(0, 5))) matched.add(q);
        }
        return { s, score: matched.size >= 2 || qTokens.size <= 1 ? matched.size / Math.sqrt(toks.length + 1) : 0 };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);
    let text: string;
    if (scored.length === 0) {
      text = "Je n'ai pas trouvé d'information suffisante dans vos sources pour répondre à cette question.";
    } else {
      text =
        "D'après vos sources :\n\n" +
        scored.map((x) => `• ${x.s}`).join("\n") +
        "\n\n_(Mode local sans modèle génératif : réponse extractive. Configurez un fournisseur IA pour des réponses rédigées.)_";
    }
    return { text, promptTokens: estimateTokens(system + user), completionTokens: estimateTokens(text), provider: this.name, model: this.model };
  }
}

// ─────────────────────────── Fabrique ───────────────────────────
const hasKey = (k?: string) => Boolean(k && k.trim() && !k.includes("your_") && !k.includes("changeme"));

export function getLLMProvider(modelOverride?: string | null): LLMProvider {
  const p = (process.env.AI_PROVIDER ?? "auto").toLowerCase();
  const openai = process.env.OPENAI_API_KEY;
  const gemini = process.env.GEMINI_API_KEY;
  const mu = process.env.MUAPI_API_KEY;
  const m = modelOverride?.trim() || undefined;
  if (p === "openai" && hasKey(openai)) return new OpenAIChat(openai!, m);
  if (p === "gemini" && hasKey(gemini)) return new GeminiChat(gemini!, m);
  if (p === "muapi" && hasKey(mu)) return new MuApiChat(mu!, m);
  if (p === "auto") {
    if (hasKey(openai)) return new OpenAIChat(openai!, m);
    if (hasKey(gemini)) return new GeminiChat(gemini!, m);
    if (hasKey(mu)) return new MuApiChat(mu!, m);
  }
  return new LocalExtractiveChat();
}

export function getEmbeddingProvider(): EmbeddingProvider {
  const p = (process.env.EMBEDDING_PROVIDER ?? "auto").toLowerCase();
  const openai = process.env.OPENAI_API_KEY;
  const gemini = process.env.GEMINI_API_KEY;
  if (p === "openai" && hasKey(openai)) return new OpenAIEmbeddings(openai!);
  if (p === "gemini" && hasKey(gemini)) return new GeminiEmbeddings(gemini!);
  if (p === "auto") {
    if (hasKey(openai)) return new OpenAIEmbeddings(openai!);
    if (hasKey(gemini)) return new GeminiEmbeddings(gemini!);
  }
  return new LocalEmbeddings();
}

export function describeAiSetup() {
  const llm = getLLMProvider();
  const emb = getEmbeddingProvider();
  return { llm: `${llm.name} / ${llm.model}`, embeddings: `${emb.name} / ${emb.model} (${emb.dims} dims)`, isLocal: llm.name === "local" };
}
