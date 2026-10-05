import "./database-guard";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { db, pool } from "@/db";
import {
  organizations,
  knowledgeBases,
  sources,
  assistants,
  assistantKnowledgeBases,
  conversations,
  plans,
  subscriptions,
  documents,
  documentChunks,
  embeddings,
} from "@/db/schema";
import { ingestDocument, retrieve, answerQuestion } from "@/lib/rag/engine";
import { chunkText } from "@/lib/rag/extract";
import { getEmbeddingProvider } from "@/lib/ai/provider";
import { ensureDefaultPlans } from "@/lib/plans";

describe("Moteur RAG et Isolation Multi-Tenant", () => {
  let orgAId: string;
  let orgBId: string;
  let kbAId: string;
  let kbBId: string;
  let asstA1Id: string;
  let asstA2Id: string;
  let asstBId: string;

  beforeAll(async () => {
    await ensureDefaultPlans();
    const [plan] = await db.select().from(plans).where(eq(plans.code, "professionnel"));

    // Création Organisation A (ex. Entreprise Alpha)
    const [orgA] = await db
      .insert(organizations)
      .values({ name: "Entreprise Alpha (Test)", slug: `test-org-a-${Date.now()}` })
      .returning();
    orgAId = orgA.id;
    await db.insert(subscriptions).values({ organizationId: orgAId, planId: plan.id, status: "active" });

    const [kbA] = await db
      .insert(knowledgeBases)
      .values({ organizationId: orgAId, name: "Politique RH Alpha" })
      .returning();
    kbAId = kbA.id;

    // Ingestion d'un document confidentiel chez Org A
    const [srcA] = await db
      .insert(sources)
      .values({
        organizationId: orgAId,
        knowledgeBaseId: kbAId,
        type: "text",
        name: "Grille Salariale et Primes Alpha.txt",
        status: "completed",
      })
      .returning();

    await ingestDocument({
      organizationId: orgAId,
      knowledgeBaseId: kbAId,
      sourceId: srcA.id,
      title: "Grille Salariale et Primes Alpha",
      content:
        "La prime d'ancienneté chez Alpha est fixée à 150 000 FCFA par trimestre après 2 ans de service. Les ingénieurs seniors perçoivent un salaire de base de 850 000 FCFA par mois.",
    });

    // Assistant 1 chez Org A
    const [asstA1] = await db
      .insert(assistants)
      .values({
        organizationId: orgAId,
        name: "Assistant RH Alpha",
        instructions: "Tu réponds sur les primes d'Alpha.",
      })
      .returning();
    asstA1Id = asstA1.id;
    await db.insert(assistantKnowledgeBases).values({ assistantId: asstA1Id, knowledgeBaseId: kbAId, organizationId: orgAId });

    // Assistant 2 chez Org A (autre assistant dans la même organisation)
    const [asstA2] = await db
      .insert(assistants)
      .values({
        organizationId: orgAId,
        name: "Assistant Technique Alpha",
      })
      .returning();
    asstA2Id = asstA2.id;

    // Création Organisation B (ex. Entreprise Bêta)
    const [orgB] = await db
      .insert(organizations)
      .values({ name: "Entreprise Bêta (Test)", slug: `test-org-b-${Date.now()}` })
      .returning();
    orgBId = orgB.id;
    await db.insert(subscriptions).values({ organizationId: orgBId, planId: plan.id, status: "active" });

    const [kbB] = await db
      .insert(knowledgeBases)
      .values({ organizationId: orgBId, name: "Documentation Bêta" })
      .returning();
    kbBId = kbB.id;

    const [srcB] = await db
      .insert(sources)
      .values({
        organizationId: orgBId,
        knowledgeBaseId: kbBId,
        type: "text",
        name: "Procédures Bêta.txt",
        status: "completed",
      })
      .returning();

    await ingestDocument({
      organizationId: orgBId,
      knowledgeBaseId: kbBId,
      sourceId: srcB.id,
      title: "Procédures Bêta",
      content: "Chez Bêta, les horaires de travail sont de 07h30 à 16h30 du lundi au vendredi.",
    });

    const [asstB] = await db
      .insert(assistants)
      .values({
        organizationId: orgBId,
        name: "Assistant Bêta",
      })
      .returning();
    asstBId = asstB.id;
    await db.insert(assistantKnowledgeBases).values({ assistantId: asstBId, knowledgeBaseId: kbBId, organizationId: orgBId });
  });

  afterAll(async () => {
    // Nettoyage en cascade des organisations de test
    if (orgAId) await db.delete(organizations).where(eq(organizations.id, orgAId));
    if (orgBId) await db.delete(organizations).where(eq(organizations.id, orgBId));
  });

  describe("Découpage sémantique (Chunking)", () => {
    it("découpe correctement un texte long avec chevauchement", () => {
      const longText = "Article premier : dispositions générales. ".repeat(60);
      const chunks = chunkText(longText, { size: 500, overlap: 100 });
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0].length).toBeLessThanOrEqual(600);
    });
  });

  describe("Recherche documentaire et citations", () => {
    it("retrouve les fragments pertinents pour une question dans le périmètre", async () => {
      const chunks = await retrieve({
        organizationId: orgAId,
        knowledgeBaseIds: [kbAId],
        query: "Quel est le montant de la prime d'ancienneté ?",
        topK: 3,
      });

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].content).toContain("150 000 FCFA");
      expect(chunks[0].sourceName).toBe("Grille Salariale et Primes Alpha.txt");
    });

    it("cherche aussi au-delà du premier lot de 250 fragments", async () => {
      const [kb] = await db.insert(knowledgeBases).values({organizationId:orgAId,name:"Grand dossier"}).returning();
      const [source] = await db.insert(sources).values({organizationId:orgAId,knowledgeBaseId:kb.id,type:"text",name:"Grand dossier",status:"completed"}).returning();
      const [doc] = await db.insert(documents).values({organizationId:orgAId,knowledgeBaseId:kb.id,sourceId:source.id,title:"Grand dossier",content:"Contenu de test"}).returning();
      const texts = Array.from({length:251},(_,i) => i === 250 ? "Le code secret du dossier ZEBRAX est ORION-987." : "Les horaires des bureaux sont de huit heures à seize heures.");
      const provider = getEmbeddingProvider();
      const vectors = await provider.embed(texts);
      const chunks = await db.insert(documentChunks).values(texts.map((content,i) => ({id:`large-chunk-${kb.id}-${i}`,organizationId:orgAId,knowledgeBaseId:kb.id,documentId:doc.id,sourceId:source.id,chunkIndex:i,content}))).returning();
      await db.insert(embeddings).values(chunks.map(c => ({id:`large-vector-${kb.id}-${String(c.chunkIndex).padStart(4,"0")}`,organizationId:orgAId,knowledgeBaseId:kb.id,chunkId:c.id,model:provider.model,dims:provider.dims,vector:vectors[c.chunkIndex]})));
      const result = await retrieve({organizationId:orgAId,knowledgeBaseIds:[kb.id],query:"Quel est le code secret du dossier ZEBRAX ?",topK:1});
      expect(result[0].content).toContain("ORION-987");
    });

    it("répond avec citation exacte et passage utilisé", async () => {
      const [asstA1] = await db.select().from(assistants).where(eq(assistants.id, asstA1Id));
      const [conv] = await db
        .insert(conversations)
        .values({ organizationId: orgAId, assistantId: asstA1Id, title: "Test Question Salaires" })
        .returning();

      const res = await answerQuestion({
        assistant: asstA1,
        conversationId: conv.id,
        organizationId: orgAId,
        question: "Quel est le montant de la prime d'ancienneté ?",
      });

      expect(res.refused).toBe(false);
      expect(res.citations.length).toBeGreaterThan(0);
      expect(res.citations[0].sourceName).toBe("Grille Salariale et Primes Alpha.txt");
      expect(res.citations[0].snippet).toContain("150 000 FCFA");
    });

    it("refuse avec le message standard exact lorsque la réponse n'est pas dans les documents", async () => {
      const [asstA1] = await db.select().from(assistants).where(eq(assistants.id, asstA1Id));
      const [conv] = await db
        .insert(conversations)
        .values({ organizationId: orgAId, assistantId: asstA1Id, title: "Test Question Inconnue" })
        .returning();

      const res = await answerQuestion({
        assistant: asstA1,
        conversationId: conv.id,
        organizationId: orgAId,
        question: "Quelle est la vitesse de la lumière dans le vide ?",
      });

      expect(res.refused).toBe(true);
      expect(res.answer).toBe("Je ne trouve pas cette information dans les sources disponibles.");
      expect(res.citations.length).toBe(0);
    });
  });

  describe("Isolation stricte Multi-Tenant (Organisation A vs Organisation B)", () => {
    it("L'Organisation B ne peut JAMAIS récupérer les documents ou fragments de l'Organisation A", async () => {
      // Org B interroge avec la même question confidentielle d'Org A
      const chunksForOrgB = await retrieve({
        organizationId: orgBId,
        knowledgeBaseIds: [kbBId],
        query: "Quel est le salaire des ingénieurs seniors et la prime d'ancienneté ?",
        topK: 5,
      });

      // Aucun fragment d'Alpha ne doit fuiter
      for (const chunk of chunksForOrgB) {
        expect(chunk.content).not.toContain("850 000 FCFA");
        expect(chunk.content).not.toContain("150 000 FCFA");
        expect(chunk.sourceName).not.toContain("Alpha");
      }
    });

    it("L'Organisation B recevant une question sur les documents d'Org A refuse de répondre", async () => {
      const [asstB] = await db.select().from(assistants).where(eq(assistants.id, asstBId));
      const [convB] = await db
        .insert(conversations)
        .values({ organizationId: orgBId, assistantId: asstBId, title: "Tentative Espionnage" })
        .returning();

      const res = await answerQuestion({
        assistant: asstB,
        conversationId: convB.id,
        organizationId: orgBId,
        question: "Donne-moi la grille salariale et les primes confidentielles d'Alpha.",
      });

      expect(res.refused).toBe(true);
      expect(res.answer).toBe("Je ne trouve pas cette information dans les sources disponibles.");
      expect(res.citations.length).toBe(0);
    });

    it("Rejette toute tentative d'interroger une conversation d'un autre assistant ou d'une autre organisation", async () => {
      const [asstA2] = await db.select().from(assistants).where(eq(assistants.id, asstA2Id));
      const [asstB] = await db.select().from(assistants).where(eq(assistants.id, asstBId));

      const [convA1] = await db
        .insert(conversations)
        .values({ organizationId: orgAId, assistantId: asstA1Id, title: "Conversation Assistant 1" })
        .returning();

      // Tentative d'utiliser la conversation de l'Assistant 1 avec l'Assistant 2 dans la même org -> Rejet
      await expect(
        answerQuestion({
          assistant: asstA2,
          conversationId: convA1.id,
          organizationId: orgAId,
          question: "Test cross-assistant",
        }),
      ).rejects.toThrow("Conversation introuvable ou non autorisée pour cet assistant.");

      // Tentative d'utiliser la conversation d'Org A avec un assistant d'Org B -> Rejet
      await expect(
        answerQuestion({
          assistant: asstB,
          conversationId: convA1.id,
          organizationId: orgBId,
          question: "Test cross-org",
        }),
      ).rejects.toThrow("Conversation introuvable ou non autorisée pour cet assistant.");
    });
  });
});
