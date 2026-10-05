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
npm test
npm run build
```

Sans clé IA, le chat utilise un mode extractif local. Les fichiers importés
restent dans `storage/`, les données PostgreSQL dans le volume Docker.
Ne pas exécuter `docker compose down -v` pour arrêter : cette option supprime les données.

## État du dépôt

Le dépôt central est `mandendigitals-art/HAKILI`.
La recherche native limitée, les citations du mode extractif, les quotas concurrents,
les migrations et les parcours réels doivent être validés avant production.
