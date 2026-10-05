/** Purge des conversations au-delà de la durée de conservation de chaque organisation. Usage : npm run purge (cron quotidien). */
import "dotenv/config";
import { sql } from "drizzle-orm";
import { db, pool } from "../src/db";

async function main() {
  const r = await db.execute(sql`
    delete from conversations c using organizations o
    where c.organization_id = o.id and c.updated_at < now() - (o.conversation_retention_days || ' days')::interval
  `);
  console.log(`→ Conversations purgées : ${r.rowCount ?? 0}`);
  const s = await db.execute(sql`delete from sessions where expires_at < now()`);
  console.log(`→ Sessions expirées supprimées : ${s.rowCount ?? 0}`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => pool.end());
