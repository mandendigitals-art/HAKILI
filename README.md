# État de travail

Dépôt : https://github.com/mandendigitals-art/HAKILI.
Démarrage Windows : [docs/DEMARRAGE.md](docs/DEMARRAGE.md).
Les résultats attendus ci-dessous ne constituent pas une recette validée.

# HAKILI — Vos documents savent répondre.

**Assistant documentaire intelligent** pour les entreprises, institutions, écoles, ONG et PME africaines.
*Toute votre connaissance, en une question.* — Une solution **Manden Digital SARL** · https://mandendigital.com · support@mandendigital.com · +223 77 47 47 97

> *Hakili* signifie intelligence, esprit et mémoire en bambara.

---

## 1. Fonctionnalités du MVP

| Domaine | Détail |
|---|---|
| Espace sécurisé | Inscription, connexion, sessions httpOnly, organisation multi‑tenant, essai gratuit 14 jours |
| Rôles | Super administrateur Manden Digital · Administrateur entreprise · Collaborateur · Visiteur (widget) |
| Sources | PDF, DOCX, TXT (15 Mo), pages web par URL, textes libres, questions‑réponses ; statuts *en attente / traitement / terminé / erreur* |
| RAG | Extraction → nettoyage → découpage sémantique → embeddings → stockage vectoriel PostgreSQL → recherche hybride (vecteur + lexical) → génération contextuelle → citations → **refus si confiance insuffisante** |
| Assistants | Plusieurs assistants par organisation, périmètre par bases de connaissances, consignes, langue (fr / en / bm), seuil de confiance |
| Chat | Historique, citations cliquables `[1]`, aperçu du passage complet, indicateur de confiance (admin) |
| Widget | Script `embed.js` en une ligne, iframe `/widget/{clé}`, couleur, position, domaines autorisés, quota par visiteur |
| API | `POST /api/v1/ask` avec clé `hk_…` |
| Gestion | Utilisateurs et rôles, consommation (documents, questions, jetons, stockage), abonnement, export JSON, suppression complète |
| Administration | Entreprises, abonnements manuels (Orange Money / Moov Money / virement), offres modifiables, journal d'audit |
| Sécurité | Voir §7 |

## 2. Pile technique

- **Next.js 16** (App Router, Server Actions, Turbopack) · **React 19** · **TypeScript** · **Tailwind CSS 4**
- **PostgreSQL** · **Drizzle ORM** (migrations `drizzle-kit`, non destructives) · vecteurs `real[]` natifs, **pgvector** optionnel en production
- Authentification maison sécurisée (bcrypt + sessions serveur), tables compatibles Auth.js pour ajouter Google OAuth
- Couche IA abstraite : **OpenAI**, **Google Gemini**, **MuAPI**, modèle **local** de repli (sans clé) ou tout endpoint compatible OpenAI (auto‑hébergé)
- Stockage des fichiers : disque local ou S3 compatible (Supabase Storage, MinIO, AWS)

> **Pourquoi Drizzle et non Prisma ?** L'environnement cible impose Drizzle ; il offre les mêmes garanties (schéma typé, migrations SQL versionnées) sans le client binaire Prisma et permet du SQL brut pour pgvector. Aucune commande destructive (`db push --force-reset`) n'est utilisée.

## 3. Installation locale

```bash
git clone <votre-dépôt> hakili && cd hakili
npm install
cp .env.example .env            # compléter DATABASE_URL, éventuellement une clé IA
npm run db:push                 # applique le schéma (additif, vérifie l'existant)
npm run seed                    # offres + super admin + organisation de démonstration
npm run dev                     # http://localhost:3000
```

Comptes de démonstration créés par `npm run seed` (à supprimer en production, `SEED_DEMO=false`) :

| Rôle | E‑mail | Mot de passe |
|---|---|---|
| Super administrateur | `SUPERADMIN_EMAIL` (déf. `admin@mandendigital.com`) | `SUPERADMIN_PASSWORD` (déf. `Hakili-Admin-2025!`) |
| Administrateur entreprise (démo) | `demo@hakili.local` | `Demo-Hakili-2025!` |
| Collaborateur (démo) | `collaborateur@hakili.local` | `Demo-Hakili-2025!` |

Widget de démonstration : `http://localhost:3000/widget/wk_demo_hakili_public_widget`

