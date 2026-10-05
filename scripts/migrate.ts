import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for migrations");
  }

  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const db = drizzle(pool);

  console.log("→ Exécution des migrations Drizzle versionnées...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("✓ Migrations appliquées avec succès.");

  await pool.end();
}

runMigrations().catch((err) => {
  console.error("Erreur lors des migrations :", err);
  process.exit(1);
});
