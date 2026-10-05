# Validation HAKILI — 5 octobre 2026

## Vérifications exécutées

- TypeScript : réussi.
- Compilation Next.js : réussie (36 pages statiques générées).
- Vitest : 30 tests réussis, dans 5 suites.
- Migrations Drizzle : appliquées sur une base vierge de test.

Les tests de base de données ont utilisé PGlite, moteur PostgreSQL embarqué,
exposé via le protocole PostgreSQL au client `pg` de l'application. Les tests
ont été exécutés séquentiellement avec un pool d'une connexion.
Le workflow GitHub est configuré pour PostgreSQL 16 ; son résultat distant
n'a pas été vérifié pendant cette validation.

## Parcours métier vérifié

Le test `document-workflow.test.ts` appelle les actions serveur réelles et la route
chat, avec les API Next.js de cookies, en-têtes, redirection et cache simulées.
Il vérifie l'inscription, le rôle administrateur, l'essai de 14 jours, la session,
la déconnexion et reconnexion, le refus d'un mauvais mot de passe, la création
d'une base documentaire, l'import TXT, le traitement du fichier, la réponse
avec citation et le refus d'une question hors documents. Il vérifie également
qu'un fichier trop court renvoie une erreur au lieu d'une réussite.

## Corrections

- Réponses extractives locales avec numéros de sources conservés.
- Recherche native sur tous les fragments autorisés, par lots de 250.
- Test de recherche d'une réponse dans le 251e fragment.
- Erreurs de traitement d'import propagées à l'interface.
- Suites d'intégration refusées si le nom de base ne finit pas par `_test`.

## Vérifications restantes

- Parcours dans un vrai navigateur, affichage mobile et citations cliquables.
- PostgreSQL 16 distant et configuration de déploiement.
- Fournisseurs IA externes, extraction PDF/DOCX, widget et API publique.
- Quotas sous requêtes concurrentes et performance de recherche à grande échelle.
- Avertissement de compilation sur le traçage du stockage local.

Ce résultat valide une étape de développement, pas une mise en production.
