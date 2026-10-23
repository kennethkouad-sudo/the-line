// Applies the SQL files in db/migrations, in order, once each.
// Run with `npm run db:migrate`. The Docker image runs it before starting the app.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../db/migrations");

export async function migrate(connectionString = process.env.DATABASE_URL || process.env.POSTGRESQL_ADDON_URI) {
  if (!connectionString) throw new Error("DATABASE_URL (or POSTGRESQL_ADDON_URI) is not set");
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    // Only one migrator at a time, even if two app instances start together.
    await client.query("SELECT pg_advisory_lock(7319)");
    await client.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
    );
    const done = new Set((await client.query("SELECT name FROM schema_migrations")).rows.map((row) => row.name));
    for (const name of readdirSync(dir)
      .filter((file) => file.endsWith(".sql"))
      .sort()) {
      if (done.has(name)) continue;
      await client.query("BEGIN");
      try {
        await client.query(readFileSync(path.join(dir, name), "utf8"));
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [name]);
        await client.query("COMMIT");
        console.log(`migrated: ${name}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    await client.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  migrate().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
