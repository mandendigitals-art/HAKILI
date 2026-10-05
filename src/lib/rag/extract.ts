import { AppError, validateUrlForSsrf } from "@/lib/security";

/** Nettoyage du texte extrait : espaces, lignes vides, caractères de contrôle. */
export function cleanText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function extractPdf(buffer: Buffer): Promise<string> {
  const mod = await import("pdf-parse/lib/pdf-parse.js");
  const pdfParse =
    (mod as unknown as { default?: (b: Buffer) => Promise<{ text: string }> }).default ??
    (mod as unknown as (b: Buffer) => Promise<{ text: string }>);
  const result = await pdfParse(buffer);
  return cleanText(result.text ?? "");
}

export async function extractDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return cleanText(result.value ?? "");
}

export function extractTxt(buffer: Buffer): string {
  return cleanText(buffer.toString("utf8"));
}

const NAMED_ENTITIES: Record<string, string> = {
  agrave: "à", aacute: "á", acirc: "â", auml: "ä", eacute: "é", egrave: "è", ecirc: "ê", euml: "ë", iacute: "í", icirc: "î", iuml: "ï",
  ograve: "ò", oacute: "ó", ocirc: "ô", ouml: "ö", ugrave: "ù", uacute: "ú", ucirc: "û", uuml: "ü", ccedil: "ç", oelig: "œ", ntilde: "ñ",
  laquo: "«", raquo: "»", hellip: "…", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", ndash: "–", mdash: "—", euro: "€", copy: "©", deg: "°",
};

function decodeEntities(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&([a-z]+);/gi, (m, e: string) => NAMED_ENTITIES[e.toLowerCase()] ?? m);
}

/** Conversion HTML → texte sans dépendance externe. */
export function htmlToText(html: string): { title: string; text: string } {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? "";
  let body = html
    .replace(/<head[\s\S]*?<\/head>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<(nav|footer|header|aside)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const main = body.match(/<(main|article)[^>]*>([\s\S]*?)<\/\1>/i)?.[2];
  if (main && main.length > 500) body = main;
  const text = body
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ");

  return { title: decodeEntities(title), text: cleanText(decodeEntities(text)) };
}

/**
 * Extraction sécurisée du contenu d'une page web avec protection SSRF stricte :
 * - Validation DNS et blocage des IP privées / locales / réservées
 * - Gestion manuelle des redirections (max 3) avec re-validation de chaque cible
 * - Limitation de taille de téléchargement (max 5 Mo)
 * - Timeout strict (15s)
 */
export async function extractUrl(initialUrl: string): Promise<{ title: string; text: string }> {
  let currentUrl = await validateUrlForSsrf(initialUrl);
  let redirectsCount = 0;
  const maxRedirects = 3;
  const maxBytes = 5 * 1024 * 1024; // 5 Mo

  while (redirectsCount <= maxRedirects) {
    const res = await fetch(currentUrl.toString(), {
      headers: {
        "User-Agent": "HAKILI-Bot/1.0 (+https://mandendigital.com)",
        Accept: "text/html,text/plain",
      },
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
    });

    // Gestion des redirections (301, 302, 307, 308)
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const location = res.headers.get("location");
      if (!location) throw new AppError("Redirection sans en-tête Location valide.");

      redirectsCount++;
      if (redirectsCount > maxRedirects) {
        throw new AppError("Trop de redirections lors de la récupération de la page.");
      }

      const nextUrl = new URL(location, currentUrl);
      currentUrl = await validateUrlForSsrf(nextUrl.toString());
      continue;
    }

    if (!res.ok) {
      throw new AppError(`La page n'a pas pu être récupérée (HTTP ${res.status}).`);
    }

    const ct = (res.headers.get("content-type") ?? "").toLowerCase();
    if (!ct.includes("text/html") && !ct.includes("text/plain")) {
      throw new AppError("Format de contenu non supporté. Seules les pages HTML ou texte sont acceptées.");
    }

    const len = Number(res.headers.get("content-length") ?? 0);
    if (len > maxBytes) {
      throw new AppError("Page trop volumineuse (maximum 5 Mo).");
    }

    // Téléchargement sécurisé avec limite de taille de flux
    const reader = res.body?.getReader();
    if (!reader) {
      const raw = await res.text();
      if (raw.length > maxBytes) throw new AppError("Page trop volumineuse (maximum 5 Mo).");
      if (ct.includes("text/plain")) return { title: currentUrl.toString(), text: cleanText(raw) };
      const out = htmlToText(raw);
      if (out.text.length < 50) throw new AppError("Aucun contenu textuel exploitable sur cette page.");
      return { title: out.title || currentUrl.toString(), text: out.text };
    }

    let received = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        received += value.length;
        if (received > maxBytes) {
          reader.cancel();
          throw new AppError("Page trop volumineuse (maximum 5 Mo).");
        }
        chunks.push(value);
      }
    }

    const totalBuffer = Buffer.concat(chunks);
    const html = totalBuffer.toString("utf8");

    if (ct.includes("text/plain")) {
      return { title: currentUrl.toString(), text: cleanText(html) };
    }

    const out = htmlToText(html);
    if (out.text.length < 50) {
      throw new AppError("Aucun contenu textuel exploitable sur cette page.");
    }

    return { title: out.title || currentUrl.toString(), text: out.text };
  }

  throw new AppError("Échec de la récupération de l'URL.");
}

/** Découpage intelligent : par paragraphes puis phrases, avec chevauchement. */
export function chunkText(text: string, opts: { size?: number; overlap?: number } = {}): string[] {
  const size = opts.size ?? 900;
  const overlap = opts.overlap ?? 150;
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const units: string[] = [];
  for (const p of paragraphs) {
    if (p.length <= size) units.push(p);
    else {
      const sentences = p.split(/(?<=[.!?…])\s+/);
      let buf = "";
      for (const s of sentences) {
        if ((buf + " " + s).length > size && buf) {
          units.push(buf.trim());
          buf = s;
        } else buf = buf ? buf + " " + s : s;
      }
      if (buf) units.push(buf.trim());
    }
  }
  const chunks: string[] = [];
  let current = "";
  for (const u of units) {
    if ((current + "\n\n" + u).length > size && current) {
      chunks.push(current.trim());
      const tail = current.slice(-overlap);
      const cut = tail.indexOf(" ");
      current = (cut >= 0 ? tail.slice(cut + 1) : tail) + "\n\n" + u;
    } else current = current ? current + "\n\n" + u : u;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.filter((c) => c.length > 20);
}