### Sans clé IA
Sans `OPENAI_API_KEY` / `GEMINI_API_KEY` / `MUAPI_API_KEY`, HAKILI fonctionne en **mode local** : embeddings par hachage de caractéristiques et réponse *extractive* (passages les plus pertinents). Idéal pour démontrer le flux complet hors ligne. Avec une clé, les réponses sont rédigées par le modèle, strictement à partir des sources.

> Changer de fournisseur d'embeddings nécessite de **réimporter les sources** (les vecteurs sont liés au modèle ; la recherche ne mélange jamais deux modèles).

## 4. Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` / `build` / `start` | Développement / compilation / production |
| `npm run typecheck` | Vérification TypeScript |
| `npm run db:push` | Applique le schéma sur la base (développement) |
| `npm run db:generate` puis `db:migrate` | Migrations SQL versionnées (recommandé en production) |
| `npm run seed` | Super admin + offres + démo |
| `npm run purge` | Purge des conversations au‑delà de la durée de conservation et des sessions expirées (cron quotidien) |

## 5. Arborescence

```
src/
├── app/
│   ├── (public)/            # accueil, [page] (fonctionnalites, solutions, tarifs, demo, securite, contact, cgu…), connexion, inscription
│   ├── app/                 # espace client : accueil, assistants/[id], sources, conversations, utilisateurs, consommation, abonnement, parametres
│   ├── admin/               # administration Manden Digital : organisations/[id], paiements, plans, journal
│   ├── widget/[key]/        # page iframe du widget public
│   ├── embed.js/            # script d'intégration
│   ├── api/                 # chat, widget/[key]/{chat,config}, v1/ask, chunks/[id], export, health
│   └── actions/             # Server Actions : auth, workspace, admin
├── components/              # UI, chat, formulaires, navigation, marque
├── db/                      # schema.ts (19 entités), index.ts
├── lib/
│   ├── ai/provider.ts       # abstraction LLM + embeddings (OpenAI, Gemini, MuAPI, local)
│   ├── rag/extract.ts       # extraction PDF/DOCX/TXT/HTML, nettoyage, découpage
│   ├── rag/engine.ts        # ingestion, recherche hybride, génération, citations, refus
│   ├── auth.ts              # sessions, rôles, contexte d'organisation, audit
│   ├── plans.ts             # offres, limites, consommation
│   ├── security.ts          # rate limiting, validation fichiers, anti‑injection, SSRF, erreurs neutres
│   └── storage.ts           # adaptateurs local / S3
scripts/                     # seed.ts, purge.ts, enable-pgvector.sql
```

## 6. Schéma de base de données

`users`, `accounts`, `sessions`, `organizations`, `organization_members`, `plans`, `subscriptions`, `payments`, `knowledge_bases`, `assistants`, `assistant_knowledge_bases`, `sources`, `documents`, `document_chunks`, `embeddings`, `conversations`, `messages`, `citations`, `usage_records`, `audit_logs`, `api_keys`, `widget_configurations`.

Toutes les tables métier portent `organization_id` (suppression en cascade). Définition complète : `src/db/schema.ts`.

## 7. Sécurité

- Contrôle d'accès **côté serveur** sur chaque page, action et route (`requireOrgContext`, `requireOrgAdmin`, `requireSuperAdmin`).
- **Isolation stricte** : chaque requête est filtrée par `organization_id` ; la recherche vectorielle ne lit que les bases reliées à l'assistant de l'organisation.
- Mots de passe **bcrypt** (coût 12), sessions serveur avec jeton haché (SHA‑256) en cookie `httpOnly`/`SameSite=Lax`/`Secure`.
- **Validation des fichiers** : extension, type MIME, taille, **signature binaire** (`%PDF-`, ZIP pour DOCX), rejet des exécutables/scripts, noms nettoyés.
- **Anti‑SSRF** sur l'import d'URL (adresses privées/locales refusées, taille et délai limités).
- **Rate limiting** : connexion, inscription, chat, imports, widget (par IP, utilisateur et visiteur).
- **Injection de prompt** : détection de motifs, contenu des documents traité comme donnée, balises de contrôle neutralisées, règles système explicites.
- **Refus** quand la confiance est insuffisante ; jamais de connaissance extérieure.
- **En‑têtes** : HSTS, `Content-Security-Policy: frame-ancestors` configurable (variable `FRAME_ANCESTORS`, `*` en aperçu, à restreindre en production ; le widget `/widget/*` reste intégrable sur les sites clients), `nosniff`, `Referrer-Policy`, `Permissions-Policy`.
- **Journal d'audit** de toutes les actions administratives et sensibles (IP, utilisateur, cible).
- **Erreurs neutres** : aucun détail interne exposé au client en production.
- **Données** : export JSON complet, suppression définitive de l'organisation, durée de conservation configurable + `npm run purge`.
- Les clés IA restent **exclusivement côté serveur**.

