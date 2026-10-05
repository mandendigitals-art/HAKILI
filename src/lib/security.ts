/**
 * Utilitaires de sécurité HAKILI :
 * - Limitation de débit (Redis / Upstash / fallback mémoire)
 * - Validation stricte des fichiers (MIME, extension, signature binaire)
 * - Protection anti-SSRF avancée (DNS lookup, blocage IP privées/loopback/réservées, validation des redirections)
 * - Protection contre l'injection de prompt
 * - Gestion d'erreurs neutres
 */

import dns from "dns/promises";
import { isIP } from "net";

// ────────────── Rate limiting (Redis / Upstash / Mémoire) ──────────────
type MemoryBucket = { count: number; resetAt: number };
const memoryBuckets = new Map<string, MemoryBucket>();

let redisClient: import("ioredis").Redis | null = null;
let upstashRestUrl = process.env.UPSTASH_REDIS_REST_URL;
let upstashRestToken = process.env.UPSTASH_REDIS_REST_TOKEN;

async function getRedis() {
  if (redisClient) return redisClient;
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl && redisUrl.trim().length > 0 && !redisUrl.includes("changeme")) {
    try {
      const { default: Redis } = await import("ioredis");
      redisClient = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
        lazyConnect: true,
      });
      await redisClient.connect().catch(() => {});
      return redisClient;
    } catch {
      return null;
    }
  }
  return null;
}

export type RateLimitResult = { ok: boolean; remaining: number; retryAfterSec: number };

/** Rate limiter synchrone (fallback mémoire) */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  if (memoryBuckets.size > 50_000) {
    for (const [k, b] of memoryBuckets) if (b.resetAt < now) memoryBuckets.delete(k);
  }
  const b = memoryBuckets.get(key);
  if (!b || b.resetAt < now) {
    memoryBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSec: 0 };
  }
  b.count += 1;
  if (b.count > limit) {
    return { ok: false, remaining: 0, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) };
  }
  return { ok: true, remaining: limit - b.count, retryAfterSec: 0 };
}

