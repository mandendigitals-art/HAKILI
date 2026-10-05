import { afterEach, describe, expect, it, vi } from "vitest";
import { getLLMProvider } from "@/lib/ai/provider";

afterEach(() => vi.unstubAllEnvs());
describe("Réponses locales et sources", () => {
  it("cite le bon numéro même si le passage pertinent arrive en troisième", async () => {
    vi.stubEnv("AI_PROVIDER", "local");
    const result = await getLLMProvider().chat([
      { role: "system", content: `=== SOURCES ===
[1] Source : Transport
Les véhicules de service sont disponibles uniquement sur réservation préalable.

[2] Source : Horaires
Les bureaux administratifs ouvrent tous les jours de la semaine à huit heures.

[3] Source : Primes
La prime d'ancienneté est fixée à 150 000 FCFA par trimestre après deux ans de service.
=== FIN DES SOURCES ===` },
      { role: "user", content: "Question : Quel est le montant de la prime d'ancienneté ?" },
    ]);
    expect(result.text).toContain("150 000 FCFA");
    expect(result.text).toContain("[3]");
    expect(result.text).not.toContain("[1]");
  });
  it("refuse explicitement une question sans passage pertinent", async () => {
    vi.stubEnv("AI_PROVIDER", "local");
    const result = await getLLMProvider().chat([
      { role: "system", content: "=== SOURCES ===\n[1] Source : RH\nLes bureaux administratifs ouvrent à huit heures.\n=== FIN DES SOURCES ===" },
      { role: "user", content: "Question : Quelle est la vitesse de la lumière ?" },
    ]);
    expect(result.text).toBe("Je ne trouve pas cette information dans les sources disponibles.");
  });
});