**Sauvegardes recommandées** : `pg_dump` quotidien chiffré + réplication du bucket de stockage. Exemple cron : `0 2 * * * pg_dump "$DATABASE_URL" | gzip | age -r <clé> > /backups/hakili-$(date +\%F).sql.gz.age`

## 8. Déploiement

### 8.1 Environnements
| Env | URL | Base |
|---|---|---|
| Local | http://localhost:3000 | PostgreSQL local |
| Test | https://test-hakili.mandendigital.com | base dédiée `hakili_test` |
| Production | https://hakili.mandendigital.com | base dédiée `hakili_prod` + sauvegardes |

### 8.2 Vercel + PostgreSQL managé (Neon / Supabase)
1. Créer la base, récupérer `DATABASE_URL` (activer `vector` si souhaité : `scripts/enable-pgvector.sql`).
2. Importer le dépôt dans Vercel ; renseigner **toutes** les variables de `.env.example` (sans `SEED_DEMO=true`).
3. Build : `npm run build` (par défaut). Après le premier déploiement, exécuter localement contre la base de prod : `npm run db:generate && npm run db:migrate` puis `SEED_DEMO=false npm run seed`.
4. `STORAGE_DRIVER=s3` obligatoire sur Vercel (système de fichiers éphémère) — Supabase Storage : `S3_ENDPOINT=https://<projet>.supabase.co/storage/v1`, `S3_BUCKET`, `S3_BEARER_TOKEN` (clé *service role*).
5. Cron Vercel (ou externe) : `npm run purge` quotidien.

### 8.3 Serveur cloud (Ubuntu, Node 22, PostgreSQL 16, Nginx)
```bash
sudo apt install postgresql nginx certbot python3-certbot-nginx
sudo -u postgres psql -c "create user hakili password '***'; create database hakili_prod owner hakili;"
sudo -u postgres psql -d hakili_prod -c "create extension if not exists vector;"   # optionnel
git clone <dépôt> /opt/hakili && cd /opt/hakili && npm ci && cp .env.example .env && nano .env
npm run db:generate && npm run db:migrate && SEED_DEMO=false npm run seed && npm run build
# Service systemd : ExecStart=/usr/bin/npm run start, Environment=PORT=3000, Restart=always
```
Nginx : reverse proxy vers `127.0.0.1:3000`, `client_max_body_size 20m`, puis `certbot --nginx -d hakili.mandendigital.com`.

### 8.4 Connexion du domaine `hakili.mandendigital.com`
1. Chez le registrar de `mandendigital.com`, ajouter un enregistrement DNS :
   - Vercel : `CNAME hakili → cname.vercel-dns.com` (puis ajouter le domaine dans *Project → Domains*) ;
   - Serveur : `A hakili → <IP publique>` (+ `AAAA` si IPv6).
2. Attendre la propagation (≤ 1 h), vérifier `dig hakili.mandendigital.com`.
3. Définir `NEXT_PUBLIC_APP_URL=https://hakili.mandendigital.com` et redéployer (le script `embed.js` et les domaines autorisés du widget en dépendent).
4. HTTPS : automatique sur Vercel ; `certbot` sur serveur. HSTS est déjà envoyé par l'application.