/** Rate limiter asynchrone avec support Upstash / Redis et fallback mémoire */
export async function rateLimitAsync(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  // 1. Upstash Redis REST API
  upstashRestUrl = process.env.UPSTASH_REDIS_REST_URL;
  upstashRestToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (upstashRestUrl && upstashRestToken && !upstashRestUrl.includes("changeme")) {
    try {
      const windowSec = Math.ceil(windowMs / 1000);
      const res = await fetch(`${upstashRestUrl}/pipeline`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${upstashRestToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([
          ["INCR", `ratelimit:${key}`],
          ["EXPIRE", `ratelimit:${key}`, windowSec, "NX"],
          ["TTL", `ratelimit:${key}`],
        ]),
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) {
        const data = await res.json();
        const count = Number(data[0]?.result ?? 1);
        const ttl = Number(data[2]?.result ?? windowSec);
        if (count > limit) {
          return { ok: false, remaining: 0, retryAfterSec: Math.max(1, ttl) };
        }
        return { ok: true, remaining: Math.max(0, limit - count), retryAfterSec: 0 };
      }
    } catch {
      // Fallback
    }
  }

  // 2. Standard Redis via ioredis
  try {
    const redis = await getRedis();
    if (redis && redis.status === "ready") {
      const redisKey = `ratelimit:${key}`;
      const windowSec = Math.ceil(windowMs / 1000);
      const pipeline = redis.pipeline();
      pipeline.incr(redisKey);
      pipeline.expire(redisKey, windowSec, "NX");
      pipeline.ttl(redisKey);
      const results = await pipeline.exec();
      if (results && results[0] && !results[0][0]) {
        const count = Number(results[0][1]);
        const ttl = Number(results[2]?.[1] ?? windowSec);
        if (count > limit) {
          return { ok: false, remaining: 0, retryAfterSec: Math.max(1, ttl) };
        }
        return { ok: true, remaining: Math.max(0, limit - count), retryAfterSec: 0 };
      }
    }
  } catch {
    // Fallback
  }

  // 3. Fallback mémoire
  return rateLimit(key, limit, windowMs);
}

// ────────────── Validation des fichiers ──────────────
export const MAX_FILE_BYTES = Number(process.env.MAX_UPLOAD_MB ?? 15) * 1024 * 1024;

export const ALLOWED_FILE_TYPES: Record<string, { ext: string[]; label: string }> = {
  "application/pdf": { ext: ["pdf"], label: "PDF" },
  "text/plain": { ext: ["txt", "md"], label: "Texte" },
  "text/markdown": { ext: ["md"], label: "Markdown" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { ext: ["docx"], label: "Word" },
};

export type FileKind = "pdf" | "txt" | "docx";

export function detectFileKind(name: string, mime: string, head: Uint8Array): FileKind | null {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const asText = (n: number) => Array.from(head.slice(0, n)).map((c) => String.fromCharCode(c)).join("");
  // Vérification de la signature binaire (magic bytes)
  if (ext === "pdf" && asText(5) === "%PDF-") return "pdf";
  if (ext === "docx" && head[0] === 0x50 && head[1] === 0x4b) return "docx";
  if ((ext === "txt" || ext === "md") && (mime.startsWith("text/") || mime === "application/octet-stream" || mime === "")) {
    // Rejette les binaires déguisés en texte (octets nuls)
    if (head.slice(0, 512).some((b) => b === 0)) return null;
    return "txt";
  }
  return null;
}

const DANGEROUS_EXT = /\.(exe|bat|cmd|sh|ps1|js|jar|msi|scr|vbs|dll|com|php|phtml|py|rb|pl|cgi|asp|aspx|html?|svg|xhtml)$/i;

export function isDangerousFilename(name: string) {
  return DANGEROUS_EXT.test(name) || name.includes("..") || name.includes("/") || name.includes("\\");
}

export function sanitizeFilename(name: string) {
  return name.replace(/[^\w.\-() àâäéèêëïîôöùûüç]/gi, "_").slice(0, 120);
}

// ────────────── Protection SSRF ──────────────
/**
 * Vérifie si une adresse IP est privée, locale, réservée ou loopback.
 */
export function isPrivateOrReservedIp(ipStr: string): boolean {
  const cleanIp = ipStr.replace(/^::ffff:/i, "").trim().toLowerCase();

  // IPv4 checks
  if (isIP(cleanIp) === 4) {
    const parts = cleanIp.split(".").map(Number);
    if (parts.length !== 4) return true;
    const [a, b] = parts;

    // 0.0.0.0/8 (Broadcast/Current network)
    if (a === 0) return true;
    // 10.0.0.0/8 (Private)
    if (a === 10) return true;
    // 127.0.0.0/8 (Loopback)
    if (a === 127) return true;
    // 169.254.0.0/16 (Link-local)
    if (a === 169 && b === 254) return true;
    // 172.16.0.0/12 (Private)
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.168.0.0/16 (Private)
    if (a === 192 && b === 168) return true;
    // 100.64.0.0/10 (Carrier-grade NAT)
    if (a === 100 && b >= 64 && b <= 127) return true;
    // 198.18.0.0/15 (Benchmarking)
    if (a === 198 && (b === 18 || b === 19)) return true;
    // 224.0.0.0/4 (Multicast) & 240.0.0.0/4 (Reserved)
    if (a >= 224) return true;
    // 255.255.255.255 (Broadcast)
    if (parts.every((p) => p === 255)) return true;

    return false;
  }

  // IPv6 checks
  if (isIP(cleanIp) === 6) {
    // Loopback ::1
    if (cleanIp === "::1" || cleanIp === "0:0:0:0:0:0:0:1") return true;
    // Unspecified ::
    if (cleanIp === "::" || cleanIp === "0:0:0:0:0:0:0:0") return true;
    // Unique local address fc00::/7 (fc00:: - fdff::)
    if (/^f[cd][0-9a-f]{2}:/i.test(cleanIp)) return true;
    // Link-local unicast fe80::/10 (fe80:: - febf::)
    if (/^fe[89ab][0-9a-f]:/i.test(cleanIp)) return true;
    // Multicast ff00::/8
    if (/^ff[0-9a-f]{2}:/i.test(cleanIp)) return true;

    return false;
  }

  return true;
}

/**
 * Valide une URL et résout son DNS pour interdire tout accès SSRF à des IP privées.
 */
export async function validateUrlForSsrf(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new AppError("Adresse web invalide.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new AppError("Protocole non autorisé. Seuls HTTP et HTTPS sont acceptés.");
  }

  const hostname = url.hostname.toLowerCase();

  // Noms d'hôtes réservés / locaux
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".corp") ||
    hostname.endsWith(".home")
  ) {
    throw new AppError("Adresse web locale ou interne non autorisée.");
  }

  // Si le hostname est déjà une adresse IP littérale
  if (isIP(hostname)) {
    if (isPrivateOrReservedIp(hostname)) {
      throw new AppError("Adresse IP privée ou réservée non autorisée.");
    }
    return url;
  }

  // Résolution DNS de tous les enregistrements A et AAAA
  try {
    const addresses = await dns.lookup(hostname, { all: true });
    if (addresses.length === 0) {
      throw new AppError("Impossible de résoudre l'adresse du domaine.");
    }

    for (const addr of addresses) {
      if (isPrivateOrReservedIp(addr.address)) {
        throw new AppError("Le domaine résout vers une adresse IP privée ou non autorisée.");
      }
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError("Échec de la vérification DNS du domaine.");
  }

  return url;
}

export function isValidHttpUrl(u: string): boolean {
  try {
    const url = new URL(u);
    if (!["http:", "https:"].includes(url.protocol)) return false;
    const host = url.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host.endsWith(".local") ||
      host.endsWith(".internal") ||
      isIP(host) !== 0
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

// ────────────── Prompt injection guards ──────────────
const INJECTION_PATTERNS: RegExp[] = [
  /ignore (all|any|the|previous|above|prior) (instructions|rules|prompts?)/i,
  /ignore[rz]?\s+(toutes?\s+)?(les\s+)?(instructions|consignes|règles)\s+(précédentes|ci-dessus|antérieures)/i,
  /(oublie|oubliez)\s+(tes|vos|les)\s+(instructions|consignes)/i,
  /you are now\s+(a|an|the)\b/i,
  /tu es (maintenant|désormais)\s+(un|une)\b/i,
  /(system|développeur|developer)\s*(prompt|message)\s*[:=]/i,
  /reveal|révèle|affiche.*(prompt|instructions? système)/i,
  /\bDAN\b|jailbreak/i,
  /<\s*\/?\s*(system|assistant|instruction)s?\s*>/i,
];

export function detectPromptInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((re) => re.test(text));
}

export function sanitizeContext(text: string): string {
  return text
    .replace(/<\s*\/?\s*(system|assistant|user|instruction|tool)s?[^>]*>/gi, "")
    .replace(/```/g, "'''")
    .replace(/\[(SYSTEM|INSTRUCTION|ADMIN)[^\]]*\]/gi, "")
    .trim();
}

export function sanitizeUserQuestion(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 2000);
}

// ────────────── Erreurs neutres ──────────────
export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = "bad_request",
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function safeErrorMessage(e: unknown, fallback = "Une erreur est survenue. Veuillez réessayer."): string {
  if (e instanceof AppError) return e.message;
  if (process.env.NODE_ENV !== "production" && e instanceof Error) return `${fallback} (${e.message})`;
  return fallback;
}

export function jsonError(e: unknown, fallbackStatus = 500): Response {
  const status = e instanceof AppError ? e.status : fallbackStatus;
  if (!(e instanceof AppError)) console.error("[hakili] erreur interne", e);
  return Response.json({ error: safeErrorMessage(e) }, { status });
}
