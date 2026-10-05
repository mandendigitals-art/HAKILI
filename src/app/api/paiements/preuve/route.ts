import { eq } from "drizzle-orm";
import { db } from "@/db";
import { payments } from "@/db/schema";
import { requireSuperAdmin } from "@/lib/auth";
import { getStorage } from "@/lib/storage";
import { jsonError } from "@/lib/security";

export const dynamic = "force-dynamic";

/** Sert la preuve de paiement — super administrateur uniquement. */
export async function GET(req: Request) {
  try {
    await requireSuperAdmin();
    const id = new URL(req.url).searchParams.get("id") ?? "";
    const [p] = await db.select({ proofUrl: payments.proofUrl }).from(payments).where(eq(payments.id, id));
    if (!p?.proofUrl) return Response.json({ error: "Preuve introuvable." }, { status: 404 });
    const buffer = await getStorage().get(p.proofUrl);
    const ext = p.proofUrl.split(".").pop()?.toLowerCase();
    const type = ext === "pdf" ? "application/pdf" : ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    return new Response(new Uint8Array(buffer), { headers: { "Content-Type": type, "Cache-Control": "private, no-store" } });
  } catch (e) {
    return jsonError(e);
  }
}
