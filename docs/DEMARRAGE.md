# HAKILI — démarrage local Windows / PowerShell

Prérequis : Node.js 22 ou 24, Git et Docker Desktop démarré.

```powershell
git clone https://github.com/mandendigitals-art/HAKILI.git
cd HAKILI
Copy-Item .env.example .env
# Modifier SUPERADMIN_PASSWORD dans .env avant le seed.
docker compose up -d --wait
npm install
npm run db:migrate
npm run seed
npm run dev
```

Ouvrir http://localhost:3000. Pour les tests, utiliser une base dédiée,
jamais la base de production. Les tests RAG créent et suppriment des organisations.

```powershell
npm run typecheck
# Créer une base dédiée (une seule fois).
docker compose exec postgres createdb -U postgres hakili_test
$env:DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5432/hakili_test"
$env:AI_PROVIDER = "local"
$env:EMBEDDING_PROVIDER = "local"
npm run db:migrate
npm test
npm run build
# Revenir à la base de développement indiquée dans .env.
Remove-Item Env:DATABASE_URL
Remove-Item Env:AI_PROVIDER
Remove-Item Env:EMBEDDING_PROVIDER
```

Sans clé IA, le chat utilise un mode extractif local. Les fichiers importés
restent dans `storage/`, les données PostgreSQL dans le volume Docker.
Ne pas exécuter `docker compose down -v` pour arrêter : cette option supprime les données.

## État du dépôt

Le dépôt central est `mandendigitals-art/HAKILI`.
La recherche native parcourt les fragments par lots et le mode local cite ses passages.
Les quotas concurrents, la performance sur de grandes bases et les tests dans un navigateur
restent à valider avant production.