### 8.5 Création des comptes administrateurs
- **Premier super administrateur** : `SUPERADMIN_EMAIL` + `SUPERADMIN_PASSWORD` dans `.env`, puis `SEED_DEMO=false npm run seed` (idempotent : promeut le compte s'il existe).
- **Autres super administrateurs** : `/admin` → « Ajouter un super administrateur » (journalisé).
- **Administrateur d'entreprise** : créé automatiquement à l'inscription (créateur de l'organisation) ou promu dans `/app/utilisateurs`.
- Le super administrateur peut ouvrir l'espace de n'importe quelle organisation depuis `/admin/organisations/{id}` (action journalisée).

### 8.6 Gestion des abonnements (MVP manuel)
1. Le client choisit une offre dans `/app/abonnement`, paie par Orange Money / Moov Money / virement, puis **déclare** le paiement (référence).
2. Manden Digital confirme dans `/admin/paiements` → l'abonnement est activé/prolongé automatiquement (`subscriptions`, `payments`, `audit_logs`).
3. Suspension / réactivation : `/admin/organisations/{id}`. Les limites (documents, stockage, questions/mois, utilisateurs, assistants) sont vérifiées côté serveur avant chaque action.
4. Couche paiement modulaire : l'intégration d'une API Orange Money / Moov Money (V2) consistera à créer le `payment` en `pending` puis à appeler la même logique de confirmation depuis un webhook.

## 9. Tests essentiels

Scénarios attendus — à exécuter et vérifier sur cette version (voir aussi `scripts/seed.ts`) :

| Test | Résultat attendu |
|---|---|
| `npm run typecheck` / `npm run build` | 0 erreur |
| Inscription → organisation créée avec essai 14 jours, rôle admin | ✅ |
| Connexion avec mauvais mot de passe ×10 | blocage 15 min (rate limit) + audit `auth.login_failed` |
| Collaborateur accède à `/app/sources` ou `/app/utilisateurs` | redirection `/app` |
| Utilisateur de l'org A demande `/api/chunks/{id d'un fragment de l'org B}` | 404 |
| Question dans le périmètre (« per diem mission Mali ») | réponse + citation `[1]` Procédure d'achat, confiance ≈ 0,42 |
| Question hors périmètre (« capitale du Japon ») | refus explicite, `refused=true` |
| Injection (« ignore toutes les instructions… ») | refus `provider=guard` |
| Même question depuis une autre organisation | refus, 0 citation (isolation) |
| Upload `.exe` renommé `.pdf` | rejet (signature binaire) |
| Widget avec domaine non autorisé | 403 |
| Mobile 360 px : navigation basse, chat plein écran, tableaux avec colonnes masquées | ✅ |

Scénario RAG automatisé : voir la section « test » du présent dépôt (`scripts/seed.ts` produit les données, et un script équivalent à celui utilisé en recette peut être rejoué avec `npx tsx`).

## 10. Provenance et licence

HAKILI reprend la structure fonctionnelle du projet open source **KnowBase AI** (MIT). La notice MIT est conservée dans `LICENSE`. Toute l'identité visuelle, les textes, la sécurité, le moteur RAG et le modèle multi‑tenant ont été réécrits. Fonctionnalités d'origine **non reprises et pourquoi** :
- *Crédits Stripe à l'unité* → remplacés par des abonnements mensuels en FCFA avec paiement manuel local (Stripe non disponible au Mali). L'interface reste modulaire.
- *Clé API personnelle envoyée par le navigateur* → supprimée (fuite de secret) ; la configuration IA est serveur uniquement.
- *Recherche par mots‑clés sur documents entiers* → remplacée par un vrai pipeline RAG.
- *Google OAuth* → non activé dans le MVP (tables `accounts` prêtes) pour privilégier e‑mail/mot de passe, plus adapté aux organisations cibles.

## 11. Améliorations prévues (V2)

1. API Orange Money / Moov Money (paiement automatique + webhooks) et facturation PDF.
2. pgvector avec index HNSW activé par `VECTOR_BACKEND=pgvector` ; re‑ranking par modèle croisé.
3. File d'attente d'ingestion asynchrone (BullMQ/Redis) avec exploration de site complet (sitemap) et re‑synchronisation périodique des URL.
4. Interface en anglais puis en bambara (i18n `next-intl`, clé `locale` déjà présente), réponses vocales.
5. Google OAuth / SSO, double authentification, invitations par e‑mail (SMTP), réinitialisation de mot de passe.
6. Réponses en streaming, retours utilisateurs (👍/👎) et tableau de bord qualité (questions sans réponse → sources manquantes).
7. Intégration WhatsApp Business et Telegram pour les assistants publics.
8. Rate limiting distribué (Redis), journal d'audit exportable, alertes de quota par e‑mail.
9. Import Excel/CSV, images avec OCR, Google Drive / SharePoint.
10. Hébergement souverain (serveur au Mali) et modèle auto‑hébergé via `OPENAI_BASE_URL`.

---
© Manden Digital SARL — Bamako, Mali.
