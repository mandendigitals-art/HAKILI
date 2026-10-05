import "./database-guard";
import { afterAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

const request = vi.hoisted(() => ({
  cookies: new Map<string, string>(),
  ip: `workflow-${Date.now()}`,
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": request.ip }),
  cookies: async () => ({
    get: (name: string) => request.cookies.has(name) ? { value: request.cookies.get(name)! } : undefined,
    set: (name: string, value: string) => request.cookies.set(name, value),
    delete: (name: string) => request.cookies.delete(name),
  }),
}));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { db } from "@/db";
import { organizations, users, organizationMembers, subscriptions, knowledgeBases, sources, assistants, assistantKnowledgeBases } from "@/db/schema";
import { registerAction, loginAction, logoutAction } from "@/app/actions/auth";
import { createKnowledgeBaseAction, uploadFileAction } from "@/app/actions/workspace";
import { POST } from "@/app/api/chat/route";
import { getStorage } from "@/lib/storage";

let organizationId: string | undefined;
let userId: string | undefined;
afterAll(async () => {
  if (organizationId) {
    await getStorage().deletePrefix?.(organizationId);
    await db.delete(organizations).where(eq(organizations.id, organizationId));
  }
  if (userId) await db.delete(users).where(eq(users.id, userId));
});

describe("Parcours inscription → document → chat", () => {
  it("crée un essai et répond depuis le fichier importé, puis refuse une question hors périmètre", async () => {
    const email = `workflow-${Date.now()}@example.com`;
    const password = "Test-Only-Hakili-123!";
    const registration = new FormData();
    for (const [key, value] of Object.entries({name:"Client de test",email,password,organization:`Workflow ${Date.now()}`,sector:"Services"})) registration.set(key,value);
    await expect(registerAction(undefined, registration)).rejects.toThrow("REDIRECT:/dashboard");
    const [user] = await db.select().from(users).where(eq(users.email, email));
    userId = user.id;
    const [membership] = await db.select().from(organizationMembers).where(eq(organizationMembers.userId,user.id));
    organizationId = membership.organizationId;
    expect(membership.role).toBe("admin");
    const [subscription] = await db.select().from(subscriptions).where(eq(subscriptions.organizationId,organizationId));
    expect(subscription.status).toBe("trial");
    expect(subscription.endsAt!.getTime()).toBeGreaterThan(Date.now()+13*86400000);
    expect(request.cookies.has("hakili_session")).toBe(true);

    await expect(logoutAction()).rejects.toThrow("REDIRECT:/connexion");
    const login = new FormData();login.set("email",email);login.set("password","wrong-password");
    expect(await loginAction(undefined,login)).toEqual({error:"Identifiants incorrects."});
    login.set("password",password);
    await expect(loginAction(undefined,login)).rejects.toThrow("REDIRECT:/dashboard");

    const kbForm = new FormData();kbForm.set("name","Procédure RH de test");
    expect(await createKnowledgeBaseAction(undefined,kbForm)).toEqual({success:"Base de connaissances créée."});
    const [kb] = await db.select().from(knowledgeBases).where(eq(knowledgeBases.organizationId,organizationId));
    const upload = new FormData();upload.set("knowledgeBaseId",kb.id);
    upload.set("file",new File(["La prime d'ancienneté est fixée à 150 000 FCFA par trimestre après deux ans de service."],"procedure-rh.txt",{type:"text/plain"}));
    expect(await uploadFileAction(undefined,upload)).toEqual({success:"Fichier importé et traité."});
    const [source] = await db.select().from(sources).where(eq(sources.knowledgeBaseId,kb.id));
    expect(source.status).toBe("completed");
    const [assistant] = await db.insert(assistants).values({organizationId,name:"RH de test"}).returning();
    await db.insert(assistantKnowledgeBases).values({organizationId,assistantId:assistant.id,knowledgeBaseId:kb.id});
    const ask = (question: string, conversationId?: string) => POST(new Request("http://localhost/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({assistantId:assistant.id,question,conversationId})}));
    const response = await ask("Quel est le montant de la prime d'ancienneté ?");
    expect(response.status).toBe(200);
    const answer = await response.json();
    expect(answer.refused).toBe(false);
    expect(answer.answer).toContain("150 000 FCFA");
    expect(answer.answer).toContain("[1]");
    expect(answer.citations[0]).toMatchObject({rank:1,sourceName:"procedure-rh.txt"});
    const outside = await ask("Quelle est la vitesse de la lumière dans le vide ?",answer.conversationId);
    expect(outside.status).toBe(200);
    expect(await outside.json()).toMatchObject({refused:true,citations:[],answer:"Je ne trouve pas cette information dans les sources disponibles."});
    const invalid = new FormData();invalid.set("knowledgeBaseId",kb.id);
    invalid.set("file",new File(["vide"],"document-trop-court.txt",{type:"text/plain"}));
    expect(await uploadFileAction(undefined,invalid)).toEqual({error:"Le contenu extrait est vide ou trop court."});
    const rejected = await db.select().from(sources).where(eq(sources.knowledgeBaseId,kb.id));
    expect(rejected.find(row => row.name === "document-trop-court.txt")?.status).toBe("error");
  });
});
