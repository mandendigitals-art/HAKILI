import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, sha256 } from "@/lib/auth";
import { LocalStorage } from "@/lib/storage";
import { formatXof } from "@/lib/plans";

describe("Authentification, Stockage et Utilitaires Métier", () => {
  describe("Hachage et sécurité des mots de passe", () => {
    it("hache les mots de passe avec bcrypt (coût 12) et vérifie fidèlement", async () => {
      const password = "MonSuperMotDePasse2025!";
      const hash = await hashPassword(password);
      expect(hash).toMatch(/^\$2[aby]\$12\$/);

      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);

      const isInvalid = await verifyPassword("MauvaisMotDePasse", hash);
      expect(isInvalid).toBe(false);
    });

    it("génère des empreintes SHA-256 déterministes pour les tokens de réinitialisation et clés API", () => {
      const token = "token_test_123456";
      const h1 = sha256(token);
      const h2 = sha256(token);
      expect(h1).toBe(h2);
      expect(h1.length).toBe(64);
    });
  });

  describe("Sécurité du stockage de fichiers (Anti-traversal)", () => {
    it("bloque les tentatives de path traversal relatives ou absolues", async () => {
      const storage = new LocalStorage();

      await expect(storage.put("../../../etc/shadow", Buffer.from("hack"), "text/plain")).rejects.toThrow(
        "Chemin de stockage non autorisé.",
      );
      await expect(storage.put("/etc/passwd", Buffer.from("hack"), "text/plain")).rejects.toThrow(
        "Chemin de stockage non autorisé.",
      );
      await expect(storage.put("dossier/../../evil.txt", Buffer.from("hack"), "text/plain")).rejects.toThrow(
        "Chemin de stockage non autorisé.",
      );
    });

    it("enregistre, lit et supprime un fichier dans le périmètre autorisé", async () => {
      const storage = new LocalStorage();
      const testKey = `test-${Date.now()}/document.txt`;
      const testData = Buffer.from("Contenu de test sécurisé");

      await storage.put(testKey, testData, "text/plain");
      const readBack = await storage.get(testKey);
      expect(readBack.toString()).toBe("Contenu de test sécurisé");

      await storage.delete(testKey);
      await storage.deletePrefix?.(`test-${Date.now()}`);
    });
  });

  describe("Formatage monétaire FCFA", () => {
    it("formate correctement les montants en FCFA pour le marché ouest-africain", () => {
      expect(formatXof(25000)).toContain("25");
      expect(formatXof(25000)).toContain("FCFA");
      expect(formatXof(200000)).toContain("200");
    });
  });
});
