import { execFileSync } from "node:child_process";
import { rm } from "node:fs/promises";
import pg from "pg";
import { E2E_ENV } from "./env";

/** A clean test database and an empty test storage folder for every run. */
export default async function globalSetup() {
  execFileSync("node", ["scripts/migrate.mjs"], {
    env: { ...process.env, DATABASE_URL: E2E_ENV.DATABASE_URL },
    stdio: "inherit",
  });
  const client = new pg.Client({ connectionString: E2E_ENV.DATABASE_URL });
  await client.connect();
  await client.query("TRUNCATE notes, deletion_log, rate_limits");
  await client.end();
  await rm(E2E_ENV.STORAGE_DIR, { recursive: true, force: true });
}
